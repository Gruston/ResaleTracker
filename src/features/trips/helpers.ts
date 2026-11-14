import { formatMoney, round2, sumMoney } from '@/domain/money';
import { tripProgress } from '@/domain/lines';
import type { LineOutcome, Shop, Trip, TripLine } from '@/domain/types';

/** Parses what a person types into a money box ("$12", "12.5", "1,200.00"). Null when empty or not a number. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (!cleaned || !/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? round2(n) : null;
}

/** Whole-number quantity of at least 1, else null. */
export function parseQty(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 999 ? n : null;
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= days;
}

/** "3 × Cotton On tops" (just the description when qty is 1). */
export function lineHeading(l: Pick<TripLine, 'qty' | 'description'>): string {
  return l.qty > 1 ? `${l.qty} × ${l.description}` : l.description;
}

/** Price of one piece on a multi-piece line. */
export function perEach(l: Pick<TripLine, 'qty' | 'price'>): number {
  return l.qty > 0 ? l.price / l.qty : l.price;
}

/** First word(s) of a description, used to pre-fill the brand when creating an item ("Country Road linen dress" -> "Country Road"). */
export function brandGuess(description: string): string {
  const words = description.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return words.slice(0, words[0].toLowerCase() === 'country' && words.length > 1 ? 2 : 1).join(' ');
}

/** Sum of all receipt line prices. */
export function linesTotal(trip: Pick<Trip, 'lines'>): number {
  return sumMoney(trip.lines.map((l) => l.price));
}

/**
 * A gentle note when the lines do not add up to the receipt total (more than 5 cents apart), else null.
 * Nothing is shown while there are no lines yet.
 */
export function totalMismatchNote(trip: Pick<Trip, 'lines' | 'total'>): string | null {
  if (!trip.lines.length) return null;
  const sum = linesTotal(trip);
  if (Math.abs(sum - trip.total) <= 0.05) return null;
  return `Lines add up to ${formatMoney(sum)}; receipt says ${formatMoney(trip.total)}.`;
}

/** Trips newest first (ties keep a stable order). */
export function sortTripsNewest<T extends Pick<Trip, 'tripDate'>>(trips: readonly T[]): T[] {
  return trips
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t.tripDate.localeCompare(a.t.tripDate) || a.i - b.i)
    .map((x) => x.t);
}

/** "9 of 12 sorted". */
export function sortedLabel(trip: Pick<Trip, 'lines'>): string {
  const { sorted, total } = tripProgress(trip);
  return `${sorted} of ${total} sorted`;
}

/** A trip is Done once it has lines and every one has an outcome. */
export function isTripDone(trip: Pick<Trip, 'lines'>): boolean {
  const { sorted, total } = tripProgress(trip);
  return total > 0 && sorted === total;
}

/** Shop name for a trip, tolerating a deleted shop or none. */
export function shopName(shops: readonly Pick<Shop, 'id' | 'name'>[], shopId: string | null): string {
  return shops.find((s) => s.id === shopId)?.name ?? 'Unknown shop';
}

/** Pill label for a receipt line: "To list", "Listed" (the SKU is shown alongside), "For family", ... */
export function pillTone(outcome: LineOutcome): 'sold' | 'listed' | 'faulty' | 'draft' {
  return outcome === 'to_list' ? 'sold' : outcome === 'listed' ? 'listed' : outcome === 'faulty' ? 'faulty' : 'draft';
}

/** Draft receipt line while filling in the new-trip form (text as typed). */
export interface DraftLine {
  key: string;
  description: string;
  qty: string;
  price: string;
}

/** Turns typed draft lines into valid lines; rows that are completely blank are skipped, partial rows are reported. */
export function readDraftLines(drafts: readonly DraftLine[]): {
  lines: { description: string; qty: number; price: number }[];
  invalid: string[];
} {
  const lines: { description: string; qty: number; price: number }[] = [];
  const invalid: string[] = [];
  for (const d of drafts) {
    const blank = !d.description.trim() && !d.price.trim();
    if (blank) continue;
    const qty = parseQty(d.qty || '1');
    const price = parseMoney(d.price);
    if (!d.description.trim() || qty === null || price === null) {
      invalid.push(d.key);
      continue;
    }
    lines.push({ description: d.description.trim(), qty, price });
  }
  return { lines, invalid };
}
