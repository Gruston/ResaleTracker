// Pure helpers for the add/edit item form.
import { skuPrefix } from '../../domain/sku';
import type { Department, Item, ItemStatus, Settings, Shop, SkuCode } from '../../domain/types';
import type { ItemPatch, NewItemInput } from '../../data/mutations/items';

export const TITLE_MAX = 80;
export const DEPARTMENTS: Department[] = ['Women', 'Men', 'Kids', 'Unisex'];

export interface PhotoDraft {
  /** Existing photo row id, or a temporary key for a newly picked photo */
  key: string;
  /** Storage path (existing) or local file uri (new, uploaded on save) */
  path: string;
  existing: boolean;
}

export interface ItemFormState {
  brand: string;
  department: Department;
  itemType: string;
  size: string;
  shopId: string | null;
  costText: string;
  title: string;
  description: string;
  priceText: string;
  adText: string;
  /** '' = default to today when there is a price */
  listedDate: string;
  photos: PhotoDraft[];
}

export interface ItemFormErrors {
  cost?: string;
  price?: string;
  ad?: string;
  listedDate?: string;
}

/** "$12.50", "1,200", " 8 " -> number; blank or invalid -> null. Negative is invalid. */
export function parseMoney(text: string): number | null {
  const t = text.replace(/[$,\s]/g, '');
  if (!t || !/^\d*\.?\d+$|^\d+\.?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isWardrobe(shops: Shop[], shopId: string | null): boolean {
  return !!shopId && shops.find((s) => s.id === shopId)?.kind === 'wardrobe';
}

/** Item types (from the SKU codes), in the order Kat set them. */
export function itemTypeOptions(codes: SkuCode[]): string[] {
  return codes
    .filter((c) => c.kind === 'item_type')
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
    .map((c) => c.label);
}

/** "WD-0xx": the number is assigned when the item is saved. */
export function skuPreview(department: Department, itemType: string, codes: SkuCode[]): string {
  return `${skuPrefix(department, itemType, codes)}-0xx`;
}

export function validateForm(s: ItemFormState): ItemFormErrors {
  const e: ItemFormErrors = {};
  if (s.costText.trim() && parseMoney(s.costText) == null) e.cost = 'Enter an amount like 12.50';
  const price = s.priceText.trim() ? parseMoney(s.priceText) : null;
  if (s.priceText.trim() && (price == null || price <= 0)) e.price = 'Enter a price like 45';
  if (s.adText.trim()) {
    const ad = parseMoney(s.adText);
    if (ad == null || ad > 100) e.ad = 'Enter a percentage from 0 to 100';
  }
  if (s.listedDate.trim() && !isValidDate(s.listedDate.trim())) e.listedDate = 'Use the format YYYY-MM-DD';
  return e;
}

export function hasErrors(e: ItemFormErrors): boolean {
  return Object.keys(e).length > 0;
}

/** The figures that will be saved for the pricing part of the form. */
export function pricing(s: ItemFormState, settings: Settings, todayStr: string) {
  const price = parseMoney(s.priceText);
  const hasPrice = price != null && price > 0;
  const ad = parseMoney(s.adText) ?? settings.defaultAdRate;
  return {
    hasPrice,
    firstListPrice: hasPrice ? price : null,
    adRate: ad,
    listedDate: hasPrice ? s.listedDate.trim() || todayStr : null,
  };
}

/** The cost to save: 0 for My wardrobe, else the typed amount (blank = unknown). */
export function costFor(s: ItemFormState, shops: Shop[]): number | null {
  return isWardrobe(shops, s.shopId) ? 0 : parseMoney(s.costText);
}

function titleFor(s: ItemFormState): string {
  return s.title.trim().slice(0, TITLE_MAX) || s.itemType;
}

export interface NewItemContext {
  shops: Shop[];
  settings: Settings;
  today: string;
  tripId: string | null;
  tripLineId: string | null;
  purchaseDate: string | null;
}

/** Input for useCreateItem (photos are uploaded separately). Listed when it has a price, else draft. */
export function buildNewItemInput(s: ItemFormState, ctx: NewItemContext): NewItemInput {
  const p = pricing(s, ctx.settings, ctx.today);
  return {
    title: titleFor(s),
    brand: s.brand.trim(),
    department: s.department,
    itemType: s.itemType,
    size: s.size.trim(),
    description: s.description.trim(),
    shopId: s.shopId,
    tripId: ctx.tripId,
    tripLineId: ctx.tripLineId,
    purchaseDate: ctx.purchaseDate,
    cost: costFor(s, ctx.shops),
    status: p.hasPrice ? 'listed' : 'draft',
    listedDate: p.listedDate,
    firstListPrice: p.firstListPrice,
    adRate: p.hasPrice ? p.adRate : null,
  };
}

/** Patch for useUpdateItem. Sold/returned items keep their status; draft/listed follow the price. */
export function buildItemPatch(s: ItemFormState, existing: Item, shops: Shop[], settings: Settings, todayStr: string): ItemPatch {
  const p = pricing(s, settings, todayStr);
  const editable: ItemStatus[] = ['draft', 'listed'];
  const status: ItemStatus = editable.includes(existing.status) ? (p.hasPrice ? 'listed' : 'draft') : existing.status;
  return {
    title: titleFor(s),
    brand: s.brand.trim(),
    department: s.department,
    itemType: s.itemType,
    size: s.size.trim(),
    description: s.description.trim(),
    shopId: s.shopId,
    cost: costFor(s, shops),
    status,
    firstListPrice: p.firstListPrice,
    adRate: p.hasPrice ? p.adRate : existing.adRate,
    // keep the original listed date for sold items even if the form was cleared
    listedDate: p.hasPrice ? p.listedDate : editable.includes(existing.status) ? null : existing.listedDate,
  };
}

function moneyText(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

export function emptyForm(settings: Settings, itemTypes: string[]): ItemFormState {
  return {
    brand: '',
    department: 'Women',
    itemType: itemTypes[0] ?? '',
    size: '',
    shopId: null,
    costText: '',
    title: '',
    description: '',
    priceText: '',
    adText: String(settings.defaultAdRate),
    listedDate: '',
    photos: [],
  };
}

export function formFromItem(item: Item, settings: Settings): ItemFormState {
  return {
    brand: item.brand,
    department: item.department,
    itemType: item.itemType,
    size: item.size,
    shopId: item.shopId,
    costText: moneyText(item.cost),
    title: item.title,
    description: item.description,
    priceText: moneyText(item.firstListPrice),
    adText: String(item.adRate ?? settings.defaultAdRate),
    listedDate: item.listedDate ?? '',
    photos: [...item.photos].sort((a, b) => a.sort - b.sort).map((p) => ({ key: p.id, path: p.path, existing: true })),
  };
}

/** Prefill from receipt-line route params (all strings from the URL). */
export function formFromReceiptParams(
  base: ItemFormState,
  params: { shopId?: string; cost?: string; brand?: string },
): ItemFormState {
  const cost = params.cost != null && params.cost !== '' ? parseMoney(params.cost) : null;
  return {
    ...base,
    brand: params.brand ?? base.brand,
    shopId: params.shopId || base.shopId,
    costText: cost != null ? String(cost) : base.costText,
  };
}
