import {
  daysBetween,
  financialYearOf,
  fyLabel,
  fyRange,
  monthLabel,
  monthOf,
  nextSeason,
  nextSeasonStart,
  seasonMonths,
  seasonOf,
  seasonStartYear,
} from './dates';
import type { Season } from './dates';
import { adFeeFor, ebayEarnings, itemProfit, round2, sumMoney } from './money';
import { salesByItem } from './orders';
import type { BusinessData, Department, Item, Order, OrderItem, Settings } from './types';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function meanOr0(xs: number[]): number {
  return mean(xs) ?? 0;
}
function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return m;
}
const isUnsold = (i: Item) => i.status === 'draft' || i.status === 'listed';

// ---------------------------------------------------------------------------
// sold items
// ---------------------------------------------------------------------------

/** One sold item with its order line and derived figures. */
export interface SoldItem {
  item: Item;
  order: Order;
  orderItem: OrderItem;
  /** eBay earnings minus cost. */
  profit: number;
  /** allocTotal - protection - postage - ad fee. */
  earnings: number;
  /** soldDate - listedDate; null when the item has no listed date. */
  daysToSell: number | null;
}

/**
 * Items that count as sold: they have an order, are not 'returned'/'faulty', and their latest order was not
 * undone by a relisted return.
 */
export function soldItems(data: BusinessData): SoldItem[] {
  const sales = salesByItem(data);
  const out: SoldItem[] = [];
  for (const item of data.items) {
    if (item.status === 'returned' || item.status === 'faulty') continue;
    const sale = sales.get(item.id);
    if (!sale) continue;
    out.push({
      item,
      order: sale.order,
      orderItem: sale.orderItem,
      profit: itemProfit(item, sale.orderItem),
      earnings: ebayEarnings(sale.orderItem),
      daysToSell: item.listedDate ? daysBetween(item.listedDate, sale.order.soldDate) : null,
    });
  }
  return out;
}

const daysOf = (xs: SoldItem[]) => xs.map((s) => s.daysToSell).filter((d): d is number => d != null);

// ---------------------------------------------------------------------------
// monthly KPIs
// ---------------------------------------------------------------------------

export interface MonthKpis {
  month: string;
  itemsSold: number;
  profit: number;
  earnings: number;
  /** Sum of what buyers paid for these items (allocTotal). */
  buyerPaid: number;
  avgDaysToSell: number | null;
}

/** Sales figures for one month ('YYYY-MM') by sold date. */
export function kpisForMonth(data: BusinessData, month: string): MonthKpis {
  const sold = soldItems(data).filter((s) => monthOf(s.order.soldDate) === month);
  return {
    month,
    itemsSold: sold.length,
    profit: sumMoney(sold.map((s) => s.profit)),
    earnings: sumMoney(sold.map((s) => s.earnings)),
    buyerPaid: sumMoney(sold.map((s) => s.orderItem.allocTotal)),
    avgDaysToSell: mean(daysOf(sold)),
  };
}

export interface MonthProfit {
  month: string;
  /** Short label, "Nov". */
  label: string;
  profit: number;
  itemsSold: number;
}

/** Profit and sold count per month, in the order of `months`. */
export function profitByMonth(data: BusinessData, months: string[]): MonthProfit[] {
  const sold = soldItems(data);
  return months.map((month) => {
    const m = sold.filter((s) => monthOf(s.order.soldDate) === month);
    return { month, label: monthLabel(month), profit: sumMoney(m.map((s) => s.profit)), itemsSold: m.length };
  });
}

// ---------------------------------------------------------------------------
// what sells
// ---------------------------------------------------------------------------

export interface ItemTypeStat {
  itemType: string;
  sold: number;
  profit: number;
  avgProfit: number;
  avgDaysToSell: number | null;
}

/** Sold count, profit and days to sell per item type (best-selling first), optionally for one department. */
export function byItemType(data: BusinessData, dept?: Department): ItemTypeStat[] {
  const sold = soldItems(data).filter((s) => !dept || s.item.department === dept);
  return [...groupBy(sold, (s) => s.item.itemType)]
    .map(([itemType, v]) => ({
      itemType,
      sold: v.length,
      profit: sumMoney(v.map((s) => s.profit)),
      avgProfit: meanOr0(v.map((s) => s.profit)),
      avgDaysToSell: mean(daysOf(v)),
    }))
    .sort((a, b) => b.sold - a.sold || b.profit - a.profit || a.itemType.localeCompare(b.itemType));
}

export interface SizeStat {
  size: string;
  sold: number;
}

/** Best-selling sizes within one department (most sold first). */
export function bySize(data: BusinessData, dept: Department): SizeStat[] {
  const sold = soldItems(data).filter((s) => s.item.department === dept);
  return [...groupBy(sold, (s) => s.item.size || 'Unknown')]
    .map(([size, v]) => ({ size, sold: v.length }))
    .sort((a, b) => b.sold - a.sold || a.size.localeCompare(b.size));
}

export interface TypeByMonth {
  months: string[];
  rows: { itemType: string; /** sold count per month, same order as `months` */ counts: number[]; total: number }[];
  /** Highest single-cell count (for heat-map scaling), at least 1. */
  max: number;
}

/** Items sold by type and month (the "what sells when" heat map). Types are ordered by total sold. */
export function typeByMonth(data: BusinessData, months: string[]): TypeByMonth {
  const sold = soldItems(data).filter((s) => months.includes(monthOf(s.order.soldDate)));
  const rows = [...groupBy(sold, (s) => s.item.itemType)]
    .map(([itemType, v]) => {
      const counts = months.map((m) => v.filter((s) => monthOf(s.order.soldDate) === m).length);
      return { itemType, counts, total: v.length };
    })
    .sort((a, b) => b.total - a.total || a.itemType.localeCompare(b.itemType));
  return { months, rows, max: Math.max(1, ...rows.flatMap((r) => r.counts)) };
}

// ---------------------------------------------------------------------------
// discounts and ad rates
// ---------------------------------------------------------------------------

/** Drop from first listing price to sale price, in percent (can be negative if sold above first price). */
export function dropPct(firstListPrice: number, salePrice: number): number {
  return ((firstListPrice - salePrice) / firstListPrice) * 100;
}

/** Listing price needed to net a target sale price given an average drop: T / (1 - drop). Null if drop >= 100%. */
export function suggestedFirstPrice(target: number, avgDropPct: number): number | null {
  const f = 1 - avgDropPct / 100;
  return f > 0 ? target / f : null;
}

export interface DiscountTypeStat {
  itemType: string;
  sold: number;
  avgFirstPrice: number;
  avgSalePrice: number;
  avgDropPct: number;
}

export interface DiscountStats {
  /** Sold items that had a first list price (the sample for everything below). */
  count: number;
  /** Average drop from first list price to sale price, percent. */
  avgDropPct: number;
  /** Share of those sold at or above first price, percent. */
  soldAtFirstPricePct: number;
  /** Average promoted-listing ad rate, percent (item rate, else the default). */
  avgAdRate: number;
  byType: DiscountTypeStat[];
  /** Listing price to aim for to sell at `target`, given avgDropPct (null with no data). */
  suggestFirstPrice: (target: number) => number | null;
}

/** How far you drop from your first price, overall and by item type, plus a helper to pick a starting price. */
export function discounts(data: BusinessData): DiscountStats {
  const withList = soldItems(data).filter((s) => (s.item.firstListPrice ?? 0) > 0);
  const drop = (s: SoldItem) => dropPct(s.item.firstListPrice as number, s.orderItem.salePrice);
  const avgDropPct = meanOr0(withList.map(drop));
  return {
    count: withList.length,
    avgDropPct,
    soldAtFirstPricePct: withList.length
      ? (withList.filter((s) => s.orderItem.salePrice >= (s.item.firstListPrice as number)).length / withList.length) * 100
      : 0,
    avgAdRate: meanOr0(withList.map((s) => s.item.adRate ?? data.settings.defaultAdRate)),
    byType: [...groupBy(withList, (s) => s.item.itemType)]
      .map(([itemType, v]) => ({
        itemType,
        sold: v.length,
        avgFirstPrice: meanOr0(v.map((s) => s.item.firstListPrice as number)),
        avgSalePrice: meanOr0(v.map((s) => s.orderItem.salePrice)),
        avgDropPct: meanOr0(v.map(drop)),
      }))
      .sort((a, b) => b.avgDropPct - a.avgDropPct || a.itemType.localeCompare(b.itemType)),
    suggestFirstPrice: (target) => (withList.length ? suggestedFirstPrice(target, avgDropPct) : null),
  };
}

export interface AdRateStat {
  /** "3%", "5%+" (5 and over are grouped). */
  label: string;
  sold: number;
  avgDaysToSell: number | null;
  avgAdFee: number;
}

/** Do higher ad rates sell faster? Sold items grouped by ad rate (5% and over together), lowest rate first. */
export function byAdRate(data: BusinessData): AdRateStat[] {
  const sold = soldItems(data);
  const rate = (s: SoldItem) => s.item.adRate ?? data.settings.defaultAdRate;
  const key = (s: SoldItem) => (rate(s) >= 5 ? '5%+' : `${rate(s)}%`);
  return [...groupBy(sold, key)]
    .map(([label, v]) => ({
      label,
      sort: Math.min(...v.map(rate)),
      sold: v.length,
      avgDaysToSell: mean(daysOf(v)),
      avgAdFee: meanOr0(v.map((s) => s.orderItem.adFee)),
    }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort: _sort, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// shops and trips
// ---------------------------------------------------------------------------

export interface ShopStat {
  shopId: string;
  name: string;
  /** Items bought here (any status). */
  bought: number;
  sold: number;
  /** sold / bought, percent. */
  sellThroughPct: number;
  profit: number;
  /** Total cost of the items bought here. */
  totalCost: number;
  /** profit / totalCost (0 when nothing was spent). */
  profitPerDollar: number;
  avgDays: number | null;
  /** Unsold items (draft or listed) and what they cost. */
  leftCount: number;
  leftCost: number;
}

/** Per-shop performance, most profitable first. Own-wardrobe shops are excluded. */
export function shopStats(data: BusinessData): ShopStat[] {
  const sold = soldItems(data);
  return data.shops
    .filter((sh) => sh.kind !== 'wardrobe')
    .map((sh) => {
      const bought = data.items.filter((i) => i.shopId === sh.id);
      const soldHere = sold.filter((s) => s.item.shopId === sh.id);
      const left = bought.filter(isUnsold);
      const totalCost = sumMoney(bought.map((i) => i.cost ?? 0));
      const profit = sumMoney(soldHere.map((s) => s.profit));
      return {
        shopId: sh.id,
        name: sh.name,
        bought: bought.length,
        sold: soldHere.length,
        sellThroughPct: bought.length ? (soldHere.length / bought.length) * 100 : 0,
        profit,
        totalCost,
        profitPerDollar: totalCost > 0 ? profit / totalCost : 0,
        avgDays: mean(daysOf(soldHere)),
        leftCount: left.length,
        leftCost: sumMoney(left.map((i) => i.cost ?? 0)),
      };
    })
    .sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name));
}

export interface TripStats {
  tripId: string;
  /** Trip total (what the receipt says). */
  spent: number;
  /** Items created from this trip's lines (or linked via item.tripId). */
  itemsTotal: number;
  itemsSold: number;
  /** eBay earnings of the sold items. */
  earned: number;
  /** Items still unsold (draft or listed). */
  left: number;
  /** earned - spent. */
  net: number;
}

/** How a shopping trip is doing. Null if the trip id is unknown. */
export function tripStats(data: BusinessData, tripId: string): TripStats | null {
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip) return null;
  const ids = new Set<string>();
  for (const l of trip.lines) if (l.itemId) ids.add(l.itemId);
  for (const i of data.items) if (i.tripId === tripId) ids.add(i.id);
  const items = data.items.filter((i) => ids.has(i.id));
  const soldHere = soldItems(data).filter((s) => ids.has(s.item.id));
  const earned = sumMoney(soldHere.map((s) => s.earnings));
  return {
    tripId,
    spent: trip.total,
    itemsTotal: items.length,
    itemsSold: soldHere.length,
    earned,
    left: items.filter(isUnsold).length,
    net: round2(earned - trip.total),
  };
}

// ---------------------------------------------------------------------------
// price bands, brands, ageing
// ---------------------------------------------------------------------------

export interface PriceBandStat {
  label: string;
  /** Inclusive lower bound of sale price. */
  min: number;
  /** Exclusive upper bound; null = no limit. */
  max: number | null;
  sold: number;
  avgProfit: number;
  avgDays: number | null;
  /** avgProfit / (avgDays / 7), with days floored at 1; 0 when nothing sold. */
  profitPerWeekListed: number;
}

const BANDS: { label: string; min: number; max: number | null }[] = [
  { label: 'Under $30', min: 0, max: 30 },
  { label: '$30–80', min: 30, max: 80 },
  { label: '$80–150', min: 80, max: 150 },
  { label: 'Over $150', min: 150, max: null },
];

/** Sold items grouped by sale price: under 30 / 30–80 / 80–150 / 150+. Always returns all four bands. */
export function priceBands(data: BusinessData): PriceBandStat[] {
  const sold = soldItems(data);
  return BANDS.map((b) => {
    const v = sold.filter((s) => s.orderItem.salePrice >= b.min && (b.max == null || s.orderItem.salePrice < b.max));
    const avgProfit = meanOr0(v.map((s) => s.profit));
    const avgDays = mean(daysOf(v));
    return {
      ...b,
      sold: v.length,
      avgProfit,
      avgDays,
      profitPerWeekListed: v.length && avgDays != null ? avgProfit / (Math.max(avgDays, 1) / 7) : 0,
    };
  });
}

export interface BrandStat {
  brand: string;
  sold: number;
  avgProfit: number;
  avgDays: number | null;
  /** Average all-in price buyers paid (a guide to what buyers will pay). */
  avgBuyerPaid: number;
}

/** Per-brand results, highest average profit first. Items with no brand are grouped as "Unbranded". */
export function brandStats(data: BusinessData): BrandStat[] {
  return [...groupBy(soldItems(data), (s) => s.item.brand.trim() || 'Unbranded')]
    .map(([brand, v]) => ({
      brand,
      sold: v.length,
      avgProfit: meanOr0(v.map((s) => s.profit)),
      avgDays: mean(daysOf(v)),
      avgBuyerPaid: meanOr0(v.map((s) => s.orderItem.allocTotal)),
    }))
    .sort((a, b) => b.avgProfit - a.avgProfit || a.brand.localeCompare(b.brand));
}

export interface AgeBucket {
  label: string;
  minDays: number;
  /** Inclusive upper bound; null = no limit. */
  maxDays: number | null;
  count: number;
  /** What the items in the bucket cost. */
  cost: number;
}

const AGE_BUCKETS: { label: string; minDays: number; maxDays: number | null }[] = [
  { label: '0–30 days', minDays: 0, maxDays: 30 },
  { label: '31–90 days', minDays: 31, maxDays: 90 },
  { label: '91–180 days', minDays: 91, maxDays: 180 },
  { label: '180+ days', minDays: 181, maxDays: null },
];

/**
 * Unsold stock (draft or listed) by age. Age runs from the listed date (or purchase date for items not yet
 * listed); items with neither date fall into the first bucket. Always returns all four buckets.
 */
export function ageing(data: BusinessData, today: string): AgeBucket[] {
  const unsold = data.items.filter(isUnsold);
  return AGE_BUCKETS.map((b) => {
    const v = unsold.filter((i) => {
      const from = i.listedDate ?? i.purchaseDate;
      const age = from ? Math.max(0, daysBetween(from, today)) : 0;
      return age >= b.minDays && (b.maxDays == null || age <= b.maxDays);
    });
    return { ...b, count: v.length, cost: sumMoney(v.map((i) => i.cost ?? 0)) };
  });
}

// ---------------------------------------------------------------------------
// business totals
// ---------------------------------------------------------------------------

export interface BusinessTotals {
  /** eBay earnings of all sold items. */
  earned: number;
  /** Trip totals + cost of items that did not come from a trip. */
  stockBought: number;
  /** Part of stockBought on trip lines marked family or keeping. */
  boughtForFamilyOrSelf: number;
  /** All expenses. */
  supplies: number;
  /** earned - stockBought - supplies ("money in minus money out"). */
  net: number;
  /** Cost of draft and listed items. */
  unsoldAtCost: number;
}

/** All-time money in and out, to check against the bank account. */
export function businessTotals(data: BusinessData): BusinessTotals {
  const earned = sumMoney(soldItems(data).map((s) => s.earnings));
  const stockBought = sumMoney([
    ...data.trips.map((t) => t.total),
    ...data.items.filter((i) => !i.tripId).map((i) => i.cost ?? 0),
  ]);
  const boughtForFamilyOrSelf = sumMoney(
    data.trips.flatMap((t) => t.lines.filter((l) => l.outcome === 'family' || l.outcome === 'keeping').map((l) => l.price)),
  );
  const supplies = sumMoney(data.expenses.map((e) => e.amount));
  return {
    earned,
    stockBought,
    boughtForFamilyOrSelf,
    supplies,
    net: round2(earned - stockBought - supplies),
    unsoldAtCost: sumMoney(data.items.filter(isUnsold).map((i) => i.cost ?? 0)),
  };
}

// ---------------------------------------------------------------------------
// season tip
// ---------------------------------------------------------------------------

export interface SeasonTip {
  season: Season;
  /** "Dec–Feb". */
  months: string;
  /** 'coming_season': based on the same season in earlier years; 'this_season': current season's sales so far. */
  basis: 'coming_season' | 'this_season';
  itemType: string;
  /** Sales of that type in the sample. */
  count: number;
  /** All sales in the sample. */
  totalSales: number;
  /** Draft items of that type waiting to be listed. */
  waitingDrafts: number;
}

/**
 * Best item type for the season. Within 31 days of the next season's start, and if there are sales in that
 * season in earlier years, advises for the coming season from those sales; otherwise uses the current season's
 * sales so far. Null when there are no sales to go on.
 */
export function seasonTip(data: BusinessData, today: string): SeasonTip | null {
  const sold = soldItems(data);
  const build = (season: Season, basis: SeasonTip['basis'], sample: SoldItem[]): SeasonTip | null => {
    if (!sample.length) return null;
    const [itemType, v] = [...groupBy(sample, (s) => s.item.itemType)].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    )[0];
    return {
      season,
      months: seasonMonths(season),
      basis,
      itemType,
      count: v.length,
      totalSales: sample.length,
      waitingDrafts: data.items.filter((i) => i.itemType === itemType && i.status === 'draft').length,
    };
  };

  const start = nextSeasonStart(today);
  if (daysBetween(today, start) <= 31) {
    const coming = nextSeason(today);
    const comingYear = seasonStartYear(start);
    const past = sold.filter(
      (s) => seasonOf(s.order.soldDate) === coming && seasonStartYear(s.order.soldDate) < comingYear,
    );
    const tip = build(coming, 'coming_season', past);
    if (tip) return tip;
  }
  const now = seasonOf(today);
  const nowYear = seasonStartYear(today);
  return build(
    now,
    'this_season',
    sold.filter((s) => seasonOf(s.order.soldDate) === now && seasonStartYear(s.order.soldDate) === nowYear && s.order.soldDate <= today),
  );
}

// ---------------------------------------------------------------------------
// tax year
// ---------------------------------------------------------------------------

export interface TaxYear {
  fy: number;
  /** "FY 2026–27". */
  label: string;
  start: string;
  end: string;
  itemsSold: number;
  /** eBay earnings of items sold in the year. */
  income: number;
  /** Refunds on returns dated in the year (informational: returned items are already left out of income). */
  refunds: number;
  /** Cost of the items sold in the year. */
  costOfSold: number;
  expenses: number;
  /** income - costOfSold - expenses. */
  net: number;
  /** Trips dated in the year + non-trip item costs (by purchase date, else listed date). */
  stockBought: number;
}

/** Summary for one Australian financial year (fy = starting year, 2026 = 1 Jul 2026 - 30 Jun 2027). */
export function taxYear(data: BusinessData, fy: number): TaxYear {
  const inFy = (d: string | null | undefined) => d != null && financialYearOf(d) === fy;
  const sold = soldItems(data).filter((s) => inFy(s.order.soldDate));
  const income = sumMoney(sold.map((s) => s.earnings));
  const costOfSold = sumMoney(sold.map((s) => s.item.cost ?? 0));
  const expenses = sumMoney(data.expenses.filter((e) => inFy(e.expenseDate)).map((e) => e.amount));
  const stockBought = sumMoney([
    ...data.trips.filter((t) => inFy(t.tripDate)).map((t) => t.total),
    ...data.items.filter((i) => !i.tripId && inFy(i.purchaseDate ?? i.listedDate)).map((i) => i.cost ?? 0),
  ]);
  return {
    fy,
    label: fyLabel(fy),
    ...fyRange(fy),
    itemsSold: sold.length,
    income,
    refunds: sumMoney(data.returns.filter((r) => inFy(r.returnDate)).map((r) => r.refundAmount)),
    costOfSold,
    expenses,
    net: round2(income - costOfSold - expenses),
    stockBought,
  };
}

// ---------------------------------------------------------------------------
// what-if pricing
// ---------------------------------------------------------------------------

export interface WhatIfScenario {
  label: string;
  /** Item listing price. */
  listPrice: number;
  /** Postage charged to the buyer (0 = free postage; the label still costs defaultLabelCost). */
  postageCharged: number;
}

export interface WhatIfResult extends WhatIfScenario {
  /** Buyer pays all-in: price + postage charged + protection. */
  buyerPays: number;
  protection: number;
  adFee: number;
  /** price + postage charged - label cost - ad fee. */
  earnings: number;
  /** earnings - cost: what you keep. */
  keep: number;
  /** True on the scenario with the highest `keep` (first wins ties). */
  best: boolean;
}

/** Compare pricing/postage options for one item (label cost = settings.defaultLabelCost). */
export function whatIf(
  item: { cost: number | null; adRate: number | null },
  scenarios: WhatIfScenario[],
  s: Settings,
): WhatIfResult[] {
  const adRate = item.adRate ?? s.defaultAdRate;
  const results = scenarios.map((sc) => {
    const protection = s.protectionFixed + (s.protectionPct / 100) * (sc.listPrice + sc.postageCharged);
    const adFee = adFeeFor(sc.listPrice, sc.postageCharged, adRate, s);
    const buyerPays = sc.listPrice + sc.postageCharged + protection;
    const earnings = buyerPays - protection - s.defaultLabelCost - adFee;
    return { ...sc, buyerPays, protection, adFee, earnings, keep: earnings - (item.cost ?? 0), best: false };
  });
  let bi = -1;
  results.forEach((r, i) => {
    if (bi < 0 || r.keep > results[bi].keep) bi = i;
  });
  if (bi >= 0) results[bi].best = true;
  return results;
}
