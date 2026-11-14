import { useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';

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

/**
 * Compresses a local image and uploads it to the private 'photos' bucket at `${businessId}/${folder}/${uuid}.jpg`.
 * Resolves with the storage path (store this on the row). In demo mode nothing is uploaded: the compressed local
 * file uri is returned and useSignedUrl passes it straight through.
 */
export async function uploadImage(localUri: string, businessId: string, folder: string): Promise<string> {
  const compressed = await compressImage(localUri);
  if (isDemoMode) return compressed;
  const bytes = await new File(compressed).arrayBuffer();
  const path = `${businessId}/${folder}/${uuid()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** Deletes an uploaded file (best effort). */
export async function removeImage(path: string): Promise<void> {
  if (isDemoMode || isDirectUri(path)) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/**
 * A temporary viewable URL for a stored photo path (cached ~50 minutes per path).
 * Returns null while loading, when there is no path, or when the image cannot be fetched (e.g. offline).
 */
export function useSignedUrl(path: string | null | undefined): string | null {
  const direct = !!path && (isDemoMode || isDirectUri(path));
  const q = useQuery({
    queryKey: ['signed-url', path],
    enabled: !!path && !direct,
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
  return q.data ?? null;
}
