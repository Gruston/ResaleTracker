import { onlineManager, useQuery, type QueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { isNetworkError } from './offlineLogic';
import { addPendingUpload, getPendingUploads, removePendingUpload, usePendingUri } from './pendingUploads';

export const PHOTO_BUCKET = 'photos';
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.7;
const SIGNED_URL_TTL = 60 * 60; // seconds

/** Already displayable without Supabase (local file, remote URL, data URI). */
function isDirectUri(path: string): boolean {
  return /^(file:|content:|ph:|assets-library:|https?:|data:|blob:)/.test(path);
}

/** Shrinks a picked image to at most 1600px wide, JPEG at 0.7 quality. Returns the new local file uri. */
export async function compressImage(localUri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(localUri, { maxWidth: MAX_WIDTH });
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return result.uri;
}

async function putFile(localUri: string, path: string, upsert: boolean): Promise<void> {
  const bytes = await new File(localUri).arrayBuffer();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert,
  });
  if (error) throw new Error(error.message);
}

/** Copies a cache file somewhere the system will not clean up, so a waiting upload survives. Falls back to the original. */
function keepLocalCopy(uri: string): string {
  try {
    const dest = new File(Paths.document, `pending-${uuid()}.jpg`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

/**
 * Compresses a local image and uploads it to the private 'photos' bucket at `${businessId}/${folder}/${uuid}.jpg`.
 * Resolves with the storage path (store this on the row). In demo mode nothing is uploaded: the compressed local
 * file uri is returned and useSignedUrl passes it straight through.
 *
 * Offline (or no signal): the photo is kept on the phone, the storage path is still returned (so the row can be saved
 * now), and the upload is retried later by retryPendingUploads(). useSignedUrl shows the local file until then.
 */
export async function uploadImage(localUri: string, businessId: string, folder: string): Promise<string> {
  const compressed = await compressImage(localUri);
  if (isDemoMode) return compressed;
  const path = `${businessId}/${folder}/${uuid()}.jpg`;
  if (onlineManager.isOnline()) {
    try {
      await putFile(compressed, path, false);
      return path;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }
  await addPendingUpload({ path, localUri: keepLocalCopy(compressed) });
  return path;
}

let retrying = false;

/** Uploads photos that were taken offline. Safe to call any time; does nothing if offline or already running. */
export async function retryPendingUploads(qc?: QueryClient): Promise<void> {
  if (isDemoMode || retrying || !onlineManager.isOnline()) return;
  retrying = true;
  try {
    for (const p of [...getPendingUploads()]) {
      if (!onlineManager.isOnline()) break;
      try {
        if (!new File(p.localUri).exists) {
          await removePendingUpload(p.path); // the file is gone: nothing left to upload
          continue;
        }
        await putFile(p.localUri, p.path, true);
        await removePendingUpload(p.path);
        try {
          new File(p.localUri).delete();
        } catch {
          // leftover file is harmless
        }
        void qc?.invalidateQueries({ queryKey: ['signed-url', p.path] });
      } catch {
        // try again next time we come online
      }
    }
  } finally {
    retrying = false;
  }
}

/** Deletes an uploaded file (best effort). */
export async function removeImage(path: string): Promise<void> {
  if (isDemoMode) return;
  if (getPendingUploads().some((p) => p.path === path)) {
    await removePendingUpload(path);
    return;
  }
  if (isDirectUri(path)) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/**
 * A temporary viewable URL for a stored photo path (cached ~50 minutes per path).
 * Returns null while loading, when there is no path, or when the image cannot be fetched (e.g. offline).
 */
export function useSignedUrl(path: string | null | undefined): string | null {
  const direct = !!path && (isDemoMode || isDirectUri(path));
  const waiting = usePendingUri(path); // photo taken offline, not uploaded yet: show the file on the phone
  const q = useQuery({
    queryKey: ['signed-url', path],
    enabled: !!path && !direct && !waiting,
    staleTime: (SIGNED_URL_TTL - 600) * 1000,
    gcTime: SIGNED_URL_TTL * 1000,
    retry: 1,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path as string, SIGNED_URL_TTL);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });
  if (!path) return null;
  if (direct) return path;
  if (waiting) return waiting;
  return q.data ?? null;
}
