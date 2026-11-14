import { onlineManager, useMutation, useQueryClient, type MutateOptions, type UseMutationResult } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { BusinessData } from '@/domain/types';
import { isDemoMode } from '@/lib/demo';
import { businessKey, emptyBusinessData, useBusiness } from '../business';
import { demoStore } from '../demo-store';
import {
  applyOptimistic,
  queuedCount,
  snapshotBusiness,
  type BizMutationDef,
  type Envelope,
  type MutationCtx,
} from '../offline';
import { registerMutation } from '../mutationRegistry';
import { shouldQueueLocally } from '../offlineLogic';

export type { MutationCtx, BizMutationDef };

/** Throws the Supabase error, or returns the data. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
export function check(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

/**
 * Defines a write that survives poor signal. Returns the hook screens use (same API as before:
 * mutate / mutateAsync(input), isPending, ...).
 *
 * Online and nothing waiting: runs against Supabase and resolves when it is saved (errors reach the screen as before).
 * Offline, or earlier changes still waiting: the change is applied to the on-screen data at once, queued, and
 * mutateAsync resolves straight away with the same result the server write would give. It is sent later, in order.
 * Demo mode: edits the in-memory store, exactly as before.
 *
 * The definition is registered by `key` so queued changes can be resumed after the app restarts.
 */
export function defineBizMutation<I, O, P = undefined>(def: BizMutationDef<I, O, P>): () => UseMutationResult<O, Error, I> {
  registerMutation(def as BizMutationDef);
  return function useQueuedMutation() {
    const qc = useQueryClient();
    const { businessId } = useBusiness();
    const m = useMutation<unknown, Error, Envelope<I, P>>({ mutationKey: [def.key] });
    const { mutateAsync: runAsync, mutate: run } = m;

    const mutateAsync = useCallback(
      async (input: I): Promise<O> => {
        if (!businessId) throw new Error('No business yet');
        const online = onlineManager.isOnline();
        if (def.onlineOnly && !isDemoMode && !online) throw new Error(def.onlineOnly);
        const data = snapshotBusiness(qc, businessId);
        const prep = (def.prepare ? def.prepare(data, input) : undefined) as P;
        const env: Envelope<I, P> = { businessId, input, prep };
        if (!isDemoMode && shouldQueueLocally(online, queuedCount(qc))) {
          const result = applyOptimistic(qc, businessId, def, input, prep); // throws on invalid input: nothing queued
          run(env);
          return result;
        }
        return (await runAsync(env)) as O;
      },
      [qc, businessId, runAsync, run],
    );

    const mutate = useCallback(
      (input: I, options?: MutateOptions<O, Error, I>) => {
        mutateAsync(input).then(
          (res) => {
            options?.onSuccess?.(res, input, undefined as never, undefined as never);
            options?.onSettled?.(res, null, input, undefined as never, undefined as never);
          },
          (err: Error) => {
            options?.onError?.(err, input, undefined as never, undefined as never);
            options?.onSettled?.(undefined, err, input, undefined as never, undefined as never);
          },
        );
      },
      [mutateAsync],
    );

    return {
      ...m,
      // A change waiting for signal is "saved on this phone", not "saving".
      isPending: m.isPending && !m.isPaused,
      variables: m.variables?.input,
      mutate,
      mutateAsync,
    } as unknown as UseMutationResult<O, Error, I>;
  };
}

/**
 * Older, non-queued style (kept for code that has not moved to defineBizMutation): builds a mutation hook with two implementations behind one API:
 *  - remote: talks to Supabase
 *  - local: edits the in-memory demo store (demo mode)
 * Either way the business query is invalidated afterwards.
 */
export function useBizMutation<I, O>(
  remote: (ctx: MutationCtx, input: I) => Promise<O>,
  local: (draft: BusinessData, input: I) => O,
) {
  const qc = useQueryClient();
  const { businessId } = useBusiness();
  return useMutation<O, Error, I>({
    mutationFn: async (input: I) => {
      if (isDemoMode) return demoStore.mutate((draft) => local(draft, input));
      if (!businessId) throw new Error('No business yet');
      const data = qc.getQueryData<BusinessData>(businessKey(businessId)) ?? emptyBusinessData(businessId);
      return remote({ businessId, data }, input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business'] }),
  });
}

export function nextSort(values: number[]): number {
  return values.length ? Math.max(...values) + 1 : 0;
}
