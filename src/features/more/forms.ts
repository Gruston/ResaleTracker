// Pure validation and parsing for the More screens' forms.
import type { AdFeeBase, Settings, Shop, SkuCode, StorageLocation } from '@/domain/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "12.5", "$12.50", "1,200" -> number; blank or invalid -> null. */
export function parseAmount(s: string): number | null {
  const t = s.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!t || !/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

/** Error text, or null when the name is fine. `selfId` is the shop being renamed. */
export function validateShopName(name: string, shops: readonly Shop[], selfId?: string): string | null {
  const t = name.trim();
  if (!t) return 'Enter a shop name';
  if (shops.some((s) => s.id !== selfId && s.name.trim().toLowerCase() === t.toLowerCase())) {
    return 'You already have a shop with that name';
  }
  return null;
}

/** The wardrobe shop (My wardrobe) cannot be archived. */
export function canArchive(shop: Pick<Shop, 'kind'>): boolean {
  return shop.kind !== 'wardrobe';
}

// ---------------------------------------------------------------------------
// SKU codes and storage
// ---------------------------------------------------------------------------

export const ITEM_TYPE_CODE_RE = /^[A-Z]{2}$/;
export const DEPARTMENT_CODE_RE = /^[A-Z]$/;

/** Upper-case and strip anything that is not a letter, so typing "d1" gives "D". */
export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '');
}

/**
 * Validate a code for an existing label (edit) or a new label (add: pass `label` as the new name and
 * `existingLabel` undefined). Codes must be unique within their kind.
 */
export function validateCode(
  kind: SkuCode['kind'],
  code: string,
  codes: readonly SkuCode[],
  existingLabel?: string,
): string | null {
  const re = kind === 'department' ? DEPARTMENT_CODE_RE : ITEM_TYPE_CODE_RE;
  if (!re.test(code)) {
    return kind === 'department' ? 'Use one capital letter, like W' : 'Use 2 capital letters, like DR';
  }
  const clash = codes.find((c) => c.kind === kind && c.code === code && c.label !== existingLabel);
  return clash ? `${code} is already used for ${clash.label}` : null;
}

/** Error for a new item type name, or null. */
export function validateNewItemType(label: string, codes: readonly SkuCode[]): string | null {
  const t = label.trim();
  if (!t) return 'Enter a name, like Swimwear';
  if (codes.some((c) => c.kind === 'item_type' && c.label.toLowerCase() === t.toLowerCase())) {
    return 'That item type already exists';
  }
  return null;
}

/** The sort value for a new item type: after the last one. */
export function nextItemTypeSort(codes: readonly SkuCode[]): number {
  return Math.max(0, ...codes.filter((c) => c.kind === 'item_type').map((c) => c.sort)) + 1;
}

export const STORAGE_PREFIX_RE = /^[A-Z]{1,3}$/;

/** A storage prefix is a department letter ("M") or department + item type ("WD"). */
export function validateStoragePrefix(prefix: string, storage: readonly StorageLocation[]): string | null {
  if (!STORAGE_PREFIX_RE.test(prefix)) return 'Use capital letters, like WD (women\'s dress) or M (all men\'s)';
  if (storage.some((s) => s.prefix === prefix)) return `${prefix} already has a location; edit it instead`;
  return null;
}

/** Sort storage rows: department letters first, then prefixes, alphabetically. */
export function sortStorage(storage: readonly StorageLocation[]): StorageLocation[] {
  return [...storage].sort((a, b) => a.prefix.length - b.prefix.length || a.prefix.localeCompare(b.prefix));
}

// ---------------------------------------------------------------------------
// Fee settings
// ---------------------------------------------------------------------------

export interface FeeForm {
  protectionFixed: string;
  defaultAdRate: string;
  adFeeBase: AdFeeBase;
  defaultLabelCost: string;
}

export function feeFormFrom(s: Settings): FeeForm {
  const t = (n: number) => String(Math.round(n * 10000) / 10000);
  return {
    protectionFixed: t(s.protectionFixed),
    defaultAdRate: t(s.defaultAdRate),
    adFeeBase: s.adFeeBase,
    defaultLabelCost: t(s.defaultLabelCost),
  };
}

export type FeeErrors = Partial<Record<'protectionFixed' | 'defaultAdRate' | 'defaultLabelCost', string>>;

/** Parse the form. Returns the settings patch, or per-field errors. */
export function parseFeeForm(
  f: FeeForm,
): { ok: true; patch: Omit<Settings, 'businessId'> } | { ok: false; errors: FeeErrors } {
  const errors: FeeErrors = {};
  const num = (key: keyof FeeErrors, raw: string, max: number, what: string): number => {
    const v = parseAmount(raw);
    if (v === null) {
      errors[key] = `Enter ${what}, like 2.5`;
      return 0;
    }
    if (v > max) {
      errors[key] = `That looks too high (most ${max})`;
      return 0;
    }
    return v;
  };
  const protectionFixed = num('protectionFixed', f.protectionFixed, 100, 'dollars');
  const defaultAdRate = num('defaultAdRate', f.defaultAdRate, 100, 'a percentage');
  const defaultLabelCost = num('defaultLabelCost', f.defaultLabelCost, 1000, 'dollars');
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, patch: { protectionFixed, defaultAdRate, adFeeBase: f.adFeeBase, defaultLabelCost } };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export function isLikelyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Plain-language text for errors from add_member_by_email. */
export function addMemberErrorText(message: string, name = 'Damon'): string {
  const m = message.toLowerCase();
  if (m.includes('no account') || m.includes('sign in')) {
    return `${name} has not signed in to the app yet. Ask ${name} to open the app and sign in with that email once, then try again.`;
  }
  if (m.includes('only the owner')) return 'Only the person who set up the business can add someone.';
  if (m.includes('network') || m.includes('fetch')) return 'Could not reach the server. Check your connection and try again.';
  return `Could not add ${name}: ${message}`;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORIES = ['Packaging', 'Stationery', 'Printer and labels', 'eBay fees', 'Other'] as const;

export interface ExpenseForm {
  description: string;
  amount: string;
  date: string;
}

export type ExpenseErrors = Partial<Record<keyof ExpenseForm, string>>;

/** Returns per-field errors (empty object when fine). */
export function validateExpense(f: ExpenseForm): ExpenseErrors {
  const errors: ExpenseErrors = {};
  if (!f.description.trim()) errors.description = 'Say what it was for, like Satchels';
  const amount = parseAmount(f.amount);
  if (amount === null || amount <= 0) errors.amount = 'Enter the amount, like 24.50';
  if (!isValidDate(f.date)) errors.date = 'Use DD/MM/YYYY, like 14/11/2026';
  return errors;
}
