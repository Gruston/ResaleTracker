/// <reference types="jest" />
import type { AiListingResult, AiPriceResult } from '../../../domain/ai';
import type { BusinessData, Item, Order, OrderItem } from '../../../domain/types';
import { aiErrorText, applySuggestion, photosForAi, pickComparables, priceText } from '../ai';
import type { ItemFormState } from '../form';

const mkItem = (id: string, over: Partial<Item>): Item => ({
  id, sku: id, skuPrefix: 'WDR', skuNumber: 1, title: `Title ${id}`, brand: 'Country Road', department: 'Women',
  itemType: 'Dress', size: '10', description: '', shopId: null, tripId: null, tripLineId: null, purchaseDate: null,
  cost: 5, onlineOrderNo: null, status: 'sold', listedDate: '2026-01-01', firstListPrice: 40, adRate: 5,
  channel: 'ebay', ebayListingId: null, photos: [], ...over,
});
const mkOrder = (id: string, soldDate: string, items: OrderItem[]): Order =>
  ({ id, channel: 'ebay', orderNo: null, soldDate, orderTotal: 40, buyerProtection: 0, postage: 0, trackingNo: null, postedDate: null, postageReceiptPath: null, items } as unknown as Order);
const mkOi = (itemId: string, salePrice: number): OrderItem =>
  ({ itemId, salePrice, allocPostage: 0, allocProtection: 0, adFee: 0, allocTotal: salePrice });

function dataWith(items: Item[], prices: number[] = []): BusinessData {
  const orders = items.map((it, i) => mkOrder(`o${i}`, `2026-02-${String(10 + (i % 18)).padStart(2, '0')}`, [mkOi(it.id, prices[i] ?? 30)]));
  return { items, orders, returns: [] } as unknown as BusinessData;
}

describe('pickComparables', () => {
  it('needs a brand or type match and ranks best first', () => {
    const items = [
      mkItem('a', { brand: 'Zara', itemType: 'Coat' }),
      mkItem('b', { brand: 'Country Road', itemType: 'Dress', size: '12' }),
      mkItem('c', { brand: 'Country Road', itemType: 'Dress', size: '10' }),
      mkItem('d', { brand: 'Witchery', itemType: 'Dress', size: '10' }),
    ];
    const out = pickComparables(dataWith(items), { brand: 'country road', itemType: 'Dress', department: 'Women', size: '10' });
    expect(out.map((c) => c.title)).toEqual(['Title c', 'Title b', 'Title d']);
  });

  it('caps at the limit and ignores unsold items', () => {
    const items = Array.from({ length: 40 }, (_, i) => mkItem(`i${i}`, {}));
    items.push(mkItem('draft', { status: 'listed' }));
    const data = dataWith(items);
    expect(pickComparables(data, { brand: 'Country Road', itemType: 'Dress', department: 'Women', size: '10' })).toHaveLength(30);
    expect(pickComparables(data, { brand: '', itemType: '', department: 'Women', size: '10' })).toEqual([]);
  });
});

describe('applySuggestion', () => {
  const form = { title: 'old', description: 'old', priceText: '12', brand: 'X' } as unknown as ItemFormState;
  const listing: AiListingResult = { title: 'New title', description: 'New description here', keywords: ['a'] };
  const price: AiPriceResult = { low: 20, high: 40, suggested: 32.5, reasoning: 'why' };
  it('use all fills price too', () => {
    const r = applySuggestion(form, listing, price, 'all');
    expect([r.title, r.description, r.priceText, r.brand]).toEqual(['New title', 'New description here', '32.50', 'X']);
  });
  it('text only keeps price', () => {
    expect(applySuggestion(form, listing, price, 'text').priceText).toBe('12');
  });
  it('use all without a price keeps price', () => {
    expect(applySuggestion(form, listing, null, 'all').priceText).toBe('12');
  });
  it('formats whole dollars', () => expect(priceText(38)).toBe('38'));
});

describe('photosForAi / aiErrorText', () => {
  it('limits to six, saved first', () => {
    const ps = Array.from({ length: 8 }, (_, i) => ({ key: `k${i}`, path: `p${i}`, existing: i === 7 }));
    const r = photosForAi(ps);
    expect(r).toHaveLength(6);
    expect(r[0].key).toBe('k7');
  });
  it('maps messages', () => {
    expect(aiErrorText("You've used all 50 AI helpers for today. They reset tomorrow.")).toContain('used all 50');
    expect(aiErrorText('The AI helper could not be reached. Check your signal and try again.')).toContain('ask Greg');
  });
});
