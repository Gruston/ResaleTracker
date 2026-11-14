// AI helper contracts and pure validators.
// NOTE: supabase/functions/_shared/ai.ts is an identical copy of this file (the Edge Function is deployed on its own
// and cannot import from src/). A Jest test fails if the two drift apart. No imports here, so it runs in Deno too.

export const AI_MODEL = 'claude-sonnet-5-5';
export const MAX_PHOTOS = 6;
export const MAX_COMPARABLES = 30;
export const MAX_TITLE_LENGTH = 80;

export type AiAction = 'listing' | 'price' | 'receipt';

// ---- Requests --------------------------------------------------------------------------------------------------

export interface AiListingInput {
  businessId: string;
  /** Storage paths in bucket 'photos', 1 to 6, each starting with the business id. */
  photoPaths: string[];
  brand?: string;
  itemType?: string;
  department?: string;
  size?: string;
  notes?: string;
}

export interface AiPriceComparable {
  title: string;
  brand: string;
  itemType: string;
  size: string;
  /** AUD, what it sold for */
  salePrice: number;
  daysToSell: number;
}

export interface AiPriceInput {
  businessId: string;
  item: { brand: string; itemType: string; department: string; size: string; title?: string };
  /** At most 30, computed in the app from her own sales. */
  comparables: AiPriceComparable[];
}

export interface AiReceiptInput {
  businessId: string;
  receiptPath: string;
}

// ---- Responses -------------------------------------------------------------------------------------------------

export interface AiListingResult {
  title: string;
  description: string;
  keywords: string[];
}

export interface AiPriceResult {
  /** AUD */
  low: number;
  high: number;
  suggested: number;
  reasoning: string;
}

export interface AiReceiptLine {
  description: string;
  qty: number;
  /** line total in AUD (not per unit) */
  price: number;
}

export interface AiReceiptResult {
  shop?: string;
  /** YYYY-MM-DD */
  date?: string;
  total?: number;
  lines: AiReceiptLine[];
}

export type AiRequest =
  | ({ action: 'listing' } & AiListingInput)
  | ({ action: 'price' } & AiPriceInput)
  | ({ action: 'receipt' } & AiReceiptInput);

export interface AiErrorBody {
  error: string;
}

// ---- Validation ------------------------------------------------------------------------------------------------

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => isStr(v) && UUID.test(v);
export const isIsoDate = (v: unknown): v is string => {
  if (!isStr(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** A storage path is safe when it is "<businessId>/<something>" with no traversal. */
export function isPathForBusiness(path: unknown, businessId: string): path is string {
  if (!isStr(path) || path.length > 300) return false;
  if (!path.startsWith(businessId + '/') || path.length <= businessId.length + 1) return false;
  return !path.split('/').some((seg) => seg === '..' || seg === '.' || seg === '');
}

const optText = (v: unknown, max: number): string | undefined | null => {
  if (v === undefined || v === null || v === '') return undefined;
  if (!isStr(v)) return null;
  return v.trim().slice(0, max);
};

export function validateRequest(body: unknown): Validated<AiRequest> {
  if (!isObj(body)) return fail('That request was not understood.');
  const businessId = body.businessId;
  if (!isUuid(businessId)) return fail('Missing business.');

  if (body.action === 'listing') {
    const paths = body.photoPaths;
    if (!Array.isArray(paths) || paths.length < 1) return fail('Add at least one photo first.');
    if (paths.length > MAX_PHOTOS) return fail(`Use at most ${MAX_PHOTOS} photos.`);
    for (const p of paths) if (!isPathForBusiness(p, businessId)) return fail('One of the photos is not valid.');
    const out: AiListingInput = { businessId, photoPaths: paths as string[] };
    for (const [k, max] of [['brand', 80], ['itemType', 80], ['department', 40], ['size', 40], ['notes', 1000]] as const) {
      const v = optText(body[k], max);
      if (v === null) return fail('That request was not understood.');
      if (v !== undefined) out[k] = v;
    }
    return { ok: true, value: { action: 'listing', ...out } };
  }

  if (body.action === 'price') {
    const item = body.item;
    if (!isObj(item)) return fail('Missing item details.');
    const clean: AiPriceInput['item'] = { brand: '', itemType: '', department: '', size: '' };
    for (const [k, max] of [['brand', 80], ['itemType', 80], ['department', 40], ['size', 40]] as const) {
      const v = optText(item[k], max);
      if (v === null) return fail('Missing item details.');
      clean[k] = v ?? '';
    }
    const title = optText(item.title, 200);
    if (title === null) return fail('Missing item details.');
    if (title !== undefined) clean.title = title;
    const comps = body.comparables ?? [];
    if (!Array.isArray(comps)) return fail('That request was not understood.');
    if (comps.length > MAX_COMPARABLES) return fail(`Use at most ${MAX_COMPARABLES} comparable sales.`);
    const comparables: AiPriceComparable[] = [];
    for (const c of comps) {
      if (!isObj(c) || !isNum(c.salePrice) || c.salePrice < 0 || !isNum(c.daysToSell) || c.daysToSell < 0) {
        return fail('A comparable sale was not valid.');
      }
      comparables.push({
        title: isStr(c.title) ? c.title.slice(0, 200) : '',
        brand: isStr(c.brand) ? c.brand.slice(0, 80) : '',
        itemType: isStr(c.itemType) ? c.itemType.slice(0, 80) : '',
        size: isStr(c.size) ? c.size.slice(0, 40) : '',
        salePrice: c.salePrice,
        daysToSell: c.daysToSell,
      });
    }
    return { ok: true, value: { action: 'price', businessId, item: clean, comparables } };
  }

  if (body.action === 'receipt') {
    if (!isPathForBusiness(body.receiptPath, businessId)) return fail('That receipt photo is not valid.');
    return { ok: true, value: { action: 'receipt', businessId, receiptPath: body.receiptPath } };
  }

  return fail('That request was not understood.');
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Is the title mostly shouting? (more than 3 letters-words in capitals, ignoring short words like "UK", "XL") */
function isShouting(title: string): boolean {
  const words = title.split(/\s+/).filter((w) => /[A-Za-z]{4,}/.test(w));
  if (words.length < 3) return false;
  const caps = words.filter((w) => w === w.toUpperCase()).length;
  return caps / words.length > 0.6;
}

/** Validates the model's listing output; tidies whitespace and keyword list. */
export function validateListingResult(raw: unknown): Validated<AiListingResult> {
  if (!isObj(raw)) return fail('The listing came back in an unexpected shape.');
  const title = isStr(raw.title) ? raw.title.replace(/\s+/g, ' ').trim() : '';
  if (!title) return fail('The listing had no title.');
  if (title.length > MAX_TITLE_LENGTH) return fail('The title was too long.');
  if (isShouting(title)) return fail('The title was in all capitals.');
  const description = isStr(raw.description) ? raw.description.trim() : '';
  if (description.length < 20) return fail('The listing had no description.');
  if (!Array.isArray(raw.keywords)) return fail('The listing had no keywords.');
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const k of raw.keywords) {
    if (!isStr(k)) continue;
    const t = k.trim();
    if (!t || t.length > 60 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    keywords.push(t);
    if (keywords.length >= 20) break;
  }
  return { ok: true, value: { title, description, keywords } };
}

/** Validates the model's price output. Requires 0 <= low <= suggested <= high. */
export function validatePriceResult(raw: unknown): Validated<AiPriceResult> {
  if (!isObj(raw)) return fail('The price came back in an unexpected shape.');
  const { low, high, suggested, reasoning } = raw;
  if (!isNum(low) || !isNum(high) || !isNum(suggested)) return fail('The price range was missing.');
  if (low < 0 || low > suggested || suggested > high) return fail('The price range did not make sense.');
  if (high > 100000) return fail('The price range did not make sense.');
  const why = isStr(reasoning) ? reasoning.trim() : '';
  if (!why) return fail('The price had no reasoning.');
  return { ok: true, value: { low: round2(low), high: round2(high), suggested: round2(suggested), reasoning: why } };
}

/** Validates the model's receipt output. Unknown shop/date/total are dropped rather than rejected. */
export function validateReceiptResult(raw: unknown): Validated<AiReceiptResult> {
  if (!isObj(raw)) return fail('The receipt came back in an unexpected shape.');
  if (!Array.isArray(raw.lines)) return fail('No lines were found on the receipt.');
  const lines: AiReceiptLine[] = [];
  for (const l of raw.lines) {
    if (!isObj(l) || !isStr(l.description) || !isNum(l.price) || l.price < 0) {
      return fail('A receipt line could not be read.');
    }
    const qty = l.qty === undefined || l.qty === null ? 1 : l.qty;
    if (!isNum(qty) || qty < 1 || !Number.isInteger(qty) || qty > 1000) return fail('A receipt line could not be read.');
    lines.push({ description: l.description.trim().slice(0, 200), qty, price: round2(l.price) });
  }
  const out: AiReceiptResult = { lines };
  if (isStr(raw.shop) && raw.shop.trim()) out.shop = raw.shop.trim().slice(0, 120);
  if (isIsoDate(raw.date)) out.date = raw.date;
  if (isNum(raw.total) && raw.total >= 0) out.total = round2(raw.total);
  return { ok: true, value: out };
}
