// Pure helpers for the items list: search, status filter, item-type filter, sorting, row text.
import { daysBetween } from '../../domain/dates';
import { itemProfit } from '../../domain/money';
import { salesByItem, type ItemSale } from '../../domain/orders';
import type { BusinessData, Item, ItemStatus } from '../../domain/types';

export const STATUS_FILTERS = ['All', 'Draft', 'Listed', 'Sold', 'To post', 'Returned', 'Faulty'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export type SortKey = 'az' | 'new' | 'price' | 'age';
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'az', label: 'A–Z' },
  { value: 'new', label: 'Newest' },
  { value: 'price', label: 'Price' },
  { value: 'age', label: 'Longest listed' },
];

export const ALL_TYPES = 'All item types';

/** One item with the extra facts the list needs (shop name, live sale). */
export interface ListEntry {
  item: Item;
  shopName: string;
  sale: ItemSale | null;
}

/** Route param (any case, e.g. "to post") -> a known filter; anything else is 'All'. */
export function parseStatusFilter(raw: string | string[] | undefined): StatusFilter {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (!v) return 'All';
  if (v === 'posted') return 'Sold';
  return STATUS_FILTERS.find((f) => f.toLowerCase() === v) ?? 'All';
}

/** "Sold" = sold + posted; "To post" = sold (waiting to post). */
export function statusMatches(filter: StatusFilter, status: ItemStatus): boolean {
  switch (filter) {
    case 'All':
      return true;
    case 'Draft':
      return status === 'draft';
    case 'Listed':
      return status === 'listed';
    case 'Sold':
      return status === 'sold' || status === 'posted';
    case 'To post':
      return status === 'sold';
    case 'Returned':
      return status === 'returned';
    case 'Faulty':
      return status === 'faulty';
  }
}

export function buildEntries(data: Pick<BusinessData, 'items' | 'shops' | 'orders' | 'returns'>): ListEntry[] {
  const shops = new Map(data.shops.map((s) => [s.id, s.name]));
  const sales = salesByItem(data);
  return data.items.map((item) => ({
    item,
    shopName: item.shopId ? (shops.get(item.shopId) ?? '') : '',
    sale: sales.get(item.id) ?? null,
  }));
}

function fields(e: ListEntry): string[] {
  const i = e.item;
  return [
    i.title,
    i.brand,
    i.sku,
    i.itemType,
    i.size,
    i.department,
    e.shopName,
    i.onlineOrderNo ?? '',
    e.sale?.order.orderNo ?? '',
    e.sale?.order.trackingNo ?? '',
  ].map((v) => v.toLowerCase());
}

/**
 * Search across title, brand, SKU, item type, size, department, shop name, online order no., eBay order no. and
 * tracking no. Every word must match somewhere ("gorman skirt"). "size 10" matches size 10 exactly.
 */
export function matchesQuery(entry: ListEntry, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields(entry);
  const size = entry.item.size.trim().toLowerCase();
  for (let k = 0; k < words.length; k++) {
    if (words[k] === 'size' && k + 1 < words.length) {
      if (size !== words[k + 1]) return false;
      k++;
      continue;
    }
    if (!hay.some((f) => f.includes(words[k]))) return false;
  }
  return true;
}

export interface ListFilter {
  q: string;
  status: StatusFilter;
  /** ALL_TYPES or an item type */
  itemType: string;
}

export function filterEntries(entries: ListEntry[], f: ListFilter): ListEntry[] {
  return entries.filter(
    (e) =>
      statusMatches(f.status, e.item.status) &&
      (f.itemType === ALL_TYPES || e.item.itemType === f.itemType) &&
      matchesQuery(e, f.q),
  );
}

/** "Brand Title", without repeating the brand when the title already contains it. */
export function displayName(item: Pick<Item, 'brand' | 'title'>): string {
  const brand = item.brand.trim();
  const title = item.title.trim();
  if (!brand) return title;
  if (title.toLowerCase().includes(brand.toLowerCase())) return title;
  return `${brand} ${title}`.trim();
}

export function sortEntries(entries: ListEntry[], key: SortKey): ListEntry[] {
  const byName = (a: ListEntry, b: ListEntry) =>
    displayName(a.item).localeCompare(displayName(b.item)) || a.item.sku.localeCompare(b.item.sku);
  const sorters: Record<SortKey, (a: ListEntry, b: ListEntry) => number> = {
    az: byName,
    // newest listed first; never-listed last
    new: (a, b) => (b.item.listedDate ?? '').localeCompare(a.item.listedDate ?? '') || byName(a, b),
    price: (a, b) => (b.item.firstListPrice ?? 0) - (a.item.firstListPrice ?? 0) || byName(a, b),
    // oldest listing date first; never-listed last
    age: (a, b) => (a.item.listedDate ?? '9').localeCompare(b.item.listedDate ?? '9') || byName(a, b),
  };
  return [...entries].sort(sorters[key]);
}

/** Distinct item types in use, A–Z. */
export function itemTypesPresent(items: Pick<Item, 'itemType'>[]): string[] {
  return [...new Set(items.map((i) => i.itemType).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** "WD-012 · Women 10" */
export function rowSubtitle(item: Pick<Item, 'sku' | 'department' | 'size'>): string {
  return `${item.sku} · ${[item.department, item.size].filter(Boolean).join(' ')}`;
}

export interface RowRight {
  value: string;
  sub: string;
  /** true when value is a profit figure */
  profit: boolean;
}

/** Right-hand side of a list row: profit for sold items, else list price and days listed. */
export function rowRight(e: ListEntry, todayStr: string, fmt: (n: number) => string): RowRight | null {
  const { item, sale } = e;
  if (sale && item.status !== 'returned' && item.status !== 'faulty') {
    return { value: fmt(itemProfit(item, sale.orderItem)), sub: 'profit', profit: true };
  }
  if (item.firstListPrice != null && item.firstListPrice > 0) {
    let sub = 'not listed';
    if (item.listedDate) {
      const n = Math.max(0, daysBetween(item.listedDate, todayStr));
      sub = `${n} ${n === 1 ? 'day' : 'days'}`;
    }
    return { value: fmt(item.firstListPrice), sub, profit: false };
  }
  return null;
}
