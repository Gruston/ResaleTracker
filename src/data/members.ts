import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DEMO_BUSINESS_ID, isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { useSession } from './auth';
import { useBusiness } from './business';

export type MemberRole = 'owner' | 'member';

export interface Member {
  userId: string;
  email: string;
  role: MemberRole;
}

export const membersKey = (businessId: string | null) => ['members', businessId] as const;

/** Demo mode shows just Kat, as the owner. */
export const DEMO_MEMBERS: Member[] = [{ userId: 'demo-user', email: 'Kat', role: 'owner' }];

export interface MembersState {
  members: Member[];
  isLoading: boolean;
  isError: boolean;
  /** true when the signed-in user is the owner of this business (demo mode: true) */
  isOwner: boolean;
  refetch: () => Promise<unknown>;
}

/** Everyone who can see this business (calls business_members_list). Demo mode: Kat (owner). */
export function useMembers(): MembersState {
  const { businessId } = useBusiness();
  const { userId } = useSession();
  const q = useQuery({
    queryKey: membersKey(businessId),
    enabled: !isDemoMode && !!businessId,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase.rpc('business_members_list', { p_business_id: businessId as string });
      if (error) throw new Error(error.message);
      return ((data ?? []) as { user_id: string; email: string | null; role: string }[]).map((r) => ({
        userId: r.user_id,
        email: r.email ?? 'Unknown',
        role: r.role === 'owner' ? 'owner' : 'member',
      }));
    },
  });
  if (isDemoMode) {
    return { members: DEMO_MEMBERS, isLoading: false, isError: false, isOwner: true, refetch: async () => undefined };
  }
  const members = q.data ?? [];
  return {
    members,
    isLoading: q.isPending && !!businessId,
    isError: q.isError,
    isOwner: members.some((m) => m.userId === userId && m.role === 'owner'),
    refetch: q.refetch,
  };
}

/** Owner removes a non-owner member (calls remove_member). Not available in demo mode. */
export function useRemoveMember() {
  const qc = useQueryClient();
  const { businessId } = useBusiness();
  return useMutation<void, Error, { userId: string }>({
    mutationFn: async ({ userId }) => {
      if (isDemoMode || !businessId || businessId === DEMO_BUSINESS_ID) throw new Error('Not available in demo mode');
      const { error } = await supabase.rpc('remove_member', { p_business_id: businessId, p_user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}
