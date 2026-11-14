// Pure helpers for the AI listing writer: comparable sales, applying suggestions, friendly errors.
import { MAX_COMPARABLES, MAX_PHOTOS, MAX_TITLE_LENGTH } from '../../domain/ai';
import type { AiListingResult, AiPriceComparable, AiPriceResult } from '../../domain/ai';
import { soldItems } from '../../domain/analytics';
import type { BusinessData, Department } from '../../domain/types';
import type { ItemFormState, PhotoDraft } from './form';

export interface ComparableQuery {
  brand: string;
  itemType: string;
  department: Department | string;
  size: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Up to `limit` of her own sold items that look like this one, best match first (then most recently sold).
 * Brand counts most, then item type, then size and department. Needs the brand or the item type to match,
 * otherwise a dress of any kind would be "comparable" to a coat.
 */
export function pickComparables(data: BusinessData, q: ComparableQuery, limit: number = MAX_COMPARABLES): AiPriceComparable[] {
  const brand = norm(q.brand);
  const type = norm(q.itemType);
  const dept = norm(q.department);
  const size = norm(q.size);
  const scored = soldItems(data)
    .map((s) => {
      const brandHit = !!brand && norm(s.item.brand) === brand;
      const typeHit = !!type && norm(s.item.itemType) === type;
      if (!brandHit && !typeHit) return null;
      let score = 0;
      if (brandHit) score += 4;
      if (typeHit) score += 3;
      if (dept && norm(s.item.department) === dept) score += 1;
      if (size && norm(s.item.size) === size) score += 1;
      return { s, score };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  scored.sort((a, b) => b.score - a.score || (a.s.order.soldDate < b.s.order.soldDate ? 1 : a.s.order.soldDate > b.s.order.soldDate ? -1 : 0));
  return scored.slice(0, Math.max(0, limit)).map(({ s }) => ({
    title: s.item.title,
    brand: s.item.brand,
    itemType: s.item.itemType,
    size: s.item.size,
    salePrice: Math.max(0, s.orderItem.salePrice),
    daysToSell: Math.max(0, s.daysToSell ?? 0),
  }));
}

/** "38" for whole dollars, "38.50" otherwise; what goes in the price field. */
export function priceText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export type UseMode = 'all' | 'text';

/** The form fields to change when she taps "Use all" (title, description, price) or "Use title and description". */
export function applySuggestion(
  form: ItemFormState,
  listing: AiListingResult,
  price: AiPriceResult | null,
  mode: UseMode,
): ItemFormState {
  const next: ItemFormState = {
    ...form,
    title: listing.title.slice(0, MAX_TITLE_LENGTH),
    description: listing.description,
  };
  if (mode === 'all' && price) next.priceText = priceText(price.suggested);
  return next;
}

/** Text for the "copy" buttons / share sheet. */
export function keywordsLine(keywords: string[]): string {
  return keywords.join(', ');
}

/** Photos that can be sent to the AI: at most MAX_PHOTOS, already-saved ones first (they need no upload). */
export function photosForAi(photos: PhotoDraft[]): PhotoDraft[] {
  return [...photos.filter((p) => p.existing), ...photos.filter((p) => !p.existing)].slice(0, MAX_PHOTOS);
}

/** Turns an error from the ai function into words for Kat. */
export function aiErrorText(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('used all')) return message; // daily cap, already friendly
  if (m.includes('sign in')) return 'Please sign in again, then try once more.';
  if (m.includes('not found') || m.includes('not been set up') || m.includes('not set up') || m.includes('could not be reached')) {
    return 'The AI helper could not be reached. Check your signal and try again. If it keeps happening, ask Greg to finish the AI setup.';
  }
  if (m.includes('not available right now')) return 'The AI helper is not available right now. Try again in a minute, or ask Greg to finish the AI setup.';
  return message || 'Something went wrong. Please try again.';
}
