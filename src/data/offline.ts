// Offline changes queue.
//
// How it works (see also docs in the A4 report):
//  - NetInfo drives TanStack Query's onlineManager.
//  - Every write is a "defined" mutation (defineBizMutation in mutations/helpers.ts) registered here by key. For each
//    key we call queryClient.setMutationDefaults, so a mutation restored from storage after the app restarts knows
//    which function to run.
//  - Variables are a self-contained envelope { businessId, input, prep }. `prep` holds everything that must not change
//    between attempts (client-side uuids, merged rows, today's date), computed once when Kat taps Save.
//  - All writes share one scope, so they reach the server one at a time, in the order they were made.
//  - Paused mutations are persisted by PersistQueryClientProvider and resumed when the app comes online.
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { BusinessData } from '@/domain/types';
import { isDemoMode } from '@/lib/demo';
import { businessKey, emptyBusinessData } from './business';
import { demoStore } from './demo-store';
import { retryPendingUploads } from './images';
import { canRefetchBusiness, retryDelayMs, shouldRetryMutation, type QueueStatus } from './offlineLogic';
import { loadPendingUploads, usePendingUploadCount } from './pendingUploads';
import { getRegisteredMutation, isRegisteredMutation, registeredMutations } from './mutationRegistry';

export const WRITE_SCOPE = 'business-writes';
const DAY = 1000 * 60 * 60 * 24;

export interface MutationCtx {
  businessId: string;
  /** Latest snapshot of the business (from the query cache, including changes still waiting to be sent). Read-only. */
  data: BusinessData;
}

/** What is stored for each queued change. Must stay JSON-serialisable. */
export interface Envelope<I = unknown, P = unknown> {
  businessId: string;
  input: I;
  prep: P;
}

export interface BizMutationDef<I = any, O = any, P = any> {
  /** Unique, stable name. Persisted with queued changes: do not rename once shipped. */
  key: string;
  /** Computes the once-only parts (ids, merged rows, dates) from the current data. */
  prepare?: (data: BusinessData, input: I) => P;
  /** Server write. Must be safe to run twice (use upsert / idempotent updates). */
  remote: (ctx: MutationCtx, input: I, prep: P) => Promise<O>;
  /** Edits a copy of the business: demo mode store, and the immediate on-screen update while offline. */
  apply: (draft: BusinessData, input: I, prep: P) => O;
  /** Overrides `apply` for the immediate on-screen update while offline (e.g. items get no real SKU yet). */
  applyOffline?: (draft: BusinessData, input: I, prep: P) => O;
  /** Needs the server (cannot be queued). The message is shown when offline. */
  onlineOnly?: string;
}

export { registerMutation } from './mutationRegistry';

export function getMutationDef(key: string): BizMutationDef | undefined {
  return getRegisteredMutation(key) as BizMutationDef | undefined;
}

export function snapshotBusiness(qc: QueryClient, businessId: string): BusinessData {
  if (isDemoMode) return demoStore.get();
  return qc.getQueryData<BusinessData>(businessKey(businessId)) ?? emptyBusinessData(businessId);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Applies a change to the cached business straight away (used while offline). Returns what the mutation resolves with. */
export function applyOptimistic<I, O, P>(qc: QueryClient, businessId: string, def: BizMutationDef<I, O, P>, input: I, prep: P): O {
  const draft = clone(snapshotBusiness(qc, businessId));
  const out = (def.applyOffline ?? def.apply)(draft, input, prep);
  qc.setQueryData(businessKey(businessId), draft);
  return out;
}

/** Number of changes not yet sent (pending, including paused). */
export function queuedCount(qc: QueryClient): number {
  return qc.isMutating();
}

function setUpNetInfo() {
  onlineManager.setEventListener((setOnline) => {
    const sub = NetInfo.addEventListener((s) => {
      setOnline(!!s.isConnected && s.isInternetReachable !== false);
    });
    return () => sub();
  });
}

let installed = false;

/**
 * Call once, after all mutation modules have been imported (QueryProvider does this).
 * Sets up NetInfo, a default for each registered mutation, and "do not refetch over unsent changes" for business data.
 */
export function installOfflineSupport(qc: QueryClient): void {
  if (installed) return;
  installed = true;
  if (!isDemoMode) setUpNetInfo();

  for (const def of registeredMutations() as BizMutationDef[]) {
    qc.setMutationDefaults([def.key], {
      mutationFn: async (env: Envelope) => {
        if (isDemoMode) return demoStore.mutate((draft) => def.apply(draft, env.input, env.prep));
        if (!env.businessId) throw new Error('No business yet');
        return def.remote({ businessId: env.businessId, data: snapshotBusiness(qc, env.businessId) }, env.input, env.prep);
      },
      // 'online' = wait (paused) until there is a connection instead of failing; it resumes by itself.
      networkMode: isDemoMode ? 'always' : 'online',
      scope: isDemoMode ? undefined : { id: WRITE_SCOPE },
      retry: (count, err) => shouldRetryMutation(count, err),
      retryDelay: retryDelayMs,
      gcTime: DAY, // keep failed changes around so the banner can say so
      onSettled: () => {
        // Refetch only when nothing is left to send, otherwise we would wipe the on-screen edits still waiting.
        if (canRefetchBusiness(qc.isMutating(), true)) void qc.invalidateQueries({ queryKey: ['business'] });
      },
    });
  }

  qc.setQueryDefaults(['business'], {
    refetchOnMount: () => canRefetchBusiness(qc.isMutating()),
    refetchOnReconnect: () => canRefetchBusiness(qc.isMutating()),
  });

  if (!isDemoMode) {
    void loadPendingUploads();
    onlineManager.subscribe((online) => {
      if (online) void retryPendingUploads(qc);
    });
  }
}

/** Called once the saved cache and queued changes have been restored from storage. */
export function onCacheRestored(qc: QueryClient): void {
  if (isDemoMode) return;
  void qc.resumePausedMutations().then(() => retryPendingUploads(qc));
}

export function dismissFailedChanges(qc: QueryClient): void {
  const cache = qc.getMutationCache();
  for (const m of cache.getAll()) if (m.state.status === 'error' && isRegisteredMutation(String(m.options.mutationKey?.[0]))) cache.remove(m);
}

/** Live numbers for the banner. */
export function useQueueStatus(): QueueStatus {
  const qc = useQueryClient();
  const photos = usePendingUploadCount();
  const read = () => {
    let waiting = 0;
    let failed = 0;
    for (const m of qc.getMutationCache().getAll()) {
      if (!isRegisteredMutation(String(m.options.mutationKey?.[0]))) continue;
      if (m.state.status === 'pending') waiting++;
      else if (m.state.status === 'error') failed++;
    }
    return { waiting, failed };
  };
  const [online, setOnline] = useState(onlineManager.isOnline());
  const [counts, setCounts] = useState(read);
  useEffect(() => {
    setOnline(onlineManager.isOnline());
    const offOnline = onlineManager.subscribe(setOnline);
    const offCache = qc.getMutationCache().subscribe(() => {
      const next = read();
      setCounts((c) => (c.waiting === next.waiting && c.failed === next.failed ? c : next));
    });
    return () => {
      offOnline();
      offCache();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);
  return { online, waiting: counts.waiting, failed: counts.failed, photos };
}
