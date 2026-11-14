import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { PERSIST_KEY } from './QueryProvider';

export interface SessionState {
  session: Session | null;
  userId: string | null;
  email: string | null;
  /** true until the stored session has been read */
  loading: boolean;
  /** true when running without a backend (sample data, no sign-in) */
  demo: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<SessionState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (isDemoMode) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!isDemoMode) await supabase.auth.signOut();
    qc.clear();
    await AsyncStorage.removeItem(PERSIST_KEY);
  }, [qc]);

  const value = useMemo<SessionState>(
    () => ({
      session,
      userId: isDemoMode ? 'demo-user' : (session?.user.id ?? null),
      email: isDemoMode ? 'demo@example.com' : (session?.user.email ?? null),
      loading,
      demo: isDemoMode,
      signOut,
    }),
    [session, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSession must be used inside <AuthProvider>');
  return ctx;
}

/** Step 1 of sign-in: emails a one-time code (creates the account on first use). */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Step 2 of sign-in: checks the code from the email. The session arrives via onAuthStateChange. */
export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  if (error) throw error;
}

/** Calls the create_business RPC and refreshes membership. Resolves with the new business id. */
export function useCreateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<string> => {
      const { data, error } = await supabase.rpc('create_business', { p_name: name.trim() });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['membership'] }),
  });
}
