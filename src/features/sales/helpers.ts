import { allocateOrder, ebayEarnings, round2, sumMoney } from '@/domain';
import type { Item, OrderItem, Settings } from '@/domain';

/** Parses what Kat typed into a money box ("$1,234.50", "12.5"). Returns null when empty or not a number. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[$,\s]/g, '');
  if (t === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? round2(n) : null;
}

/** Number -> text for a money box ("12.50"). */
export function amountText(n: number): string {
  return round2(n).toFixed(2);
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export interface SalePreviewInput {
  orderTotal: number;
  buyerProtection: number;
  postage: number;
  items: { item: Pick<Item, 'id' | 'cost' | 'adRate'>; salePrice: number }[];
}

export interface SalePreviewRow {
  itemId: string;
  orderItem: OrderItem;
  earnings: number;
  profit: number;
}

export interface SalePreview {
  rows: SalePreviewRow[];
  /** sale prices + postage + buyer protection */
  partsTotal: number;
  /** order total minus partsTotal (0 when everything adds up) */
  difference: number;
  matches: boolean;
  totalEarnings: number;
  totalProfit: number;
}

/** Live preview of a sale: per-item allocations, earnings and profit, and whether the parts add up to the order total. */
export function previewSale(input: SalePreviewInput, settings: Settings): SalePreview {
  const allocations = allocateOrder(
    {
      orderTotal: input.orderTotal,
      buyerProtection: input.buyerProtection,
      postage: input.postage,
      items: input.items.map((i) => ({
        itemId: i.item.id,
        salePrice: i.salePrice,
        adRate: i.item.adRate ?? settings.defaultAdRate,
      })),
    },
    settings,
  );
  const rows = allocations.map((orderItem, k) => {
    const earnings = ebayEarnings(orderItem);
    return { itemId: orderItem.itemId, orderItem, earnings, profit: round2(earnings - (input.items[k].item.cost ?? 0)) };
  });
  const partsTotal = sumMoney([...allocations.map((a) => a.salePrice), input.postage, input.buyerProtection]);
  const difference = round2(input.orderTotal - partsTotal);
  return {
    rows,
    partsTotal,
    difference,
    matches: difference === 0,
    totalEarnings: sumMoney(rows.map((r) => r.earnings)),
    totalProfit: sumMoney(rows.map((r) => r.profit)),
  };
}

export interface SaleFormValues {
  orderNo: string;
  soldDate: string;
  orderTotal: string;
  buyerProtection: string;
  postage: string;
  /** one entry per item in the order */
  prices: string[];
}

export interface SaleFormErrors {
  orderNo?: string;
  soldDate?: string;
  orderTotal?: string;
  buyerProtection?: string;
  postage?: string;
  /** keyed by index into `prices` */
  prices: Record<number, string>;
}

export interface SaleFormResult {
  ok: boolean;
  errors: SaleFormErrors;
  /** parsed numbers, only meaningful when ok */
  values: { orderTotal: number; buyerProtection: number; postage: number; prices: number[] } | null;
}

/** Validates the record-sale form. Mismatched totals are NOT an error (she can save anyway). */
export function validateSaleForm(f: SaleFormValues): SaleFormResult {
  const errors: SaleFormErrors = { prices: {} };
  if (!isValidDate(f.soldDate.trim())) errors.soldDate = 'Use DD/MM/YYYY, like 14/11/2026';

  const orderTotal = parseAmount(f.orderTotal);
  if (orderTotal == null || orderTotal <= 0) errors.orderTotal = 'Enter what the buyer paid';
  const buyerProtection = f.buyerProtection.trim() === '' ? 0 : parseAmount(f.buyerProtection);
  if (buyerProtection == null || buyerProtection < 0) errors.buyerProtection = 'Enter an amount, or 0';
  const postage = f.postage.trim() === '' ? 0 : parseAmount(f.postage);
  if (postage == null || postage < 0) errors.postage = 'Enter an amount, or 0';

  const prices: number[] = [];
  f.prices.forEach((p, i) => {
    const n = parseAmount(p);
    if (n == null || n <= 0) errors.prices[i] = 'Enter the sale price';
    else prices.push(n);
  });

  const ok =
    !errors.soldDate &&
    !errors.orderTotal &&
    !errors.buyerProtection &&
    !errors.postage &&
    Object.keys(errors.prices).length === 0 &&
    f.prices.length > 0;
  return {
    ok,
    errors,
    values: ok ? { orderTotal: orderTotal as number, buyerProtection: buyerProtection as number, postage: postage as number, prices } : null,
  };
}

/** Segments of the "where the buyer's money went" bar. Profit is clamped at 0 so a loss shows as no green. */
export function breakdownValues(oi: OrderItem, cost: number | null) {
  const paid = cost ?? 0;
  const profit = round2(ebayEarnings(oi) - paid);
  return {
    cost: paid,
    profit,
    barProfit: Math.max(profit, 0),
    postage: oi.allocPostage,
    protection: oi.allocProtection,
    ad: oi.adFee,
  };
}

/** Items that can be added to a combined order: listed, not already in it, matching the search text. */
export function addableItems(items: Item[], chosenIds: string[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  return items
    .filter((i) => i.status === 'listed' && !chosenIds.includes(i.id))
    .filter((i) => !q || `${i.sku} ${i.brand} ${i.title}`.toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title));
}
