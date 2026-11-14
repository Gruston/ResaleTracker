import type { Department, SkuCode, StorageLocation } from './types';

/** Department letter + two-letter item type, e.g. ('Women','Dress') -> 'WDR'. Unknown labels become 'X'. */
export function skuPrefix(department: Department | string, itemType: string, codes: SkuCode[]): string {
  const dept = codes.find((c) => c.kind === 'department' && c.label === department)?.code ?? 'X';
  const type = codes.find((c) => c.kind === 'item_type' && c.label === itemType)?.code ?? 'X';
  return dept + type;
}

/** 'WD-014' -> { prefix: 'WD', number: 14 }; null when it is not a SKU. */
export function parseSku(sku: string): { prefix: string; number: number } | null {
  const m = /^([A-Z]{1,4})-(\d+)$/.exec(sku.trim());
  return m ? { prefix: m[1], number: Number(m[2]) } : null;
}

/** 'WD', 14 -> 'WD-014'. */
export function formatSku(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(3, '0')}`;
}

/** Storage location for a SKU (or bare prefix): full prefix match, else department letter, else 'Not set'. */
export function storageFor(sku: string, storage: StorageLocation[]): string {
  const prefix = parseSku(sku)?.prefix ?? sku.trim();
  if (!prefix) return 'Not set';
  const exact = storage.find((s) => s.prefix === prefix);
  if (exact) return exact.location;
  const dept = storage.find((s) => s.prefix === prefix[0]);
  return dept ? dept.location : 'Not set';
}
