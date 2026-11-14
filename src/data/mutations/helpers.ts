import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { BusinessData } from '@/domain/types';
import { isDemoMode } from '@/lib/demo';
import { businessKey, emptyBusinessData, useBusiness } from '../business';
import { demoStore } from '../demo-store';

export interface MutationCtx {
  businessId: string;
  /** Latest loaded snapshot of the business (from the query cache). Treat as read-only. */
  data: BusinessData;
}

/** Throws the Supabase error, or returns the data. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
export function check(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

/**
 * Builds a mutation hook with two implementations behind one API:
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
