import { useQuery } from '@tanstack/react-query';

import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import type {
  AiListingInput,
  AiListingResult,
  AiPriceInput,
  AiPriceResult,
  AiReceiptInput,
  AiReceiptResult,
} from '@/domain/ai';
import { today } from '@/domain/dates';
import { useBusiness } from './business';

export type { AiListingInput, AiListingResult, AiPriceInput, AiPriceResult, AiReceiptInput, AiReceiptResult };

/** Default daily cap on the server (AI_DAILY_CAP overrides it there). Used only for display. */
export const AI_DEFAULT_DAILY_CAP = 50;

const GENERIC = 'The AI helper could not be reached. Check your signal and try again.';
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Pulls the friendly { error } message out of a failed function call. */
async function friendlyMessage(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = (await (ctx as Response).json()) as { error?: unknown };
      if (typeof body?.error === 'string' && body.error) return body.error;
    } catch {
      // fall through
    }
  }
  return GENERIC;
}

async function invokeAi<T>(action: 'listing' | 'price' | 'receipt', input: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai', { body: { action, ...input } });
  if (error) throw new Error(await friendlyMessage(error));
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

// ---- Demo responses --------------------------------------------------------------------------------------------

const DEMO_LISTING: AiListingResult = {
  title: 'Country Road Womens Linen Blend Shirt Dress Size 10 Sage Green Short Sleeve',
  description:
    'Country Road shirt dress in a soft sage green linen blend. Button-through front, collar, short sleeves and a ' +
    'tie waist. Easy to wear to work or on the weekend, and perfect for spring and summer.\n\n' +
    'Please check before listing:\n[Size: confirm on the tag]\n[Brand: confirm]\n' +
    '[Condition: describe any wear, marks or flaws]\n[Measurements: pit to pit, length]\n\n' +
    'Posted from Australia. Smoke-free home.',
  keywords: ['country road', 'shirt dress', 'linen blend', 'womens dress', 'size 10', 'sage green', 'summer dress'],
};

const DEMO_PRICE: AiPriceResult = {
  low: 28,
  high: 45,
  suggested: 38,
  reasoning:
    'Your similar dresses sold between about $30 and $42 and most went within three weeks. ' +
    'Start near $38 and drop toward $30 if it has not sold in two weeks.',
};

const DEMO_RECEIPT: AiReceiptResult = {
  shop: 'Salvos Stores',
  date: today(),
  total: 31.5,
  lines: [
    { description: "Women's dress", qty: 1, price: 8 },
    { description: 'Jumper', qty: 1, price: 6.5 },
    { description: "Men's shirts", qty: 3, price: 12 },
    { description: 'Scarf', qty: 1, price: 5 },
  ],
};

// ---- Actions ---------------------------------------------------------------------------------------------------

/** Writes a listing (title, description, keywords) from photos in storage. Throws Error with a friendly message. */
export async function aiListing(input: AiListingInput): Promise<AiListingResult> {
  if (isDemoMode) {
    await delay(1200);
    return DEMO_LISTING;
  }
  return invokeAi<AiListingResult>('listing', input);
}

/** Suggests a listing price range in AUD from the item facts and her own comparable sales. */
export async function aiPrice(input: AiPriceInput): Promise<AiPriceResult> {
  if (isDemoMode) {
    await delay(900);
    return DEMO_PRICE;
  }
  return invokeAi<AiPriceResult>('price', input);
}

/** Reads a receipt photo (storage path) into shop, date, total and lines. */
export async function aiReceipt(input: AiReceiptInput): Promise<AiReceiptResult> {
  if (isDemoMode) {
    await delay(1500);
    return DEMO_RECEIPT;
  }
  return invokeAi<AiReceiptResult>('receipt', input);
}

// ---- Usage -----------------------------------------------------------------------------------------------------

export const aiUsageKey = (businessId: string | null, day: string) => ['ai-usage', businessId, day] as const;

export interface AiUsageState {
  /** calls used today (Australia/Sydney day) */
  used: number;
  /** the usual daily cap; the server's AI_DAILY_CAP may differ, so treat the 429 message as the truth */
  cap: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

/** How many AI helpers the business has used today. Invalidate ['ai-usage'] after each call to refresh. */
export function useAiUsageToday(): AiUsageState {
  const { businessId } = useBusiness();
  const day = today();
  const q = useQuery({
    queryKey: aiUsageKey(businessId, day),
    enabled: !isDemoMode && !!businessId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('ai_usage')
        .select('calls')
        .eq('business_id', businessId as string)
        .eq('day', day)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.calls as number | undefined) ?? 0;
    },
  });
  if (isDemoMode) {
    return { used: 3, cap: AI_DEFAULT_DAILY_CAP, isLoading: false, isError: false, refetch: async () => undefined };
  }
  return { used: q.data ?? 0, cap: AI_DEFAULT_DAILY_CAP, isLoading: q.isPending && !!businessId, isError: q.isError, refetch: q.refetch };
}

