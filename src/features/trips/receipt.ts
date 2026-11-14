import type { AiReceiptLine, AiReceiptResult } from '@/domain/ai';
import { formatMoney, round2, sumMoney } from '@/domain/money';
import type { Shop } from '@/domain/types';
import type { DraftLine } from './helpers';
import { isValidDate } from './helpers';

// ---- Shop matching ---------------------------------------------------------------------------------------------

const NOISE = new Set(['op', 'shop', 'shops', 'store', 'stores', 'the', 'and', 'charity', 'pty', 'ltd']);

/** Lower case, punctuation removed, noise words ("op shop", "store") dropped: "Salvos Stores" -> "salvos". */
export function normaliseShopName(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !NOISE.has(w));
  return words.join(' ');
}

/** The existing shop that the receipt's shop name refers to, or null. Archived shops only match if nothing else does. */
export function matchShop(name: string | undefined, shops: readonly Shop[]): Shop | null {
  if (!name) return null;
  const target = normaliseShopName(name);
  if (!target) return null;
  const hit = (s: Shop) => normaliseShopName(s.name) === target;
  return shops.find((s) => !s.archived && hit(s)) ?? shops.find(hit) ?? null;
}

// ---- Date ------------------------------------------------------------------------------------------------------

/** The receipt date when it is a real date, not in the future and not absurdly old; otherwise null. */
export function sanitiseReceiptDate(date: string | undefined, todayIso: string): string | null {
  if (!date || !isValidDate(date)) return null;
  if (date > todayIso) return null;
  const year = Number(date.slice(0, 4));
  if (year < Number(todayIso.slice(0, 4)) - 2) return null;
  return date;
}

// ---- Lines -----------------------------------------------------------------------------------------------------

const isBlank = (d: DraftLine) => !d.description.trim() && !d.price.trim();

const toDraft = (l: AiReceiptLine, key: string): DraftLine => ({
  key,
  description: l.description,
  qty: String(l.qty),
  price: l.price.toFixed(2),
});

/**
 * Puts the AI's lines into the draft list. If every existing draft is blank they are replaced; otherwise the new
 * lines are appended and what Kat typed is kept. `makeKey` creates keys for new drafts.
 */
export function mergeDraftLines(existing: readonly DraftLine[], incoming: readonly AiReceiptLine[], makeKey: () => string): DraftLine[] {
  if (!incoming.length) return [...existing];
  const fresh = incoming.map((l) => toDraft(l, makeKey()));
  if (existing.every(isBlank)) return fresh;
  return [...existing.filter((d) => !isBlank(d)), ...fresh];
}

// ---- Totals check ----------------------------------------------------------------------------------------------

export interface ReceiptCheck {
  lineCount: number;
  linesSum: number;
  total: number | null;
  /** lines minus total (positive = lines add up to more); null when there is no total */
  difference: number | null;
  matches: boolean;
}

/** Compares the lines with the receipt total. Within 5 cents counts as matching. */
export function checkReceipt(lines: readonly Pick<AiReceiptLine, 'price'>[], total: number | null | undefined): ReceiptCheck {
  const linesSum = sumMoney(lines.map((l) => l.price));
  if (total === null || total === undefined) {
    return { lineCount: lines.length, linesSum, total: null, difference: null, matches: true };
  }
  const difference = round2(linesSum - total);
  return { lineCount: lines.length, linesSum, total, difference, matches: Math.abs(difference) <= 0.05 };
}

/** "Read 7 lines, $64.00 total. Check them before saving." */
export function summaryText(check: ReceiptCheck): string {
  const n = check.lineCount;
  const lines = `${n} ${n === 1 ? 'line' : 'lines'}`;
  const tail = check.total !== null ? `, ${formatMoney(check.total)} total` : '';
  return `Read ${lines}${tail}. Check them before saving.`;
}

/** "The lines add up to $60.50, which is $3.50 less than the total." null when they match or there is no total. */
export function mismatchText(check: ReceiptCheck): string | null {
  if (check.matches || check.difference === null || check.total === null) return null;
  const diff = formatMoney(Math.abs(check.difference));
  return `The lines add up to ${formatMoney(check.linesSum)}, which is ${diff} ${check.difference < 0 ? 'less' : 'more'} than the total. Check for a missing or misread line.`;
}

// ---- Errors ----------------------------------------------------------------------------------------------------

export interface FriendlyReceiptError {
  message: string;
  /** Trying again straight away is unlikely to help (cap reached, not set up). */
  retry: boolean;
}

/** Turns an error from aiReceipt into words for Kat. */
export function friendlyReceiptError(e: unknown): FriendlyReceiptError {
  const raw = e instanceof Error ? e.message : '';
  const m = raw.toLowerCase();
  if (/(limit|cap|too many|used all|today)/.test(m) && /(ai|helper|call|limit|cap)/.test(m)) {
    return { message: raw || 'You have used all the AI helpers for today. Type the receipt in yourself, or try again tomorrow.', retry: false };
  }
  if (/(404|not found|non-2xx|not set up|not deployed|api key|anthropic_api_key|not configured|relay)/.test(m)) {
    return { message: 'The AI helper is not set up yet. Ask Greg to finish the AI setup.', retry: false };
  }
  if (/(network|internet|offline|signal|fetch|reached|timed out|timeout)/.test(m)) {
    return { message: 'No internet right now. Check your signal and try again.', retry: true };
  }
  return { message: raw || 'Could not read that receipt. Try again, or type it in yourself.', retry: true };
}

export function resultHasContent(r: AiReceiptResult): boolean {
  return r.lines.length > 0 || r.total !== undefined || !!r.shop || !!r.date;
}
