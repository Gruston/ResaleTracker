import type { BusinessData, Channel, Department, Item, ItemPhoto, ItemStatus } from '@/domain/types';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { skuPrefix } from '../domain';
import { itemPatchToRow, itemToRow } from '../mappers';
import { check, nextSort, unwrap, useBizMutation } from './helpers';

export interface NewItemInput {
  title: string;
  brand: string;
  department: Department;
  itemType: string;
  size: string;
  description: string;
  shopId: string | null;
  tripId: string | null;
  /** When set, that receipt line becomes outcome 'listed' and points at the new item. */
  tripLineId: string | null;
  purchaseDate: string | null;
  cost: number | null; // null = unknown, 0 = own wardrobe
  onlineOrderNo?: string | null;
  /** default: 'listed' if listedDate is set, else 'draft' */
  status?: ItemStatus;
  listedDate?: string | null;
  firstListPrice?: number | null;
  adRate?: number | null;
  channel?: Channel;
  ebayListingId?: string | null;
}

export interface CreateItemInput {
  item: NewItemInput;
  /** Storage paths from uploadImage(), in display order. */
  photoPaths?: string[];
}

function buildItem(input: NewItemInput, sku: string, skuPrefixStr: string, skuNumber: number): Item {
  return {
    id: uuid(),
    sku,
    skuPrefix: skuPrefixStr,
    skuNumber,
    title: input.title,
    brand: input.brand,
    department: input.department,
    itemType: input.itemType,
    size: input.size,
    description: input.description,
    shopId: input.shopId,
    tripId: input.tripId,
    tripLineId: input.tripLineId,
    purchaseDate: input.purchaseDate,
    cost: input.cost,
    onlineOrderNo: input.onlineOrderNo ?? null,
    status: input.status ?? (input.listedDate ? 'listed' : 'draft'),
    listedDate: input.listedDate ?? null,
    firstListPrice: input.firstListPrice ?? null,
    adRate: input.adRate ?? null,
    channel: input.channel ?? 'ebay',
    ebayListingId: input.ebayListingId ?? null,
    photos: [],
  };
}

function formatSku(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

function photosFor(paths: string[] | undefined): ItemPhoto[] {
  return (paths ?? []).map((path, i) => ({ id: uuid(), path, sort: i }));
}

/**
 * Creates an item: reserves the next SKU (rpc next_sku with prefix = department code + item type code),
 * inserts the item and its photos, and when tripLineId is set marks that receipt line 'listed' and links it.
 * Resolves with the new item.
 */
export function useCreateItem() {
  return useBizMutation<CreateItemInput, Item>(
    async ({ businessId, data }, { item: input, photoPaths }) => {
      const prefix = skuPrefix(input.department, input.itemType, data.skuCodes);
      const res = await supabase.rpc('next_sku', { p_business_id: businessId, p_prefix: prefix });
      const rows = unwrap(res) as { sku: string; sku_number: number } | { sku: string; sku_number: number }[];
      const first = Array.isArray(rows) ? rows[0] : rows;
      if (!first) throw new Error('Could not reserve a SKU');
      const item = buildItem(input, first.sku, prefix, first.sku_number);
      check(await supabase.from('items').insert(itemToRow(businessId, item)));
      const photos = photosFor(photoPaths);
      if (photos.length) {
        check(
          await supabase
            .from('item_photos')
            .insert(photos.map((p) => ({ id: p.id, business_id: businessId, item_id: item.id, path: p.path, sort: p.sort }))),
        );
      }
      if (input.tripLineId) {
        check(
          await supabase
            .from('trip_lines')
            .update({ outcome: 'listed', item_id: item.id })
            .eq('id', input.tripLineId),
        );
      }
      return { ...item, photos };
    },
    (draft, { item: input, photoPaths }) => {
      const prefix = skuPrefix(input.department, input.itemType, draft.skuCodes);
      const n = Math.max(0, ...draft.items.filter((i) => i.skuPrefix === prefix).map((i) => i.skuNumber)) + 1;
      const item = buildItem(input, formatSku(prefix, n), prefix, n);
      item.photos = photosFor(photoPaths);
      draft.items.push(item);
      if (input.tripLineId) linkLine(draft, input.tripLineId, item.id);
      return item;
    },
  );
}

function linkLine(draft: BusinessData, lineId: string, itemId: string) {
  for (const t of draft.trips) {
    const l = t.lines.find((x) => x.id === lineId);
    if (l) {
      l.outcome = 'listed';
      l.itemId = itemId;
    }
  }
}

export type ItemPatch = Partial<Omit<Item, 'id' | 'photos' | 'sku' | 'skuPrefix' | 'skuNumber'>>;

/** Edit any item fields (SKU and photos are changed elsewhere). */
export function useUpdateItem() {
  return useBizMutation<{ id: string; patch: ItemPatch }, void>(
    async (_ctx, { id, patch }) => {
      const row = itemPatchToRow(patch);
      if (Object.keys(row).length) check(await supabase.from('items').update(row).eq('id', id));
    },
    (draft, { id, patch }) => {
      const it = draft.items.find((x) => x.id === id);
      if (it) Object.assign(it, patch);
    },
  );
}

/** Deletes an item, its photos and sale rows. Its receipt line goes back to 'to_list'. */
export function useDeleteItem() {
  return useBizMutation<string, void>(
    async ({ data }, id) => {
      const paths = data.items.find((i) => i.id === id)?.photos.map((p) => p.path) ?? [];
      check(await supabase.from('trip_lines').update({ outcome: 'to_list', item_id: null }).eq('item_id', id));
      check(await supabase.from('items').delete().eq('id', id));
      if (paths.length) await supabase.storage.from('photos').remove(paths).catch(() => undefined);
    },
    (draft, id) => {
      draft.items = draft.items.filter((i) => i.id !== id);
      for (const t of draft.trips) {
        for (const l of t.lines) {
          if (l.itemId === id) {
            l.itemId = null;
            l.outcome = 'to_list';
          }
        }
      }
      for (const o of draft.orders) o.items = o.items.filter((x) => x.itemId !== id);
      draft.orders = draft.orders.filter((o) => o.items.length > 0);
      draft.returns = draft.returns.filter((r) => r.itemId !== id);
    },
  );
}

export function useAddItemPhoto() {
  return useBizMutation<{ itemId: string; path: string }, ItemPhoto>(
    async ({ businessId, data }, { itemId, path }) => {
      const existing = data.items.find((i) => i.id === itemId)?.photos ?? [];
      const photo: ItemPhoto = { id: uuid(), path, sort: nextSort(existing.map((p) => p.sort)) };
      check(
        await supabase
          .from('item_photos')
          .insert({ id: photo.id, business_id: businessId, item_id: itemId, path, sort: photo.sort }),
      );
      return photo;
    },
    (draft, { itemId, path }) => {
      const it = draft.items.find((i) => i.id === itemId);
      if (!it) throw new Error('Item not found');
      const photo: ItemPhoto = { id: uuid(), path, sort: nextSort(it.photos.map((p) => p.sort)) };
      it.photos.push(photo);
      return photo;
    },
  );
}

export function useRemoveItemPhoto() {
  return useBizMutation<{ itemId: string; photoId: string }, void>(
    async ({ data }, { itemId, photoId }) => {
      const path = data.items.find((i) => i.id === itemId)?.photos.find((p) => p.id === photoId)?.path;
      check(await supabase.from('item_photos').delete().eq('id', photoId));
      if (path && !isDemoMode) await supabase.storage.from('photos').remove([path]).catch(() => undefined);
    },
    (draft, { itemId, photoId }) => {
      const it = draft.items.find((i) => i.id === itemId);
      if (it) it.photos = it.photos.filter((p) => p.id !== photoId);
    },
  );
}
