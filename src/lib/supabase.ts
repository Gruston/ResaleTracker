import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Kat's project. Both values are public by design (the publishable key is limited by row level
// security); a .env file can override them, e.g. for a test project.
const DEFAULT_URL = 'https://ltinycshcydsjtytchbu.supabase.co';
const DEFAULT_KEY = 'sb_publishable_SyYWOg1bLwg_AVQg8ZhIbg_bNS0F3E9';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY || DEFAULT_KEY;

export const isSupabaseConfigured = url.startsWith('https://') && key.length > 0;

export const supabase = createClient(url || 'https://not-configured.invalid', key || 'missing', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
