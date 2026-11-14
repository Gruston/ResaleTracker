import type { OrderItem, Item, Settings } from './types';

/** Round to whole cents (half away from zero, tolerant of float noise like 1.005). Never returns -0. */
export function round2(n: number): number {
  const r = (Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-6)) / 100;
  return r === 0 ? 0 : r;
}

/** Sum of money values, rounded to cents (inputs are already cent values so this is lossless). */
export function sumMoney(values: readonly number[]): number {
  return round2(values.reduce((a, b) => a + b, 0));
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "$1,234.56"; negatives use a true minus sign: "−$12.50". */
export function formatMoney(n: number): string {
  const r = round2(n);
  const [i, f] = Math.abs(r).toFixed(2).split('.');
  return `${r < 0 ? '−' : ''}$${groupThousands(i)}.${f}`;
}

/** Whole dollars: "$1,235", "−$12". */
export function formatMoney0(n: number): string {
  const w = Math.round(Math.abs(n) + 1e-9);
  return `${n < 0 && w !== 0 ? '−' : ''}$${groupThousands(String(w))}`;
}

/**
 * eBay Australia Buyer Protection tiers (sellers without a Pro plan, from April 2026), charged on the
 * item price only (not postage), GST included: 8% of the first $20, 6% of $20–$500, 4% of $500–$5,000,
 * nothing above $5,000, plus a flat fee per item (settings.protectionFixed, $0.30).
 * Source: https://www.ebay.com.au/help/buying/paying-items/buyer-protection-fee?id=5594
 */
export const PROTECTION_TIERS: { upTo: number; rate: number }[] = [
  { upTo: 20, rate: 0.08 },
  { upTo: 500, rate: 0.06 },
  { upTo: 5000, rate: 0.04 },
];

/** The percentage part of Buyer Protection for an item price. Unrounded. */
export function protectionVariable(itemPrice: number): number {
  let fee = 0;
  let from = 0;
  for (const t of PROTECTION_TIERS) {
    if (itemPrice <= from) break;
    fee += (Math.min(itemPrice, t.upTo) - from) * t.rate;
    from = t.upTo;
  }
  return fee;
}

/** Buyer protection fee = flat + tiered % of the item price (postage is not included). Unrounded. */
export function protectionFor(itemPrice: number, _postage: number, s: Settings): number {
  if (itemPrice <= 0) return 0;
  return s.protectionFixed + protectionVariable(itemPrice);
}

/** Inverse of price + protection: the item price that gives `priceWithProtection` (e.g. order total minus postage). */
export function itemPriceFromPriceWithProtection(priceWithProtection: number, s: Settings): number {
  if (priceWithProtection <= s.protectionFixed) return 0;
  let lo = 0;
  let hi = priceWithProtection;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mid + protectionFor(mid, 0, s) > priceWithProtection) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Promoted-listing ad fee = adRate% of the item price (or item + postage when s.adFeeBase says so). Unrounded. */
export function adFeeFor(itemPrice: number, postage: number, adRate: number, s: Settings): number {
  const base = s.adFeeBase === 'item_plus_postage' ? itemPrice + postage : itemPrice;
  return (adRate / 100) * base;
}

/** "You get about": listing price minus the ad fee (postage passes through to the label). */
export function youGetAbout(listPrice: number, adRate: number, s: Settings): number {
  return listPrice - adFeeFor(listPrice, s.defaultLabelCost, adRate, s);
}

/** "Buyer sees about": listing price + buyer protection + postage. */
export function buyerSeesAbout(listPrice: number, s: Settings, postage: number = s.defaultLabelCost): number {
  return listPrice + protectionFor(listPrice, postage, s) + postage;
}

/** eBay earnings for one order line = share of order total minus protection, postage and ad fee. */
export function ebayEarnings(oi: OrderItem): number {
  return round2(oi.allocTotal - oi.allocProtection - oi.allocPostage - oi.adFee);
}

/** Profit = eBay earnings minus what was paid for the item (unknown cost counts as 0). */
export function itemProfit(item: Pick<Item, 'cost'>, oi: OrderItem): number {
  return round2(ebayEarnings(oi) - (item.cost ?? 0));
}
