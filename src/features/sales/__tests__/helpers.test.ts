/// <reference types="jest" />
import { item, settings } from '@/domain/testUtils';
import { addableItems, amountText, breakdownValues, isValidDate, parseAmount, previewSale, validateSaleForm } from '../helpers';

describe('parseAmount', () => {
  it('parses money text', () => {
    expect(parseAmount('$1,234.50')).toBe(1234.5);
    expect(parseAmount(' 12.5 ')).toBe(12.5);
    expect(parseAmount('.5')).toBe(0.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
  });
  it('formats with two decimals', () => {
    expect(amountText(12.5)).toBe('12.50');
  });
});

describe('isValidDate', () => {
  it('accepts real dates only', () => {
    expect(isValidDate('2026-11-14')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('14/11/2026')).toBe(false);
  });
});

describe('previewSale', () => {
  const a = item('a', { cost: 10, adRate: 5 });
  const b = item('b', { cost: 4, adRate: 2 });
  it('single item that adds up', () => {
    const p = previewSale({ orderTotal: 82, buyerProtection: 6.1, postage: 12.5, items: [{ item: a, salePrice: 63.4 }] }, settings);
    expect(p.partsTotal).toBe(82);
    expect(p.matches).toBe(true);
    expect(p.rows[0].earnings).toBe(60.23);
    expect(p.rows[0].profit).toBe(50.23);
  });
  it('combined order splits and sums', () => {
    const p = previewSale(
      { orderTotal: 64.28, buyerProtection: 3.78, postage: 12.5, items: [{ item: a, salePrice: 30 }, { item: b, salePrice: 18 }] },
      settings,
    );
    expect(p.matches).toBe(true);
    expect(p.rows).toHaveLength(2);
    expect(p.totalProfit).toBe(Math.round((p.rows[0].profit + p.rows[1].profit) * 100) / 100);
  });
  it('reports the difference when the parts do not add up', () => {
    const p = previewSale({ orderTotal: 90, buyerProtection: 6.1, postage: 12.5, items: [{ item: a, salePrice: 63.4 }] }, settings);
    expect(p.matches).toBe(false);
    expect(p.difference).toBe(8);
  });
});

describe('validateSaleForm', () => {
  const ok = { orderNo: '', soldDate: '2026-11-14', orderTotal: '82', buyerProtection: '6.10', postage: '12.50', prices: ['63.40'] };
  it('accepts a good form', () => {
    const r = validateSaleForm(ok);
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ orderTotal: 82, buyerProtection: 6.1, postage: 12.5, prices: [63.4] });
  });
  it('flags problems', () => {
    const r = validateSaleForm({ ...ok, soldDate: 'x', orderTotal: '', prices: ['', '5'] });
    expect(r.ok).toBe(false);
    expect(r.errors.soldDate).toBeDefined();
    expect(r.errors.orderTotal).toBeDefined();
    expect(r.errors.prices[0]).toBeDefined();
    expect(r.errors.prices[1]).toBeUndefined();
  });
  it('treats blank protection and postage as 0', () => {
    expect(validateSaleForm({ ...ok, buyerProtection: '', postage: '' }).ok).toBe(true);
  });
});

describe('breakdownValues', () => {
  it('clamps the bar profit at 0 for a loss', () => {
    const v = breakdownValues({ itemId: 'a', salePrice: 10, allocPostage: 5, allocProtection: 1, adFee: 0.5, allocTotal: 16 }, 20);
    expect(v.profit).toBe(-10.5 + 0);
    expect(v.barProfit).toBe(0);
  });
});

describe('addableItems', () => {
  const items = [item('a', { title: 'Zed', status: 'listed' }), item('b', { title: 'Alpha', status: 'listed' }), item('c', { status: 'sold' })];
  it('lists only listed items not already chosen, filtered and sorted', () => {
    expect(addableItems(items, [], '').map((i) => i.id)).toEqual(['b', 'a']);
    expect(addableItems(items, ['b'], '').map((i) => i.id)).toEqual(['a']);
    expect(addableItems(items, [], 'zed').map((i) => i.id)).toEqual(['a']);
  });
});
