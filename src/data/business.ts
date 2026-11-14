import { useQuery } from '@tanstack/react-query';

import type { BusinessData } from '@/domain/types';
import { DEMO_BUSINESS_ID, isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { useSession } from './auth';
import { demoStore } from './demo-store';
import {
  expenseFromRow,
  itemFromRow,
  itemPhotoFromRow,
  orderFromRow,
  orderItemFromRow,
  returnFromRow,
  settingsFromRow,
  shopFromRow,
  skuCodeFromRow,
  storageFromRow,
  tripFromRow,
  tripLineFromRow,
  type Row,
} from './mappers';

export const businessKey = (businessId: string | null) => ['business', businessId] as const;

export function emptyBusinessData(businessId = ''): BusinessData {
  return {
    settings: {
      businessId,
      protectionFixed: 0.3,
      defaultAdRate: 3,
      adFeeBase: 'item',
      defaultLabelCost: 12.5,
    },
    skuCodes: [],
    storage: [],
    shops: [],
    trips: [],
    items: [],
    orders: [],
    returns: [],
    expenses: [],
  };
}

export interface BusinessState {
  /** null while unknown or when the user has no business yet */
  businessId: string | null;
  /** true while the membership lookup has no answer at all (first load) */
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

/** The signed-in user's business (first membership). Demo mode: a fixed id. */
export function useBusiness(): BusinessState {
  const { userId, loading } = useSession();
  const q = useQuery({
    queryKey: ['membership', userId],
    enabled: !isDemoMode && !!userId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('business_members')
        .select('business_id, created_at')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0]?.business_id as string | undefined) ?? null;
    },
  });
  if (isDemoMode) {
    return { businessId: DEMO_BUSINESS_ID, isLoading: false, isError: false, refetch: async () => undefined };
  }
  return {
    businessId: q.data ?? null,
    isLoading: loading || (!!userId && q.isPending),
    isError: q.isError,
    refetch: q.refetch,
  };
}

const PAGE = 1000;

async function selectAll(table: string, businessId: string, orderBy: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('business_id', businessId)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export async function loadBusiness(businessId: string): Promise<BusinessData> {
  const [settings, skuCodes, storage, shops, trips, lines, items, photos, orders, orderItems, returns, expenses] =
    await Promise.all([
      supabase.from('business_settings').select('*').eq('business_id', businessId).maybeSingle(),
      selectAll('sku_codes', businessId, 'sort'),
      selectAll('storage_locations', businessId, 'prefix'),
      selectAll('shops', businessId, 'name'),
      selectAll('trips', businessId, 'trip_date'),
      selectAll('trip_lines', businessId, 'sort'),
      selectAll('items', businessId, 'sku'),
      selectAll('item_photos', businessId, 'sort'),
      selectAll('orders', businessId, 'sold_date'),
      selectAll('order_items', businessId, 'order_id'),
      selectAll('returns', businessId, 'return_date'),
      selectAll('expenses', businessId, 'expense_date'),
    ]);
  if (settings.error) throw settings.error;

  const linesByTrip = groupBy(lines.map(tripLineFromRow), (l) => l.tripId);
  const photosByItem = groupBy(
    photos.map((p) => ({ itemId: p.item_id as string, photo: itemPhotoFromRow(p) })),
    (p) => p.itemId,
  );
  const orderItemsByOrder = groupBy(
    orderItems.map((r) => ({ orderId: r.order_id as string, oi: orderItemFromRow(r) })),
    (x) => x.orderId,
  );

  const base = emptyBusinessData(businessId);
  return {
    settings: settings.data ? settingsFromRow(settings.data as Row) : base.settings,
    skuCodes: skuCodes.map(skuCodeFromRow),
    storage: storage.map(storageFromRow),
    shops: shops.map(shopFromRow),
    trips: trips
      .map((t) => tripFromRow(t, linesByTrip.get(t.id as string) ?? []))
      .sort((a, b) => (a.tripDate < b.tripDate ? 1 : a.tripDate > b.tripDate ? -1 : 0)),
    items: items.map((i) => itemFromRow(i, (photosByItem.get(i.id as string) ?? []).map((p) => p.photo))),
    orders: orders
      .map((o) => orderFromRow(o, (orderItemsByOrder.get(o.id as string) ?? []).map((x) => x.oi)))
      .sort((a, b) => (a.soldDate < b.soldDate ? 1 : a.soldDate > b.soldDate ? -1 : 0)),
    returns: returns.map(returnFromRow),
    expenses: expenses
      .map(expenseFromRow)
      .sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : a.expenseDate > b.expenseDate ? -1 : 0)),
  };
}

export interface BusinessDataResult {
  /** Always defined: an empty business while nothing has loaded yet. */
  data: BusinessData;
  /** true until the first successful load (cached data counts as loaded) */
  isLoading: boolean;
  isRefetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

/** The whole business in one query. Key: ['business', businessId]. Persisted for offline reading. */
export function useBusinessData(): BusinessDataResult {
  const { businessId } = useBusiness();
  const q = useQuery({
    queryKey: businessKey(businessId),
    enabled: !!businessId,
    queryFn: async (): Promise<BusinessData> =>
      isDemoMode ? demoStore.get() : loadBusiness(businessId as string),
  });
  return {
    data: q.data ?? emptyBusinessData(businessId ?? ''),
    isLoading: !!businessId && q.isPending,
    isRefetching: q.isRefetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}
