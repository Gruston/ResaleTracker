// Pure helpers for "Load your sales history": guess which CSV column is which, read money and dates the way
// eBay Seller Hub and spreadsheets write them, and turn one CSV row into an item plus a sale.
import { itemPriceFromPriceWithProtection, protectionFor, round2 } from '@/domain/money';
import type { Department, Settings, Shop, SkuCode } from '@/domain/types';

export type ImportField =
  | 'soldDate'
  | 'title'
  | 'brand'
  | 'department'
  | 'itemType'
  | 'size'
  | 'cost'
  | 'firstListPrice'
  | 'salePrice'
  | 'orderTotal'
  | 'buyerProtection'
  | 'postage'
  | 'adFee'
  | 'orderNo'
  | 'shop';

export interface ImportFieldInfo {
  key: ImportField;
  label: string;
  /** Rows without this are skipped (sale price can also come from the order total). */
  required?: boolean;
  /** Shown under the picker. */
  hint?: string;
}

/** Fields in the order they are shown and guessed. */
export const IMPORT_FIELDS: readonly ImportFieldInfo[] = [
  { key: 'soldDate', label: 'Sold date', required: true },
  { key: 'title', label: 'Item title', required: true },
  { key: 'salePrice', label: 'Sale price', required: true, hint: 'The item price. If you only have the order total, map that and leave this blank.' },
  { key: 'orderTotal', label: 'Order total', hint: 'What the buyer paid all-in.' },
  { key: 'buyerProtection', label: 'Buyer protection' },
  { key: 'postage', label: 'Postage' },
  { key: 'adFee', label: 'Ad fee' },
  { key: 'orderNo', label: 'Order no.' },
  { key: 'cost', label: 'Cost' },
  { key: 'firstListPrice', label: 'First listing price' },
  { key: 'brand', label: 'Brand' },
  { key: 'department', label: 'Department' },
  { key: 'itemType', label: 'Item type' },
  { key: 'size', label: 'Size' },
  { key: 'shop', label: 'Shop' },
];

export type ColumnMapping = Record<ImportField, number | null>;

// Aliases are compared after normalising (lower case, punctuation to spaces). A one-word alias must match the
// whole header; a multi-word alias also matches when the header contains those words.
const ALIASES: Record<ImportField, string[]> = {
  soldDate: ['sold date', 'sale date', 'date sold', 'date of sale', 'order date', 'transaction creation date', 'paid on date', 'sold on', 'date'],
  title: ['item title', 'listing title', 'item name', 'title', 'description', 'item'],
  salePrice: ['sold for', 'sale price', 'sold price', 'item price', 'price sold', 'selling price', 'item subtotal'],
  orderTotal: ['total price', 'order total', 'buyer paid', 'total paid', 'order amount', 'order value', 'total'],
  buyerProtection: ['buyer protection fee', 'buyer protection', 'protection fee', 'protection'],
  postage: ['shipping and handling', 'postage and handling', 'postage cost', 'shipping cost', 'label cost', 'postage', 'shipping', 'delivery'],
  adFee: ['promoted listings fee', 'promoted listing fee', 'promoted listings general fee', 'advertising fee', 'ad fee', 'ads fee'],
  orderNo: ['order number', 'order no', 'order id', 'order ref', 'sales record number', 'order'],
  cost: ['cost price', 'purchase price', 'purchase cost', 'cost of item', 'bought for', 'buy price', 'cost', 'paid'],
  firstListPrice: ['first listing price', 'first list price', 'original listing price', 'original price', 'listing price', 'list price', 'asking price', 'start price'],
  brand: ['brand', 'designer', 'label'],
  department: ['department', 'dept', 'gender', 'section'],
  itemType: ['item type', 'product type', 'garment type', 'type', 'category'],
  size: ['item size', 'size'],
  shop: ['shop name', 'bought from', 'purchased from', 'shop', 'store', 'source', 'supplier'],
};

const GUESS_ORDER: ImportField[] = [
  'soldDate', 'title', 'salePrice', 'orderTotal', 'buyerProtection', 'postage', 'adFee', 'orderNo', 'cost',
  'firstListPrice', 'brand', 'department', 'itemType', 'size', 'shop',
];

/** Lower case, anything that is not a letter or digit becomes a space, runs of spaces collapse. */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function emptyMapping(): ColumnMapping {
  return Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, null])) as ColumnMapping;
}

/** Guess a mapping from header names. Each column is used for at most one field. */
export function guessMapping(headers: readonly string[]): ColumnMapping {
  const norm = headers.map(normalizeHeader);
  const mapping = emptyMapping();
  const used = new Set<number>();
  const take = (field: ImportField, test: (h: string, alias: string) => boolean) => {
    if (mapping[field] != null) return;
    for (const alias of ALIASES[field]) {
      const idx = norm.findIndex((h, i) => !used.has(i) && h !== '' && test(h, alias));
      if (idx >= 0) {
        mapping[field] = idx;
        used.add(idx);
        return;
      }
    }
  };
  for (const f of GUESS_ORDER) take(f, (h, a) => h === a);
  for (const f of GUESS_ORDER) take(f, (h, a) => a.includes(' ') && ` ${h} `.includes(` ${a} `));
  return mapping;
}

/** The required fields that have no column chosen (sale price may be replaced by order total). */
export function missingRequired(mapping: ColumnMapping): ImportField[] {
  const out: ImportField[] = [];
  if (mapping.soldDate == null) out.push('soldDate');
  if (mapping.title == null) out.push('title');
  if (mapping.salePrice == null && mapping.orderTotal == null) out.push('salePrice');
  return out;
}

// ---------------------------------------------------------------------------
// Cell readers
// ---------------------------------------------------------------------------

/** "$1,234.50", "AU $12", "(12.00)", "-3", "12,50", "1.234,50" -> number; blank or unreadable -> null. */
export function parseMoney(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/\b(?:aud|usd|au|us|a)\s*\$?/gi, '').replace(/[$£€]/g, '').replace(/\s+/g, '');
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // comma is the decimal mark when it is followed by 1-2 digits and no dot comes later: "12,50", "1.234,50"
    s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }
  if ((s.match(/\./g) ?? []).length > 1) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const v = round2(negative ? -n : n);
  return v === 0 ? 0 : v;
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function validYmd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2200) return null;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > dim) return null;
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

function fullYear(y: number, digits: number): number {
  return digits <= 2 ? 2000 + y : y;
}

/**
 * Read a date written like 2026-11-14, 14/11/2026, 14/11/26, 14-Nov-26, 14 November 2026, Nov 14, 2026, Nov-14-26 (eBay), or any of
 * those followed by a time. Numeric day/month dates are read day-first (Australia) unless the second number can
 * only be a day. Returns YYYY-MM-DD or null.
 */
export function parseDate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!s) return null;

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[T ].*)?$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = fullYear(Number(m[3]), m[3].length);
    // day-first by default; if that is impossible but month-first works, use it
    return validYmd(y, b, a) ?? validYmd(y, a, b);
  }

  m = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ -](\d{2}|\d{4})(?:[T ].*)?$/.exec(s);
  if (m) {
    const mon = MONTH_NAMES.indexOf(m[2].slice(0, 3).toLowerCase());
    return mon < 0 ? null : validYmd(fullYear(Number(m[3]), m[3].length), mon + 1, Number(m[1]));
  }

  m = /^([A-Za-z]{3,9})[ -](\d{1,2})[ -](\d{2}|\d{4})(?:[T ].*)?$/.exec(s);
  if (m) {
    const mon = MONTH_NAMES.indexOf(m[1].slice(0, 3).toLowerCase());
    return mon < 0 ? null : validYmd(fullYear(Number(m[3]), m[3].length), mon + 1, Number(m[2]));
  }
  return null;
}

/** "women's", "Womens", "W", "ladies" -> 'Women'; "boys" -> 'Kids'; unknown -> null. */
export function normalizeDepartment(raw: string | null | undefined): Department | null {
  const s = (raw ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return null;
  if (['w', 'women', 'womens', 'woman', 'womans', 'ladies', 'lady', 'female', 'girl', 'girls'].includes(s)) {
    return s === 'girl' || s === 'girls' ? 'Kids' : 'Women';
  }
  if (['m', 'men', 'mens', 'man', 'male', 'gents', 'boy', 'boys'].includes(s)) return s === 'boy' || s === 'boys' ? 'Kids' : 'Men';
  if (['u', 'unisex', 'uni', 'neutral', 'genderneutral', 'allgenders'].includes(s)) return 'Unisex';
  if (['k', 'kid', 'kids', 'child', 'children', 'childrens', 'infant', 'baby', 'toddler'].includes(s)) return 'Kids';
  return null;
}

const TYPE_SYNONYMS: Record<string, string> = {
  tee: 'Top', tshirt: 'Top', tshirts: 'Top', blouse: 'Top', tank: 'Top', singlet: 'Top', tops: 'Top',
  sweater: 'Jumper', sweatshirt: 'Jumper', pullover: 'Jumper', knit: 'Jumper', hoodie: 'Jumper',
  trousers: 'Pants', leggings: 'Pants', shorts: 'Pants', chinos: 'Pants',
  denim: 'Jeans',
  boots: 'Shoes', sandals: 'Shoes', heels: 'Shoes', sneakers: 'Shoes', flats: 'Shoes', shoe: 'Shoes',
  handbag: 'Bag', purse: 'Bag', backpack: 'Bag', tote: 'Bag', bags: 'Bag',
  blazer: 'Jacket', jackets: 'Jacket', coats: 'Coat',
  dresses: 'Dress', gown: 'Dress', skirts: 'Skirt', shirts: 'Shirt', cardigans: 'Cardigan', jumpers: 'Jumper',
  rompers: 'Romper', jumpsuit: 'Romper', playsuits: 'Playsuit', accessories: 'Accessory', scarf: 'Accessory', belt: 'Accessory',
};

function typeLabels(codes: readonly SkuCode[]): string[] {
  return codes.filter((c) => c.kind === 'item_type').map((c) => c.label);
}

/** Match a typed item type to one of the item types in the SKU codes (case, plurals and a few synonyms). */
export function matchItemType(raw: string | null | undefined, codes: readonly SkuCode[]): string | null {
  const word = (raw ?? '').trim().toLowerCase();
  if (!word) return null;
  const labels = typeLabels(codes);
  const exact = labels.find((l) => l.toLowerCase() === word);
  if (exact) return exact;
  const squashed = word.replace(/[^a-z]/g, '');
  const loose = labels.find((l) => {
    const k = l.toLowerCase();
    return k === squashed || `${k}s` === squashed || `${k}es` === squashed;
  });
  if (loose) return loose;
  const syn = TYPE_SYNONYMS[squashed];
  return syn && labels.includes(syn) ? syn : null;
}

/** Look for an item type word in a title ("Zimmermann silk dress" -> Dress). */
export function inferItemType(title: string, codes: readonly SkuCode[]): string | null {
  for (const w of title.toLowerCase().split(/[^a-z]+/)) {
    if (!w) continue;
    const hit = matchItemType(w, codes);
    if (hit) return hit;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Row -> item + sale
// ---------------------------------------------------------------------------

export interface ImportContext {
  settings: Settings;
  shops: readonly Shop[];
  skuCodes: readonly SkuCode[];
  /** YYYY-MM-DD, used only when nothing better is available. */
  today: string;
}

export interface PlannedItem {
  title: string;
  brand: string;
  department: Department;
  itemType: string;
  size: string;
  shopId: string | null;
  cost: number | null;
  listedDate: string;
  firstListPrice: number | null;
  adRate: number | null;
}

export interface PlannedSale {
  orderNo: string | null;
  soldDate: string;
  orderTotal: number;
  buyerProtection: number;
  postage: number;
  salePrice: number;
}

export interface ImportPlan {
  item: PlannedItem;
  sale: PlannedSale;
  /** A shop name in the file that does not match any shop; the importer creates it. */
  newShopName: string | null;
  /** Things the app filled in or guessed for this row. */
  notes: string[];
}

export type RowResult = { ok: true; plan: ImportPlan } | { ok: false; reason: string };

function cell(row: readonly string[], idx: number | null): string {
  return idx == null ? '' : (row[idx] ?? '').trim();
}

/** Key used to spot a row that has already been loaded: order number plus lower-case title. */
export function dedupeKey(orderNo: string | null | undefined, title: string): string | null {
  const no = (orderNo ?? '').trim().toLowerCase();
  return no ? `${no}|${title.trim().toLowerCase()}` : null;
}

/**
 * Turn one CSV row into the item and sale to create, or say why it is skipped.
 * Missing postage and buyer protection are estimated from Fee settings and noted; an ad fee becomes the item's
 * ad rate so the usual allocation reproduces it.
 */
export function planRow(row: readonly string[], mapping: ColumnMapping, ctx: ImportContext): RowResult {
  const notes: string[] = [];
  const s = ctx.settings;

  const title = cell(row, mapping.title);
  if (!title) return { ok: false, reason: 'No item title' };

  const rawDate = cell(row, mapping.soldDate);
  if (!rawDate) return { ok: false, reason: 'No sold date' };
  const soldDate = parseDate(rawDate);
  if (!soldDate) return { ok: false, reason: `Could not read the sold date "${rawDate}"` };

  const money = (field: ImportField, label: string): number | null | 'bad' => {
    const raw = cell(row, mapping[field]);
    if (!raw) return null;
    const v = parseMoney(raw);
    if (v === null) {
      notes.push(`Ignored ${label} "${raw}" (not a number)`);
      return 'bad';
    }
    return v;
  };
  const opt = (field: ImportField, label: string): number | null => {
    const v = money(field, label);
    return v === 'bad' ? null : v;
  };

  const rawSale = cell(row, mapping.salePrice);
  let salePrice = opt('salePrice', 'sale price');
  if (rawSale && salePrice === null) return { ok: false, reason: `Could not read the sale price "${rawSale}"` };
  let orderTotal = opt('orderTotal', 'order total');
  let postage = opt('postage', 'postage');
  let protection = opt('buyerProtection', 'buyer protection');
  const adFee = opt('adFee', 'ad fee');

  if (salePrice === null && orderTotal === null) return { ok: false, reason: 'No sale price' };
  if (postage === null) {
    postage = round2(s.defaultLabelCost);
    notes.push(`Postage estimated at the typical label cost`);
  }
  if (salePrice === null) {
    // Work back from the order total: total = price + postage + buyer protection(price)
    const t = orderTotal as number;
    if (protection !== null) {
      salePrice = round2(t - postage - protection);
    } else {
      salePrice = round2(itemPriceFromPriceWithProtection(t - postage, s));
      protection = round2(t - salePrice - postage);
      notes.push('Sale price worked out from the order total');
    }
  }
  if (salePrice <= 0) return { ok: false, reason: 'Sale price is not above $0' };
  if (protection === null) {
    protection =
      orderTotal !== null ? round2(Math.max(0, orderTotal - salePrice - postage)) : round2(protectionFor(salePrice, postage, s));
    notes.push('Buyer protection estimated');
  }
  if (orderTotal === null) orderTotal = round2(salePrice + postage + protection);

  let adRate: number | null = null;
  if (adFee !== null && adFee > 0) {
    const base = s.adFeeBase === 'item_plus_postage' ? salePrice + postage : salePrice;
    adRate = base > 0 ? (adFee / base) * 100 : null;
  } else if (adFee === 0) {
    adRate = 0;
  }

  const rawDept = cell(row, mapping.department);
  let department = normalizeDepartment(rawDept);
  if (!department) {
    department = 'Women';
    notes.push(rawDept ? `Department "${rawDept}" not recognised, set to Women` : 'Department set to Women');
  }

  const rawType = cell(row, mapping.itemType);
  let itemType = matchItemType(rawType, ctx.skuCodes);
  if (!itemType) {
    itemType = inferItemType(title, ctx.skuCodes);
    if (!itemType) {
      itemType = 'Other';
      notes.push(rawType ? `Item type "${rawType}" not recognised, set to Other` : 'Item type set to Other');
    } else if (rawType) {
      notes.push(`Item type "${rawType}" not recognised, taken from the title`);
    }
  }

  const rawShop = cell(row, mapping.shop);
  const shop = rawShop ? ctx.shops.find((x) => x.name.trim().toLowerCase() === rawShop.toLowerCase()) : undefined;
  let cost = opt('cost', 'cost');
  if (cost === null && shop?.kind === 'wardrobe') cost = 0;

  const firstListPrice = opt('firstListPrice', 'first listing price');

  return {
    ok: true,
    plan: {
      item: {
        title,
        brand: cell(row, mapping.brand),
        department,
        itemType,
        size: cell(row, mapping.size),
        shopId: shop?.id ?? null,
        cost,
        listedDate: soldDate,
        firstListPrice,
        adRate,
      },
      sale: {
        orderNo: cell(row, mapping.orderNo) || null,
        soldDate,
        orderTotal,
        buyerProtection: protection,
        postage,
        salePrice,
      },
      newShopName: rawShop && !shop ? rawShop : null,
      notes,
    },
  };
}

export interface PlanSummary {
  plans: { rowNumber: number; plan: ImportPlan }[];
  skipped: { rowNumber: number; reason: string }[];
}

/**
 * Plan every row. `rowNumber` is the line number in the file (header = 1, first data row = 2).
 * `existingKeys` (see dedupeKey) lets a second import of the same file skip rows already loaded; duplicates inside
 * the file are skipped too.
 */
export function planRows(
  rows: readonly (readonly string[])[],
  mapping: ColumnMapping,
  ctx: ImportContext,
  existingKeys: ReadonlySet<string> = new Set(),
): PlanSummary {
  const seen = new Set(existingKeys);
  const out: PlanSummary = { plans: [], skipped: [] };
  rows.forEach((row, i) => {
    const rowNumber = i + 2;
    const res = planRow(row, mapping, ctx);
    if (!res.ok) {
      out.skipped.push({ rowNumber, reason: res.reason });
      return;
    }
    const key = dedupeKey(res.plan.sale.orderNo, res.plan.item.title);
    if (key && seen.has(key)) {
      out.skipped.push({ rowNumber, reason: 'Already loaded (same order number and title)' });
      return;
    }
    if (key) seen.add(key);
    out.plans.push({ rowNumber, plan: res.plan });
  });
  return out;
}

/** Group skip reasons for the summary: [{ reason, count }] most common first. */
export function groupReasons(skipped: readonly { reason: string }[]): { reason: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of skipped) {
    // "Could not read the sold date "xyz"" -> one group per kind
    const kind = s.reason.replace(/ ".*"$/, '');
    m.set(kind, (m.get(kind) ?? 0) + 1);
  }
  return [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

/** Template CSV offered for download: the headers the guesser knows, plus two example rows. */
export const TEMPLATE_HEADERS = [
  'Sold date', 'Item title', 'Brand', 'Department', 'Item type', 'Size', 'Cost', 'First listing price',
  'Sale price', 'Order total', 'Buyer protection', 'Postage', 'Ad fee', 'Order number', 'Shop',
] as const;

export const TEMPLATE_ROWS: readonly (readonly string[])[] = [
  ['14/03/2026', 'Zimmermann silk wrap dress', 'Zimmermann', 'Women', 'Dress', '10', '22.00', '95.00', '82.00', '100.60', '6.10', '12.50', '3.40', '12-34567-89012', 'Vinnies Newtown'],
  ['02/04/2026', 'Country Road linen shirt', 'Country Road', 'Men', 'Shirt', 'M', '0', '45.00', '38.00', '49.90', '3.40', '9.50', '', '', 'My wardrobe'],
];
