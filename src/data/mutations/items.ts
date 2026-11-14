import type { BusinessData, Channel, Department, Item, ItemPhoto, ItemStatus } from '@/domain/types';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { skuPrefix } from '../domain';
import { itemPatchToRow, itemToRow } from '../mappers';
import { PENDING_SKU_TEXT } from '../offlineLogic';
import { check, defineBizMutation, nextSort, unwrap } from './helpers';

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

function buildItem(id: string, input: NewItemInput, sku: string, skuPrefixStr: string, skuNumber: number): Item {
  return {
    id,
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

interface CreateItemPrep {
  id: string;
  prefix: string;
  photos: ItemPhoto[];
}

/** SKUs already reserved by a try that may have succeeded without us hearing (so a retry does not burn another number). */
const reservedSkus = new Map<string, { sku: string; sku_number: number }>();

/**
 * Creates an item: reserves the next SKU (rpc next_sku with prefix = department code + item type code),
 * inserts the item and its photos, and when tripLineId is set marks that receipt line 'listed' and links it.
 * Resolves with the new item.
 *
 * Offline the SKU cannot be reserved (the numbers come from the server), so the item shows PENDING_SKU_TEXT in place
 * of its SKU and gets the real one when the change is sent.
 */
export const useCreateItem = defineBizMutation<CreateItemInput, Item, CreateItemPrep>({
  key: 'createItem',
  prepare: (data, { item, photoPaths }) => ({
    id: uuid(),
    prefix: skuPrefix(item.department, item.itemType, data.skuCodes),
    photos: photosFor(photoPaths),
  }),
  remote: async ({ businessId }, { item: input }, { id, prefix, photos }) => {
    let sku = reservedSkus.get(id);
    if (!sku) {
      const res = await supabase.rpc('next_sku', { p_business_id: businessId, p_prefix: prefix });
      const rows = unwrap(res) as { sku: string; sku_number: number } | { sku: string; sku_number: number }[];
      const first = Array.isArray(rows) ? rows[0] : rows;
      if (!first) throw new Error('Could not reserve a SKU');
      sku = first;
      reservedSkus.set(id, sku);
    }
    const item = buildItem(id, input, sku.sku, prefix, sku.sku_number);
    check(await supabase.from('items').upsert(itemToRow(businessId, item)));
    if (photos.length) {
      check(
        await supabase
          .from('item_photos')
          .upsert(photos.map((p) => ({ id: p.id, business_id: businessId, item_id: item.id, path: p.path, sort: p.sort }))),
      );
    }
    if (input.tripLineId) {
      check(await supabase.from('trip_lines').update({ outcome: 'listed', item_id: item.id }).eq('id', input.tripLineId));
    }
    reservedSkus.delete(id);
    return { ...item, photos };
  },
  apply: (draft, { item: input }, { id, prefix, photos }) => {
    const n = Math.max(0, ...draft.items.filter((i) => i.skuPrefix === prefix).map((i) => i.skuNumber)) + 1;
    const item = buildItem(id, input, formatSku(prefix, n), prefix, n);
    item.photos = photos;
    draft.items.push(item);
    if (input.tripLineId) linkLine(draft, input.tripLineId, item.id);
    return item;
  },
  applyOffline: (draft, { item: input }, { id, prefix, photos }) => {
    const item = buildItem(id, input, PENDING_SKU_TEXT, prefix, 0);
    item.photos = photos;
    draft.items.push(item);
    if (input.tripLineId) linkLine(draft, input.tripLineId, item.id);
    return item;
  },
});

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
export const useUpdateItem = defineBizMutation<{ id: string; patch: ItemPatch }, void>({
  key: 'updateItem',
  remote: async (_ctx, { id, patch }) => {
    const row = itemPatchToRow(patch);
    if (Object.keys(row).length) check(await supabase.from('items').update(row).eq('id', id));
  },
  apply: (draft, { id, patch }) => {
    const it = draft.items.find((x) => x.id === id);
    if (it) Object.assign(it, patch);
  },
});

/** Deletes an item, its photos and sale rows. Its receipt line goes back to 'to_list'. */
export const useDeleteItem = defineBizMutation<string, void, string[]>({
  key: 'deleteItem',
  prepare: (data, id) => data.items.find((i) => i.id === id)?.photos.map((p) => p.path) ?? [],
  remote: async (_ctx, id, paths) => {
    check(await supabase.from('trip_lines').update({ outcome: 'to_list', item_id: null }).eq('item_id', id));
    check(await supabase.from('items').delete().eq('id', id));
    if (paths.length) await supabase.storage.from('photos').remove(paths).catch(() => undefined);
  },
  apply: (draft, id) => {
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
});

export const useAddItemPhoto = defineBizMutation<{ itemId: string; path: string }, ItemPhoto, ItemPhoto>({
  key: 'addItemPhoto',
  prepare: (data, { itemId, path }) => {
    const it = data.items.find((i) => i.id === itemId);
    if (!it) throw new Error('Item not found');
    return { id: uuid(), path, sort: nextSort(it.photos.map((p) => p.sort)) };
  },
  remote: async ({ businessId }, { itemId }, photo) => {
    check(
      await supabase
        .from('item_photos')
        .upsert({ id: photo.id, business_id: businessId, item_id: itemId, path: photo.path, sort: photo.sort }),
    );
    return photo;
  },
  apply: (draft, { itemId }, photo) => {
    const it = draft.items.find((i) => i.id === itemId);
    if (!it) throw new Error('Item not found');
    it.photos.push(photo);
    return photo;
  },
});

export const useRemoveItemPhoto = defineBizMutation<{ itemId: string; photoId: string }, void, string | null>({
  key: 'removeItemPhoto',
  prepare: (data, { itemId, photoId }) =>
    data.items.find((i) => i.id === itemId)?.photos.find((p) => p.id === photoId)?.path ?? null,
  remote: async (_ctx, { photoId }, path) => {
    check(await supabase.from('item_photos').delete().eq('id', photoId));
    if (path && !isDemoMode) await supabase.storage.from('photos').remove([path]).catch(() => undefined);
  },
  apply: (draft, { itemId, photoId }) => {
    const it = draft.items.find((i) => i.id === itemId);
    if (it) it.photos = it.photos.filter((p) => p.id !== photoId);
  },
});
