import {
  formatMoney,
  formatMoney0,
  monthOf,
  monthsEndingAt,
  type AgeBucket,
  type BusinessData,
  soldItems,
  type Department,
  type DiscountStats,
  type ItemTypeStat,
  type PriceBandStat,
  type SeasonTip,
  type TypeByMonth,
  type ShopStat,
} from '@/domain';

/** Pure presentation helpers for Home and Insights. No React. */

/** The nine months shown in charts, oldest first, ending this month. */
export function chartMonths(today: string, count = 9): string[] {
  return monthsEndingAt(monthOf(today), count);
}

export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** "Dress" -> "Dresses", "Top" -> "Tops" (as the prototype does for the season tip). */
export function pluralType(itemType: string): string {
  return itemType.endsWith('s') ? `${itemType}es` : `${itemType}s`;
}

/** Whole days, or an em dash when unknown. */
export function fmtDays(d: number | null | undefined): string {
  return d == null || !Number.isFinite(d) ? '—' : String(Math.round(d));
}

export function fmtPct(n: number): string {
  return `${Math.round(Number.isFinite(n) ? n : 0)}%`;
}

/** Money with a dash when there is nothing behind the figure. */
export function moneyOrDash(n: number, has: boolean, whole = true): string {
  if (!has) return '—';
  return whole ? formatMoney0(n) : formatMoney(n);
}

export interface SeasonTipText {
  heading: string;
  body: string;
  footnote: string;
}

/** Wording of the Season tip card (matches the prototype). */
export function seasonTipText(tip: SeasonTip): SeasonTipText {
  const plur = pluralType(tip.itemType);
  const lower = plur.toLowerCase();
  const season = tip.season.toLowerCase();
  const waiting = tip.waitingDrafts ? ` (${tip.waitingDrafts} not listed yet)` : '';
  if (tip.basis === 'coming_season') {
    return {
      heading: `Season tip · ${tip.season} (${tip.months}) is coming`,
      body: `${plur} were your best ${season} seller last time: ${tip.count} of ${tip.totalSales} sales. List any ${lower} you have waiting now${waiting}.`,
      footnote: 'Tips arrive a month before each season, from the same season in earlier years.',
    };
  }
  return {
    heading: `Season tip · ${tip.season} (${tip.months})`,
    body: `${plur} are your best ${season} seller: ${tip.count} of ${tip.totalSales} sales this season. List any ${lower} you have waiting now${waiting}.`,
    footnote: 'Next year, tips arrive a month before each season, from the same season last year.',
  };
}

export type Dept = 'All' | 'Women' | 'Men' | 'Kids' | 'Unisex';

export function bestTypeSentence(types: ItemTypeStat[], dept: Dept): string | null {
  const best = types[0];
  if (!best) return null;
  return `Your best-selling item type${dept !== 'All' ? ` in ${dept}` : ''} is ${best.itemType}, with ${best.sold} sold.`;
}

export function discountSentence(d: DiscountStats, target = 90): string | null {
  if (!d.count) return null;
  const drop = Math.round(d.avgDropPct);
  const first = d.suggestFirstPrice(target);
  const below = drop >= 0 ? `${Math.abs(drop)}% below` : `${Math.abs(drop)}% above`;
  const tail = first != null ? ` To get about ${formatMoney0(target)}, list at about ${formatMoney0(first)}.` : '';
  return `On average you sell for ${below} your first listing price.${tail}`;
}

/** Two lines: most profitable shop, shop with most unsold stock. */
export function shopInsightLines(shops: ShopStat[]): string[] {
  const withBought = shops.filter((s) => s.bought > 0);
  if (!withBought.length) return [];
  const lines: string[] = [];
  const top = [...withBought].sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name))[0];
  if (top.sold > 0) {
    lines.push(
      `Most profitable shop: ${top.name} (${formatMoney0(top.profit)} profit, ${formatMoney(top.profitPerDollar)} back per $1 spent).`,
    );
  }
  const left = [...withBought].sort((a, b) => b.leftCount - a.leftCount || b.leftCost - a.leftCost)[0];
  if (left.leftCount > 0) {
    lines.push(
      `Most unsold stock: ${left.name} (${left.leftCount} ${plural(left.leftCount, 'item')} unsold, ${formatMoney0(left.leftCost)} tied up).`,
    );
  }
  return lines;
}

export function priceBandSentence(bands: PriceBandStat[]): string | null {
  const withSales = bands.filter((b) => b.sold > 0 && b.avgDays != null);
  if (!withSales.length) return null;
  const best = [...withSales].sort((a, b) => b.profitPerWeekListed - a.profitPerWeekListed)[0];
  return `Profit per week listed is highest for ${best.label} items (${formatMoney(best.profitPerWeekListed)}/week). Cheaper items sell faster; expensive ones earn more each but tie up money longer.`;
}

/** Short shop label for the "Unsold stock by shop" bars: "The Salvos Surry Hills" -> "Salvos". */
export function shortShopName(name: string): string {
  const w = name.replace(/^The\s+/i, '').split(' ')[0];
  return w || name;
}

export function ageLabel(b: AgeBucket): string {
  return b.maxDays == null ? 'Over 180 days' : b.label;
}

/** Heat-map cell background: transparent for zero, else green with opacity by count. */
export function heatColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return 'transparent';
  return `rgba(46,107,94,${(0.15 + (0.6 * count) / max).toFixed(2)})`;
}
/** White text on dark cells. */
export function heatTextDark(count: number, max: number): boolean {
  return max > 0 && count / max > 0.6;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export interface HomeAlerts {
  /** Trips with receipt lines still 'to_list'. */
  tripsToList: { tripId: string; count: number; shopName: string; date: string }[];
  toPost: { count: number; names: string[] };
  missingCost: { count: number; firstId: string | null };
}

export function homeAlerts(data: BusinessData): HomeAlerts {
  const tripsToList = data.trips
    .map((t) => ({
      tripId: t.id,
      count: t.lines.filter((l) => l.outcome === 'to_list').length,
      shopName: data.shops.find((s) => s.id === t.shopId)?.name ?? 'Shopping trip',
      date: t.tripDate,
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  const toPostItems = data.items.filter((i) => i.status === 'sold');
  const noCost = data.items.filter((i) => i.cost == null && i.status !== 'returned' && i.status !== 'faulty');
  return {
    tripsToList,
    toPost: {
      count: toPostItems.length,
      names: toPostItems.map((i) => [i.brand, i.title].filter(Boolean).join(' ')),
    },
    missingCost: { count: noCost.length, firstId: noCost[0]?.id ?? null },
  };
}

export interface StockSummary {
  count: number;
  cost: number;
  asking: number;
}

export function stockSummary(data: BusinessData): StockSummary {
  const listed = data.items.filter((i) => i.status === 'listed');
  const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
  return {
    count: listed.length,
    cost: sum(listed.map((i) => i.cost ?? 0)),
    asking: sum(listed.map((i) => i.firstListPrice ?? 0)),
  };
}

/** typeByMonth for one department (or all). */
export function typeByMonthFor(data: BusinessData, months: string[], dept?: Department): TypeByMonth {
  const sold = soldItems(data).filter(
    (s) => (!dept || s.item.department === dept) && months.includes(monthOf(s.order.soldDate)),
  );
  const types = new Map<string, number[]>();
  for (const s of sold) {
    const counts = types.get(s.item.itemType) ?? months.map(() => 0);
    counts[months.indexOf(monthOf(s.order.soldDate))] += 1;
    types.set(s.item.itemType, counts);
  }
  const rows = [...types].map(([itemType, counts]) => ({ itemType, counts, total: counts.reduce((a, b) => a + b, 0) }));
  rows.sort((a, b) => b.total - a.total || a.itemType.localeCompare(b.itemType));
  return { months, rows, max: Math.max(1, ...rows.flatMap((r) => r.counts)) };
}
