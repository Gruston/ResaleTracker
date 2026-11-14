/// <reference types="jest" />
import { item, settings } from '../../../domain/testUtils';
import type { Shop, SkuCode } from '../../../domain/types';
import {
  buildItemPatch,
  buildNewItemInput,
  costFor,
  emptyForm,
  formFromItem,
  formFromReceiptParams,
  hasErrors,
  isValidDate,
  itemTypeOptions,
  parseMoney,
  skuPreview,
  validateForm,
} from '../form';

const codes: SkuCode[] = [
  { kind: 'department', label: 'Women', code: 'W', sort: 0 },
  { kind: 'department', label: 'Men', code: 'M', sort: 1 },
  { kind: 'item_type', label: 'Skirt', code: 'S', sort: 2 },
  { kind: 'item_type', label: 'Dress', code: 'D', sort: 1 },
];
const shops: Shop[] = [
  { id: 's1', name: 'Vinnies', kind: 'shop', archived: false },
  { id: 'w', name: 'My wardrobe', kind: 'wardrobe', archived: false },
];
const ctx = { shops, settings, today: '2026-11-14', tripId: null, tripLineId: null, purchaseDate: null };
const base = { ...emptyForm(settings, ['Dress']), brand: ' Gorman ', size: ' 10 ', itemType: 'Dress' };

describe('parseMoney', () => {
  it('parses typed amounts', () => {
    expect(parseMoney('12.50')).toBe(12.5);
    expect(parseMoney('$1,200')).toBe(1200);
    expect(parseMoney(' 8 ')).toBe(8);
    expect(parseMoney('.5')).toBe(0.5);
    expect(parseMoney('0')).toBe(0);
  });
  it('rejects blanks and junk', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('1.2.3')).toBeNull();
  });
});

describe('helpers', () => {
  it('validates dates', () => {
    expect(isValidDate('2026-11-14')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('14/11/2026')).toBe(false);
  });
  it('lists item types in sort order', () => {
    expect(itemTypeOptions(codes)).toEqual(['Dress', 'Skirt']);
  });
  it('previews the SKU prefix', () => {
    expect(skuPreview('Women', 'Dress', codes)).toBe('WD-0xx');
    expect(skuPreview('Men', 'Skirt', codes)).toBe('MS-0xx');
  });
  it('flags errors', () => {
    expect(hasErrors(validateForm(base))).toBe(false);
    const e = validateForm({ ...base, costText: 'x', priceText: '0', adText: '120', listedDate: 'soon' });
    expect(Object.keys(e).sort()).toEqual(['ad', 'cost', 'listedDate', 'price']);
  });
  it('wardrobe forces cost 0', () => {
    expect(costFor({ ...base, shopId: 'w', costText: '15' }, shops)).toBe(0);
    expect(costFor({ ...base, shopId: 's1', costText: '15' }, shops)).toBe(15);
    expect(costFor({ ...base, shopId: 's1', costText: '' }, shops)).toBeNull();
  });
});

describe('buildNewItemInput', () => {
  it('is a draft without a price', () => {
    const i = buildNewItemInput({ ...base, title: '' }, ctx);
    expect(i.status).toBe('draft');
    expect(i.listedDate).toBeNull();
    expect(i.firstListPrice).toBeNull();
    expect(i.title).toBe('Dress');
    expect(i.brand).toBe('Gorman');
    expect(i.size).toBe('10');
  });
  it('is listed today with a price and the default ad rate', () => {
    const i = buildNewItemInput({ ...base, title: 'Nice', priceText: '45' }, ctx);
    expect(i.status).toBe('listed');
    expect(i.listedDate).toBe('2026-11-14');
    expect(i.firstListPrice).toBe(45);
    expect(i.adRate).toBe(3);
  });
  it('keeps a chosen date and ad rate, and trims the title to 80', () => {
    const i = buildNewItemInput(
      { ...base, title: 'x'.repeat(100), priceText: '45', adText: '5', listedDate: '2026-11-01' },
      { ...ctx, tripId: 't1', tripLineId: 'l1', purchaseDate: '2026-10-30' },
    );
    expect(i.listedDate).toBe('2026-11-01');
    expect(i.adRate).toBe(5);
    expect(i.title).toHaveLength(80);
    expect(i.tripLineId).toBe('l1');
    expect(i.purchaseDate).toBe('2026-10-30');
  });
});

describe('buildItemPatch', () => {
  it('moves draft -> listed when a price is added', () => {
    const it = item('1', { status: 'draft', listedDate: null, firstListPrice: null, adRate: null });
    const f = { ...formFromItem(it, settings), priceText: '30' };
    const p = buildItemPatch(f, it, shops, settings, '2026-11-14');
    expect(p.status).toBe('listed');
    expect(p.listedDate).toBe('2026-11-14');
    expect(p.firstListPrice).toBe(30);
  });
  it('keeps sold status and listed date', () => {
    const it = item('1', { status: 'sold', listedDate: '2026-09-01' });
    const f = { ...formFromItem(it, settings), priceText: '' };
    const p = buildItemPatch(f, it, shops, settings, '2026-11-14');
    expect(p.status).toBe('sold');
    expect(p.listedDate).toBe('2026-09-01');
  });
  it('drops back to draft when the price is cleared', () => {
    const it = item('1', { status: 'listed' });
    const p = buildItemPatch({ ...formFromItem(it, settings), priceText: '' }, it, shops, settings, '2026-11-14');
    expect(p.status).toBe('draft');
    expect(p.listedDate).toBeNull();
  });
});

describe('form prefill', () => {
  it('round trips an item', () => {
    const it = item('1', { cost: 0, firstListPrice: 55.5, adRate: null });
    const f = formFromItem(it, settings);
    expect(f.costText).toBe('0');
    expect(f.priceText).toBe('55.5');
    expect(f.adText).toBe('3');
  });
  it('applies receipt params', () => {
    const f = formFromReceiptParams(emptyForm(settings, ['Dress']), { shopId: 's1', cost: '14', brand: 'Country Road' });
    expect(f.shopId).toBe('s1');
    expect(f.costText).toBe('14');
    expect(f.brand).toBe('Country Road');
  });
});
