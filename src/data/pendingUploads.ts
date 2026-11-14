import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { addPending, parsePending, removePending, type PendingUpload } from './offlineLogic';

const KEY = 'resaletracker-pending-uploads';

let list: PendingUpload[] = [];
const listeners = new Set<() => void>();
let ready: Promise<void> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // keep going: the in-memory list still works for this session
  }
}

/** Reads the saved list once (safe to call many times). */
export function loadPendingUploads(): Promise<void> {
  if (!ready) {
    ready = AsyncStorage.getItem(KEY)
      .then((raw) => {
        const saved = parsePending(raw);
        for (const p of saved) list = addPending(list, p);
        emit();
      })
      .catch(() => undefined);
  }
  return ready;
}

export function getPendingUploads(): PendingUpload[] {
  return list;
}

export function getPendingUri(path: string | null | undefined): string | null {
  if (!path) return null;
  return list.find((p) => p.path === path)?.localUri ?? null;
}

export async function addPendingUpload(p: PendingUpload): Promise<void> {
  await loadPendingUploads();
  list = addPending(list, p);
  emit();
  await persist();
}

export async function removePendingUpload(path: string): Promise<void> {
  await loadPendingUploads();
  list = removePending(list, path);
  emit();
  await persist();
}

export function subscribePendingUploads(cb: () => void): () => void {
  void loadPendingUploads();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The local file to show for a photo that has not uploaded yet (null once it has). */
export function usePendingUri(path: string | null | undefined): string | null {
  return useSyncExternalStore(
    subscribePendingUploads,
    () => getPendingUri(path),
    () => null,
  );
}

export function usePendingUploadCount(): number {
  return useSyncExternalStore(
    subscribePendingUploads,
    () => list.length,
    () => 0,
  );
}
