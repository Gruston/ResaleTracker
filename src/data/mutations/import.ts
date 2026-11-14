import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { BusinessData, Shop } from '@/domain/types';
import {
  buildBatch,
  runImport,
  skuNeeds,
  type ImportProgress,
  type ImportResult,
  type PlannedRow,
  type SkuReservation,
} from '@/features/more/importMap';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { businessKey, emptyBusinessData, useBusiness } from '../business';
import { demoStore } from '../demo-store';
import { formatSku } from '@/domain/sku';
import { itemToRow, orderItemToRow, orderToRow, shopToRow } from '../mappers';
import { check, unwrap } from './helpers';

export interface ImportSalesInput {
  /** From planRows(): rows already checked and planned. */
  plans: PlannedRow[];
  /** Called after each batch of 50 (and after each row when a batch is retried row by row). */
  onProgress?: (p: ImportProgress) => void;
  /** Checked between batches; return true to stop. Rows not yet saved come back in `failed`. */
  shouldStop?: () => boolean;
}

export type { ImportProgress, ImportResult };

/** Delete best-effort; used only to undo a half-saved batch. */
async function undo(orderIds: string[], itemIds: string[]) {
  try {
    await supabase.from('orders').delete().in('id', orderIds);
    await supabase.from('items').delete().in('id', itemIds);
  } catch {
    /* nothing more we can do */
  }
}

/**
 * Loads past sales (items already 'posted' with posted date = sold date) in batches of 50.
 * Per batch: reserve SKUs (one next_skus call per prefix), then insert items, orders and order_items.
 * Missing shops are created once, before the first batch. The business data is refreshed once at the end.
 * Resolves with ImportResult; row errors are in `failed`, not thrown. Demo mode uses the in-memory store.
 */
export function useImportSales() {
  const qc = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation<ImportResult, Error, ImportSalesInput>({
    mutationFn: async ({ plans, onProgress, shouldStop }) => {
      if (isDemoMode) {
        return runImport(plans, {
          onProgress,
          shouldStop,
          createShops: async (names) => {
            const ids = new Map<string, string>();
            demoStore.mutate((draft) => {
              for (const name of names) {
                const existing = draft.shops.find((s) => s.name.trim().toLowerCase() === name.toLowerCase());
                const shop: Shop = existing ?? { id: uuid(), name, kind: 'shop', archived: false };
                if (!existing) draft.shops.push(shop);
                ids.set(name.toLowerCase(), shop.id);
              }
            });
            return ids;
          },
          saveBatch: async (rows, shopIds) => {
            demoStore.mutate((draft) => {
              // Reserve in the store: continue from the highest number for each prefix.
              const reserved = new Map<string, SkuReservation[]>();
              for (const [prefix, count] of skuNeeds(rows, draft.skuCodes)) {
                const last = Math.max(0, ...draft.items.filter((i) => i.skuPrefix === prefix).map((i) => i.skuNumber));
                reserved.set(
                  prefix,
                  Array.from({ length: count }, (_, k) => ({ sku: formatSku(prefix, last + k + 1), sku_number: last + k + 1 })),
                );
              }
              const built = buildBatch(rows, reserved, shopIds, draft.settings, draft.skuCodes);
              for (const b of built) {
                draft.items.push(b.item);
                draft.orders.unshift(b.order);
              }
            });
          },
        }).finally(() => qc.invalidateQueries({ queryKey: ['business'] }));
      }

      if (!businessId) throw new Error('No business yet');
      const data = qc.getQueryData<BusinessData>(businessKey(businessId)) ?? emptyBusinessData(businessId);
      const { settings, skuCodes } = data;

      try {
        return await runImport(plans, {
          onProgress,
          shouldStop,
          createShops: async (names) => {
            const ids = new Map<string, string>();
            const rows: Shop[] = [];
            for (const name of names) {
              const existing = data.shops.find((s) => s.name.trim().toLowerCase() === name.toLowerCase());
              const shop: Shop = existing ?? { id: uuid(), name, kind: 'shop', archived: false };
              if (!existing) rows.push(shop);
              ids.set(name.toLowerCase(), shop.id);
            }
            if (rows.length) check(await supabase.from('shops').insert(rows.map((s) => shopToRow(businessId, s))));
            return ids;
          },
          saveBatch: async (rows, shopIds) => {
            const needs = [...skuNeeds(rows, skuCodes)];
            const results = await Promise.all(
              needs.map(async ([prefix, count]) => {
                const res = await supabase.rpc('next_skus', { p_business_id: businessId, p_prefix: prefix, p_count: count });
                const list = unwrap(res) as SkuReservation[];
                if (!list || list.length < count) throw new Error('Could not reserve SKUs');
                return [prefix, [...list].sort((a, b) => a.sku_number - b.sku_number)] as const;
              }),
            );
            const built = buildBatch(rows, new Map(results), shopIds, settings, skuCodes);
            const itemIds = built.map((b) => b.item.id);
            const orderIds = built.map((b) => b.order.id);
            try {
              check(await supabase.from('items').insert(built.map((b) => itemToRow(businessId, b.item))));
              check(await supabase.from('orders').insert(built.map((b) => {
                const { items: _items, ...row } = b.order;
                return orderToRow(businessId, row);
              })));
              check(
                await supabase
                  .from('order_items')
                  .insert(built.flatMap((b) => b.order.items.map((oi) => orderItemToRow(businessId, b.order.id, oi)))),
              );
            } catch (e) {
              await undo(orderIds, itemIds);
              throw e;
            }
          },
        });
      } finally {
        qc.invalidateQueries({ queryKey: ['business'] });
      }
    },
  });
}
