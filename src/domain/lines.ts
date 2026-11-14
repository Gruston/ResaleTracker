import type { Trip, TripLine } from './types';

export type NewTripLine = Omit<TripLine, 'id'>;

function singular(s: string): string {
  const t = s.trim();
  return t.length > 1 && /[^s]s$/i.test(t) ? t.slice(0, -1) : t;
}

/**
 * Split a receipt line with qty > 1 into `qty` lines of qty 1 at an even price (remainder cents on the first).
 * "Cotton On tops" qty 3 $15 -> "Cotton On top 1/2/3" at $5.00. A qty <= 1 line comes back as a single copy.
 * New lines have no id; sort values run on from the original line's sort.
 */
export function splitLine(line: TripLine): NewTripLine[] {
  const { id: _id, ...rest } = line;
  if (line.qty <= 1) return [{ ...rest }];
  const total = Math.round(line.price * 100);
  const base = Math.floor(total / line.qty);
  const extra = total - base * line.qty;
  const name = singular(line.description);
  return Array.from({ length: line.qty }, (_, i) => ({
    ...rest,
    description: `${name} ${i + 1}`,
    qty: 1,
    price: (i === 0 ? base + extra : base) / 100,
    itemId: i === 0 ? line.itemId : null,
    sort: line.sort + i,
  }));
}

/** Progress of sorting a trip's receipt: `sorted` lines (outcome other than 'to_list') out of `total` lines. */
export function tripProgress(trip: Pick<Trip, 'lines'>): { sorted: number; total: number } {
  return {
    sorted: trip.lines.filter((l) => l.outcome !== 'to_list').length,
    total: trip.lines.length,
  };
}
