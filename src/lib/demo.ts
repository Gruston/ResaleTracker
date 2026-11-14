import { DEMO_BUSINESS_ID } from './demo-id';
import { isSupabaseConfigured } from './supabase';

/** Demo mode: no backend; all data is an in-memory sample set (see src/data/demo-store.ts). */
export const isDemoMode: boolean = !isSupabaseConfigured || process.env.EXPO_PUBLIC_DEMO === '1';
export { DEMO_BUSINESS_ID };
