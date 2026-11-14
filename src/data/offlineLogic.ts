// Pure helpers for the offline changes queue (no React, no Supabase, no native modules) so they can be unit tested.

/** Shown instead of a SKU on an item created offline. The real SKU comes from the server (next_sku) on sync. */
export const PENDING_SKU_TEXT = 'SKU assigned when back online';

export function isPendingSku(sku: string | null | undefined): boolean {
  return sku === PENDING_SKU_TEXT;
}

const NETWORK_PATTERNS =
  /network request failed|failed to fetch|fetch failed|load failed|network error|networkerror|timed out|timeout|internet connection|offline|connection (was )?(lost|reset|refused)|econnreset|enotfound|unreachable/i;

/** True when an error looks like "no signal" rather than a real rejection (bad data, permissions, constraint...). */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const message = typeof err === 'string' ? err : err instanceof Error ? err.message : String((err as { message?: unknown }).message ?? '');
  return NETWORK_PATTERNS.test(message);
}

/** Retry only network-looking errors, a few times (the retries pause while offline). */
export function shouldRetryMutation(failureCount: number, err: unknown, maxRetries = 4): boolean {
  return failureCount < maxRetries && isNetworkError(err);
}

/** 1s, 2s, 4s ... capped at 30s. */
export function retryDelayMs(failureCount: number): number {
  return Math.min(1000 * 2 ** failureCount, 30_000);
}

/**
 * A change is applied to the screen immediately and sent later (instead of waiting for the server) when we are
 * offline, or when earlier changes are still waiting: changes must reach the server in the order they were made.
 */
export function shouldQueueLocally(online: boolean, queuedCount: number): boolean {
  return !online || queuedCount > 0;
}

/**
 * Refetching the business from the server throws away optimistic edits for changes that have not been sent yet.
 * Only refetch once the queue is empty. `queuedCount` includes the mutation that just finished when called from
 * its onSettled callback (it is still pending then), hence `finishing`.
 */
export function canRefetchBusiness(queuedCount: number, finishing = false): boolean {
  return queuedCount - (finishing ? 1 : 0) <= 0;
}

export interface QueueStatus {
  online: boolean;
  /** changes waiting to be sent */
  waiting: number;
  /** changes that were rejected by the server (kept until dismissed) */
  failed: number;
  /** photos waiting to upload */
  photos: number;
}

export interface BannerInfo {
  tone: 'offline' | 'syncing' | 'problem';
  text: string;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The text for the small banner, or null when there is nothing to say. */
export function describeQueue(s: QueueStatus): BannerInfo | null {
  const parts: string[] = [];
  if (s.waiting > 0) parts.push(plural(s.waiting, 'change', 'changes'));
  if (s.photos > 0) parts.push(plural(s.photos, 'photo', 'photos'));
  const waitingText = parts.join(' and ');
  if (!s.online) {
    return {
      tone: 'offline',
      text: waitingText ? `Offline – ${waitingText} waiting` : 'Offline – changes will be saved when you are back online',
    };
  }
  if (waitingText) return { tone: 'syncing', text: `Saving ${waitingText}…` };
  if (s.failed > 0) return { tone: 'problem', text: `${plural(s.failed, 'change', 'changes')} could not be saved` };
  return null;
}

export interface PendingUpload {
  /** where the photo will live in the 'photos' bucket (already stored on the row) */
  path: string;
  /** local file to upload from */
  localUri: string;
}

export function addPending(list: PendingUpload[], item: PendingUpload): PendingUpload[] {
  return [...list.filter((p) => p.path !== item.path), item];
}

export function removePending(list: PendingUpload[], path: string): PendingUpload[] {
  return list.filter((p) => p.path !== path);
}

export function parsePending(json: string | null): PendingUpload[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (p): p is PendingUpload =>
        !!p && typeof (p as PendingUpload).path === 'string' && typeof (p as PendingUpload).localUri === 'string',
    );
  } catch {
    return [];
  }
}
