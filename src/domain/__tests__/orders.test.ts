/// <reference types="jest" />
import { allocateCents, allocateOrder, saleForItem, salesByItem } from '../orders';
import { ebayEarnings, itemProfit, sumMoney } from '../money';
import { data, item, order, ret, settings } from '../testUtils';

describe('allocateCents', () => {
  it('splits exactly using largest remainder', () => {
    const parts = allocateCents(1000, [1, 1, 1]);
    expect(parts).toEqual([3.34, 3.33, 3.33]);
    expect(sumMoney(parts)).toBe(10);
  });
  it('splits in proportion to weights', () => {
    expect(allocateCents(1250, [3000, 1800])).toEqual([7.81, 4.69]);
  });
  it('splits evenly when weights are all zero', () => {
    expect(allocateCents(101, [0, 0])).toEqual([0.51, 0.5]);
  });
  it('handles empty, zero and single', () => {
    expect(allocateCents(500, [])).toEqual([]);
    expect(allocateCents(0, [5, 5])).toEqual([0, 0]);
    expect(allocateCents(777, [42])).toEqual([7.77]);
  });
});

describe('allocateOrder', () => {
  it('single-item order: no split, allocTotal = price + postage + protection', () => {
    const [a] = allocateOrder(
      { orderTotal: 82, buyerProtection: 6.1, postage: 12.5, items: [{ itemId: 'a', salePrice: 63.4, adRate: 5.4 }] },
      settings,
    );
    expect(a).toEqual({ itemId: 'a', salePrice: 63.4, allocPostage: 12.5, allocProtection: 6.1, adFee: 3.42, allocTotal: 82 });
    expect(ebayEarnings(a)).toBe(59.98);
  });

  it('two-item order sums exactly to the order figures', () => {
    const input = {
      orderTotal: 64.28, buyerProtection: 3.78, postage: 12.5,
      items: [{ itemId: 'a', salePrice: 30, adRate: 5 }, { itemId: 'b', salePrice: 18, adRate: 2 }],
    };
    const [a, b] = allocateOrder(input, settings);
    expect(a.allocPostage).toBe(7.81);
    expect(b.allocPostage).toBe(4.69);
    expect(sumMoney([a.allocPostage, b.allocPostage])).toBe(12.5);
    expect(sumMoney([a.allocProtection, b.allocProtection])).toBe(3.78);
    expect(sumMoney([a.salePrice, b.salePrice, a.allocPostage, b.allocPostage, a.allocProtection, b.allocProtection])).toBe(64.28);
    expect(sumMoney([a.allocTotal, b.allocTotal])).toBe(64.28);
    expect(a.adFee).toBe(1.5); // 5% of 30
    expect(b.adFee).toBe(0.36); // 2% of 18
  });

  it('three awkward items still sum exactly', () => {
    const items = [
      { itemId: 'a', salePrice: 10.01, adRate: 3 },
      { itemId: 'b', salePrice: 20.02, adRate: 3 },
      { itemId: 'c', salePrice: 33.33, adRate: 3 },
    ];
    const out = allocateOrder({ orderTotal: 0, buyerProtection: 4.57, postage: 13.99, items }, settings);
    expect(sumMoney(out.map((o) => o.allocPostage))).toBe(13.99);
    expect(sumMoney(out.map((o) => o.allocProtection))).toBe(4.57);
  });

  it('adFeeBase item_plus_postage adds the postage share to the ad fee base', () => {
    const s = { ...settings, adFeeBase: 'item_plus_postage' as const };
    const [a, b] = allocateOrder(
      { orderTotal: 0, buyerProtection: 0, postage: 10, items: [{ itemId: 'a', salePrice: 50, adRate: 10 }, { itemId: 'b', salePrice: 50, adRate: 10 }] },
      s,
    );
    expect(a.allocPostage).toBe(5);
    expect(a.adFee).toBe(5.5);
    expect(b.adFee).toBe(5.5);
  });

  it('zero sale prices split evenly and do not divide by zero', () => {
    const out = allocateOrder(
      { orderTotal: 0, buyerProtection: 1, postage: 10, items: [{ itemId: 'a', salePrice: 0, adRate: 3 }, { itemId: 'b', salePrice: 0, adRate: 3 }] },
      settings,
    );
    expect(out.map((o) => o.allocPostage)).toEqual([5, 5]);
    expect(out.map((o) => o.allocProtection)).toEqual([0.5, 0.5]);
    expect(out.map((o) => o.adFee)).toEqual([0, 0]);
  });

  it('empty order gives no lines', () => {
    expect(allocateOrder({ orderTotal: 0, buyerProtection: 0, postage: 0, items: [] }, settings)).toEqual([]);
  });

  it('profit across a combined order equals total earnings minus costs', () => {
    const out = allocateOrder(
      { orderTotal: 64.28, buyerProtection: 3.78, postage: 12.5, items: [{ itemId: 'a', salePrice: 30, adRate: 5 }, { itemId: 'b', salePrice: 18, adRate: 2 }] },
      settings,
    );
    const profit = sumMoney([itemProfit({ cost: 7 }, out[0]), itemProfit({ cost: 4 }, out[1])]);
    // buyer paid 64.28, label 12.50, protection 3.78, ads 1.86, cost 11
    expect(profit).toBe(35.14);
  });
});

describe('saleForItem', () => {
  const a = item('a');

  it('returns null when the item has no order', () => {
    expect(saleForItem(data({ items: [a] }), 'a')).toBeNull();
  });

  it('finds the order and order line', () => {
    const o = order('o1', 'a', '2026-10-10', 40);
    const r = saleForItem(data({ items: [a], orders: [o] }), 'a');
    expect(r?.order.id).toBe('o1');
    expect(r?.orderItem.itemId).toBe('a');
  });

  it('finds an item inside a combined order', () => {
    const o = order('o1', 'a', '2026-10-10', 40);
    o.items.push({ itemId: 'b', salePrice: 10, allocPostage: 0, allocProtection: 0, adFee: 0, allocTotal: 10 });
    expect(saleForItem(data({ orders: [o] }), 'b')?.orderItem.salePrice).toBe(10);
  });

  it('keeps a pending or thrown-out return visible (status rule is applied by soldItems)', () => {
    const o = order('o1', 'a', '2026-10-10', 40);
    const d = data({ orders: [o], returns: [ret('r1', 'a', { orderId: 'o1', outcome: 'pending' }), ret('r2', 'a', { orderId: 'o1', outcome: 'thrown_out' })] });
    expect(saleForItem(d, 'a')?.order.id).toBe('o1');
  });

  it('ignores an order whose return was relisted', () => {
    const o = order('o1', 'a', '2026-10-10', 40);
    const d = data({ orders: [o], returns: [ret('r1', 'a', { orderId: 'o1', outcome: 'relisted' })] });
    expect(saleForItem(d, 'a')).toBeNull();
  });

  it('a relisted return with no order id cancels orders sold on or before the return date', () => {
    const o = order('o1', 'a', '2026-10-10', 40);
    const d = data({ orders: [o], returns: [ret('r1', 'a', { orderId: null, returnDate: '2026-10-20', outcome: 'relisted' })] });
    expect(saleForItem(d, 'a')).toBeNull();
  });

  it('sold again after a relist: uses the latest order', () => {
    const o1 = order('o1', 'a', '2026-09-01', 40);
    const o2 = order('o2', 'a', '2026-10-15', 45);
    const d = data({ orders: [o2, o1], returns: [ret('r1', 'a', { orderId: 'o1', outcome: 'relisted' })] });
    expect(saleForItem(d, 'a')?.order.id).toBe('o2');
  });

  it('with two live orders picks the latest by sold date', () => {
    const d = data({ orders: [order('o1', 'a', '2026-09-01', 40), order('o2', 'a', '2026-10-15', 45)] });
    expect(saleForItem(d, 'a')?.order.id).toBe('o2');
  });
});

describe('salesByItem', () => {
  it('maps item ids to their live sale', () => {
    const d = data({
      orders: [order('o1', 'a', '2026-09-01', 40), order('o2', 'b', '2026-09-02', 20), order('o3', 'c', '2026-09-03', 20)],
      returns: [ret('r1', 'c', { orderId: 'o3', outcome: 'relisted' })],
    });
    const m = salesByItem(d);
    expect([...m.keys()].sort()).toEqual(['a', 'b']);
  });
});
