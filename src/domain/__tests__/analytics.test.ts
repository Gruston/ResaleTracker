/// <reference types="jest" />
import {
  ageing, brandStats, businessTotals, byAdRate, byItemType, bySize, discounts, dropPct, kpisForMonth, priceBands,
  profitByMonth, seasonTip, shopStats, soldItems, suggestedFirstPrice, taxYear, tripStats, typeByMonth, whatIf,
} from '../analytics';
import { sampleData } from '../fixtures';
import { sumMoney } from '../money';
import { data, expense, item, line, order, ret, settings, trip } from '../testUtils';
import type { Shop } from '../types';

const T = '2026-11-14';

describe('soldItems', () => {
  it('computes earnings, profit and days to sell (worked example)', () => {
    const d = data({
      items: [item('a', { cost: 22, listedDate: '2026-10-05' })],
      orders: [order('o1', 'a', '2026-10-19', 63.4, { postage: 12.5, buyerProtection: 6.1, orderTotal: 82 }, 5.4)],
    });
    const [s] = soldItems(d);
    expect(s.earnings).toBe(59.98); // ad fee at 5.4% = 3.42
    expect(s.profit).toBe(37.98);
    expect(s.daysToSell).toBe(14);
  });

  it('is empty for empty data', () => {
    expect(soldItems(data())).toEqual([]);
  });

  it('excludes items with no order, and returned or faulty items', () => {
    const d = data({
      items: [item('a'), item('b'), item('c', { status: 'returned' }), item('d', { status: 'faulty' })],
      orders: [order('o2', 'b', '2026-10-10', 30), order('o3', 'c', '2026-10-10', 30), order('o4', 'd', '2026-10-10', 30)],
    });
    expect(soldItems(d).map((s) => s.item.id)).toEqual(['b']);
  });

  it('excludes relisted returns but includes a later sale of the same item', () => {
    const d = data({
      items: [item('a', { status: 'sold' }), item('b', { status: 'listed' })],
      orders: [order('o1', 'a', '2026-09-01', 30), order('o2', 'a', '2026-10-20', 35), order('o3', 'b', '2026-09-05', 30)],
      returns: [ret('r1', 'a', { orderId: 'o1', outcome: 'relisted' }), ret('r2', 'b', { orderId: 'o3', outcome: 'relisted' })],
    });
    const s = soldItems(d);
    expect(s.map((x) => x.item.id)).toEqual(['a']);
    expect(s[0].order.id).toBe('o2');
  });

  it('null cost counts as 0 and null listed date gives null days', () => {
    const d = data({ items: [item('a', { cost: null, listedDate: null })], orders: [order('o1', 'a', '2026-10-10', 40)] });
    const [s] = soldItems(d);
    expect(s.profit).toBe(s.earnings);
    expect(s.daysToSell).toBeNull();
  });

  it('same-day sale is 0 days', () => {
    const d = data({ items: [item('a', { listedDate: '2026-10-10' })], orders: [order('o1', 'a', '2026-10-10', 40)] });
    expect(soldItems(d)[0].daysToSell).toBe(0);
  });
});

describe('kpisForMonth / profitByMonth', () => {
  const d = data({
    items: [item('a', { cost: 10, listedDate: '2026-10-25' }), item('b', { cost: 5, listedDate: '2026-11-01' }), item('c', { cost: 0, listedDate: null })],
    orders: [order('o1', 'a', '2026-11-02', 50), order('o2', 'b', '2026-11-12', 30), order('o3', 'c', '2026-10-30', 20)],
  });
  it('totals one month', () => {
    const k = kpisForMonth(d, '2026-11');
    expect(k.itemsSold).toBe(2);
    expect(k.avgDaysToSell).toBe((8 + 11) / 2);
    expect(k.profit).toBe(sumMoney(soldItems(d).filter((s) => s.order.soldDate.startsWith('2026-11')).map((s) => s.profit)));
    expect(k.buyerPaid).toBeGreaterThan(k.earnings);
  });
  it('a month with no sales is all zeros and null average', () => {
    expect(kpisForMonth(d, '2026-05')).toEqual({ month: '2026-05', itemsSold: 0, profit: 0, earnings: 0, buyerPaid: 0, avgDaysToSell: null });
  });
  it('days average ignores items without a listed date', () => {
    expect(kpisForMonth(d, '2026-10').avgDaysToSell).toBeNull();
  });
  it('profitByMonth follows the requested months', () => {
    const p = profitByMonth(d, ['2026-09', '2026-10', '2026-11']);
    expect(p.map((x) => x.label)).toEqual(['Sep', 'Oct', 'Nov']);
    expect(p.map((x) => x.itemsSold)).toEqual([0, 1, 2]);
    expect(p[0].profit).toBe(0);
    expect(p[2].profit).toBe(kpisForMonth(d, '2026-11').profit);
  });
});

describe('byItemType / bySize / typeByMonth', () => {
  const d = data({
    items: [
      item('a', { itemType: 'Dress', size: '10' }), item('b', { itemType: 'Dress', size: '10' }),
      item('c', { itemType: 'Top', size: '12' }), item('k', { itemType: 'Dress', department: 'Kids', size: '6' }),
      item('m', { itemType: 'Shoes', department: 'Men', size: 'US 10' }),
    ],
    orders: [
      order('o1', 'a', '2026-10-10', 40), order('o2', 'b', '2026-11-10', 60), order('o3', 'c', '2026-11-11', 30),
      order('o4', 'k', '2026-11-11', 20), order('o5', 'm', '2026-10-11', 90),
    ],
  });
  it('byItemType ranks by number sold', () => {
    const r = byItemType(d);
    expect(r[0]).toMatchObject({ itemType: 'Dress', sold: 3 });
    expect(r.map((x) => x.itemType)).toEqual(['Dress', 'Shoes', 'Top']);
  });
  it('byItemType can filter by department', () => {
    expect(byItemType(d, 'Women').map((x) => x.itemType)).toEqual(['Dress', 'Top']);
    expect(byItemType(d, 'Kids')).toHaveLength(1);
  });
  it('byItemType is empty with no sales', () => {
    expect(byItemType(data())).toEqual([]);
  });
  it('bySize counts within a department', () => {
    expect(bySize(d, 'Women')).toEqual([{ size: '10', sold: 2 }, { size: '12', sold: 1 }]);
    expect(bySize(d, 'Men')).toEqual([{ size: 'US 10', sold: 1 }]);
  });
  it('bySize groups blank sizes as Unknown', () => {
    const e = data({ items: [item('a', { size: '' })], orders: [order('o', 'a', '2026-10-10', 10)] });
    expect(bySize(e, 'Women')).toEqual([{ size: 'Unknown', sold: 1 }]);
  });
  it('typeByMonth builds a heat-map grid', () => {
    const g = typeByMonth(d, ['2026-10', '2026-11']);
    expect(g.rows[0]).toEqual({ itemType: 'Dress', counts: [1, 2], total: 3 });
    expect(g.max).toBe(2);
  });
  it('typeByMonth ignores sales outside the months and has max >= 1 when empty', () => {
    const g = typeByMonth(d, ['2025-01']);
    expect(g.rows).toEqual([]);
    expect(g.max).toBe(1);
  });
});

describe('discounts', () => {
  const d = data({
    items: [
      item('a', { firstListPrice: 100, itemType: 'Dress', adRate: 3 }),
      item('b', { firstListPrice: 50, itemType: 'Dress', adRate: 5 }),
      item('c', { firstListPrice: 40, itemType: 'Top', adRate: 3 }),
      item('x', { firstListPrice: null }),
      item('z', { firstListPrice: 0 }),
    ],
    orders: [
      order('o1', 'a', '2026-10-10', 80), order('o2', 'b', '2026-10-10', 50), order('o3', 'c', '2026-10-10', 30),
      order('o4', 'x', '2026-10-10', 30), order('o5', 'z', '2026-10-10', 30),
    ],
  });
  it('dropPct', () => {
    expect(dropPct(100, 80)).toBe(20);
    expect(dropPct(50, 55)).toBeCloseTo(-10, 10);
  });
  it('suggestedFirstPrice = T / (1 - drop)', () => {
    expect(suggestedFirstPrice(90, 10)).toBe(100);
    expect(suggestedFirstPrice(90, 0)).toBe(90);
    expect(suggestedFirstPrice(90, 100)).toBeNull();
  });
  it('averages drop over items with a first price and ignores the rest', () => {
    const r = discounts(d);
    expect(r.count).toBe(3);
    expect(r.avgDropPct).toBeCloseTo((20 + 0 + 25) / 3, 10);
    expect(r.soldAtFirstPricePct).toBeCloseTo(100 / 3, 10);
    expect(r.avgAdRate).toBeCloseTo((3 + 5 + 3) / 3, 10);
  });
  it('byType is ordered by biggest drop', () => {
    const r = discounts(d).byType;
    expect(r.map((t) => t.itemType)).toEqual(['Top', 'Dress']);
    expect(r[1]).toMatchObject({ sold: 2, avgFirstPrice: 75, avgSalePrice: 65 });
    expect(r[1].avgDropPct).toBeCloseTo(10, 10);
  });
  it('suggestFirstPrice for a target uses the average drop', () => {
    const r = discounts(d);
    expect(r.suggestFirstPrice(90)).toBeCloseTo(90 / (1 - 15 / 100), 10);
  });
  it('is safe with no data', () => {
    const r = discounts(data());
    expect(r).toMatchObject({ count: 0, avgDropPct: 0, soldAtFirstPricePct: 0, avgAdRate: 0, byType: [] });
    expect(r.suggestFirstPrice(90)).toBeNull();
  });
});

describe('byAdRate', () => {
  it('groups by ad rate with 5%+ together, lowest first', () => {
    const d = data({
      items: [
        item('a', { adRate: 3, listedDate: '2026-10-01' }), item('b', { adRate: 3, listedDate: '2026-10-05' }),
        item('c', { adRate: 5.4, listedDate: '2026-10-01' }), item('e', { adRate: 7, listedDate: '2026-10-01' }),
        item('f', { adRate: null, listedDate: '2026-10-01' }),
      ],
      orders: [
        order('o1', 'a', '2026-10-11', 100, {}, 3), order('o2', 'b', '2026-10-11', 100, {}, 3),
        order('o3', 'c', '2026-10-11', 100, {}, 5.4), order('o4', 'e', '2026-10-21', 100, {}, 7), order('o5', 'f', '2026-10-11', 100, {}, 3),
      ],
    });
    const r = byAdRate(d);
    expect(r.map((x) => x.label)).toEqual(['3%', '5%+']);
    expect(r[0]).toMatchObject({ sold: 3, avgAdFee: 3 });
    expect(r[0].avgDaysToSell).toBeCloseTo((10 + 6 + 10) / 3, 10);
    expect(r[1].sold).toBe(2);
  });
  it('is empty with no sales', () => {
    expect(byAdRate(data())).toEqual([]);
  });
});

describe('shopStats', () => {
  const shops: Shop[] = [
    { id: 's1', name: 'Vinnies', kind: 'shop', archived: false },
    { id: 's2', name: 'Salvos', kind: 'shop', archived: false },
    { id: 'w', name: 'My wardrobe', kind: 'wardrobe', archived: false },
  ];
  const d = data({
    shops,
    items: [
      item('a', { shopId: 's1', cost: 10, listedDate: '2026-10-01', status: 'posted' }),
      item('b', { shopId: 's1', cost: 20, status: 'listed' }),
      item('c', { shopId: 's1', cost: 5, status: 'draft' }),
      item('e', { shopId: 's1', cost: 5, status: 'faulty' }),
      item('w', { shopId: 'w', cost: 0, listedDate: '2026-10-01' }),
      item('n', { shopId: null, cost: 7 }),
    ],
    orders: [order('o1', 'a', '2026-10-11', 50), order('o2', 'w', '2026-10-11', 50)],
  });
  it('excludes wardrobe shops and computes the stats', () => {
    const r = shopStats(d);
    expect(r.map((x) => x.name)).toEqual(['Vinnies', 'Salvos']);
    const v = r[0];
    expect(v.bought).toBe(4);
    expect(v.sold).toBe(1);
    expect(v.sellThroughPct).toBe(25);
    expect(v.totalCost).toBe(40);
    expect(v.profit).toBe(soldItems(d).find((s) => s.item.id === 'a')?.profit);
    expect(v.profitPerDollar).toBeCloseTo(v.profit / 40, 10);
    expect(v.avgDays).toBe(10);
    expect(v.leftCount).toBe(2);
    expect(v.leftCost).toBe(25);
  });
  it('a shop with nothing bought is zeros, not NaN', () => {
    expect(shopStats(d)[1]).toMatchObject({ bought: 0, sold: 0, sellThroughPct: 0, profit: 0, profitPerDollar: 0, avgDays: null, leftCount: 0, leftCost: 0 });
  });
  it('profitPerDollar is 0 when items were free', () => {
    const e = data({ shops, items: [item('a', { shopId: 's1', cost: 0 })], orders: [order('o', 'a', '2026-10-11', 50)] });
    expect(shopStats(e)[0].profitPerDollar).toBe(0);
  });
  it('is empty with no shops', () => {
    expect(shopStats(data())).toEqual([]);
  });
});

describe('tripStats', () => {
  const d = data({
    trips: [
      trip('t1', { total: 40, lines: [line('l1', { itemId: 'a', outcome: 'listed' }), line('l2', { itemId: 'b', outcome: 'listed' }), line('l3', { outcome: 'family' })] }),
      trip('t2', { total: 15 }),
    ],
    items: [item('a', { tripId: 't1', status: 'sold' }), item('b', { tripId: 't1' }), item('c', { tripId: 't1', status: 'draft' })],
    orders: [order('o1', 'a', '2026-10-10', 60)],
  });
  it('computes spent, items, sold, earned, left and net', () => {
    const s = tripStats(d, 't1');
    const earned = soldItems(d)[0].earnings;
    expect(s).toEqual({ tripId: 't1', spent: 40, itemsTotal: 3, itemsSold: 1, earned, left: 2, net: Math.round((earned - 40) * 100) / 100 });
  });
  it('a trip with no items has net = -spent', () => {
    expect(tripStats(d, 't2')).toMatchObject({ spent: 15, itemsTotal: 0, itemsSold: 0, earned: 0, left: 0, net: -15 });
  });
  it('unknown trip is null', () => {
    expect(tripStats(d, 'nope')).toBeNull();
  });
  it('a returned item does not count as sold', () => {
    const e = data({
      trips: [trip('t1', { total: 10, lines: [line('l1', { itemId: 'a' })] })],
      items: [item('a', { status: 'returned' })],
      orders: [order('o1', 'a', '2026-10-10', 60)],
    });
    expect(tripStats(e, 't1')).toMatchObject({ itemsSold: 0, itemsTotal: 1, left: 0, net: -10 });
  });
});

describe('priceBands', () => {
  const sale = (id: string, price: number, listed: string, sold: string) => [item(id, { listedDate: listed, cost: 5 }), order(`o${id}`, id, sold, price)] as const;
  it('always returns four bands, with boundaries going up', () => {
    const rows = [sale('a', 29.99, '2026-10-01', '2026-10-08'), sale('b', 30, '2026-10-01', '2026-10-08'), sale('c', 80, '2026-10-01', '2026-10-15'), sale('e', 150, '2026-10-01', '2026-10-22'), sale('f', 79.99, '2026-10-01', '2026-10-08')];
    const d = data({ items: rows.map((r) => r[0]), orders: rows.map((r) => r[1]) });
    const b = priceBands(d);
    expect(b.map((x) => x.label)).toEqual(['Under $30', '$30–80', '$80–150', 'Over $150']);
    expect(b.map((x) => x.sold)).toEqual([1, 2, 1, 1]);
  });
  it('profit per week = avg profit / (avg days / 7)', () => {
    const [i, o] = sale('a', 40, '2026-10-01', '2026-10-15');
    const d = data({ items: [i], orders: [o] });
    const b = priceBands(d)[1];
    expect(b.avgDays).toBe(14);
    expect(b.profitPerWeekListed).toBeCloseTo(b.avgProfit / 2, 10);
  });
  it('same-day sale floors days at 1 so it does not divide by zero', () => {
    const [i, o] = sale('a', 40, '2026-10-01', '2026-10-01');
    const b = priceBands(data({ items: [i], orders: [o] }))[1];
    expect(Number.isFinite(b.profitPerWeekListed)).toBe(true);
    expect(b.profitPerWeekListed).toBeCloseTo(b.avgProfit * 7, 10);
  });
  it('empty bands are zeros/null', () => {
    expect(priceBands(data())[0]).toMatchObject({ sold: 0, avgProfit: 0, avgDays: null, profitPerWeekListed: 0 });
  });
});

describe('brandStats', () => {
  it('ranks by average profit and groups blank brands', () => {
    const d = data({
      items: [item('a', { brand: 'Zara', cost: 5 }), item('b', { brand: 'Zara', cost: 5 }), item('c', { brand: 'Aje', cost: 5 }), item('e', { brand: ' ', cost: 5 })],
      orders: [order('o1', 'a', '2026-10-10', 30), order('o2', 'b', '2026-10-10', 40), order('o3', 'c', '2026-10-10', 200), order('o4', 'e', '2026-10-10', 10)],
    });
    const r = brandStats(d);
    expect(r.map((x) => x.brand)).toEqual(['Aje', 'Zara', 'Unbranded']);
    expect(r[1].sold).toBe(2);
    expect(r[1].avgBuyerPaid).toBeCloseTo((soldItems(d)[0].orderItem.allocTotal + soldItems(d)[1].orderItem.allocTotal) / 2, 10);
  });
  it('is empty with no sales', () => {
    expect(brandStats(data())).toEqual([]);
  });
});

describe('ageing', () => {
  const d = data({
    items: [
      item('a', { listedDate: '2026-11-10', cost: 10 }), // 4 days
      item('b', { listedDate: '2026-10-15', cost: 5 }), // 30 days -> bucket 1 (inclusive)
      item('c', { listedDate: '2026-10-14', cost: 7 }), // 31 days
      item('e', { listedDate: '2026-05-01', cost: 20 }), // 197 days
      item('f', { listedDate: '2026-08-01', cost: 3 }), // 105 days
      item('g', { status: 'draft', listedDate: null, purchaseDate: '2026-11-01', cost: 4 }), // 13 days from purchase
      item('h', { status: 'draft', listedDate: null, purchaseDate: null, cost: null }), // no date -> first bucket
      item('s', { status: 'sold', cost: 99 }), // not unsold
    ],
  });
  it('buckets unsold stock by age with counts and cost', () => {
    const r = ageing(d, T);
    expect(r.map((b) => b.label)).toEqual(['0–30 days', '31–90 days', '91–180 days', '180+ days']);
    expect(r.map((b) => b.count)).toEqual([4, 1, 1, 1]);
    expect(r.map((b) => b.cost)).toEqual([19, 7, 3, 20]);
  });
  it('is zeros for empty data', () => {
    expect(ageing(data(), T).every((b) => b.count === 0 && b.cost === 0)).toBe(true);
  });
});

describe('businessTotals', () => {
  const d = data({
    trips: [
      trip('t1', { total: 40, lines: [line('l1', { price: 6, outcome: 'family' }), line('l2', { price: 8, outcome: 'keeping' }), line('l3', { price: 10, outcome: 'listed' })] }),
      trip('t2', { total: 10 }),
    ],
    items: [
      item('a', { tripId: 't1', cost: 10, status: 'sold' }),
      item('b', { tripId: 't1', cost: 10, status: 'listed' }),
      item('c', { cost: 25, status: 'listed' }), // not from a trip
      item('e', { cost: 0, status: 'draft' }), // own wardrobe
      item('f', { cost: null, status: 'draft' }),
      item('g', { cost: 5, status: 'faulty' }),
    ],
    orders: [order('o1', 'a', '2026-10-10', 60)],
    expenses: [expense('x1', '2026-10-01', 12.5), expense('x2', '2026-10-02', 7.45)],
  });
  it('adds up money in and out', () => {
    const t = businessTotals(d);
    const earned = soldItems(d)[0].earnings;
    expect(t.earned).toBe(earned);
    expect(t.stockBought).toBe(40 + 10 + 25 + 5); // trips + non-trip item costs (null and 0 add nothing)
    expect(t.boughtForFamilyOrSelf).toBe(14);
    expect(t.supplies).toBe(19.95);
    expect(t.net).toBe(Math.round((earned - 80 - 19.95) * 100) / 100);
    expect(t.unsoldAtCost).toBe(10 + 25); // listed b, c; drafts cost 0/null
  });
  it('returns zeros for empty data', () => {
    expect(businessTotals(data())).toEqual({ earned: 0, stockBought: 0, boughtForFamilyOrSelf: 0, supplies: 0, net: 0, unsoldAtCost: 0 });
  });
  it('net can go negative', () => {
    expect(businessTotals(data({ trips: [trip('t', { total: 30 })] })).net).toBe(-30);
  });
});

describe('seasonTip', () => {
  const sold = (id: string, type: string, date: string) => ({ i: item(id, { itemType: type }), o: order(`o${id}`, id, date, 40) });
  const mk = (rows: ReturnType<typeof sold>[], extra = {}) => data({ items: rows.map((r) => r.i), orders: rows.map((r) => r.o), ...extra });

  it('is null with no sales', () => {
    expect(seasonTip(data(), T)).toBeNull();
  });
  it("falls back to the current season's sales so far", () => {
    const d = mk([sold('a', 'Dress', '2026-10-01'), sold('b', 'Dress', '2026-10-20'), sold('c', 'Top', '2026-11-01'), sold('d', 'Coat', '2026-07-01')]);
    expect(seasonTip(d, T)).toMatchObject({ season: 'Spring', months: 'Sep–Nov', basis: 'this_season', itemType: 'Dress', count: 2, totalSales: 3 });
  });
  it('uses the coming season from last year when within 31 days of its start', () => {
    const d = mk([sold('a', 'Dress', '2025-12-10'), sold('b', 'Dress', '2026-01-10'), sold('c', 'Top', '2025-12-20'), sold('e', 'Coat', '2026-10-01')]);
    const tip = seasonTip(d, T); // 17 days to 1 Dec
    expect(tip).toMatchObject({ season: 'Summer', months: 'Dec–Feb', basis: 'coming_season', itemType: 'Dress', count: 2, totalSales: 3 });
  });
  it('does not use the coming season when it is more than 31 days away', () => {
    const d = mk([sold('a', 'Dress', '2025-12-10'), sold('b', 'Coat', '2026-10-01')]);
    expect(seasonTip(d, '2026-10-20')).toMatchObject({ basis: 'this_season', itemType: 'Coat' });
  });
  it('exactly 31 days before the season counts as within range', () => {
    const d = mk([sold('a', 'Dress', '2025-12-10')]);
    expect(seasonTip(d, '2026-10-31')?.basis).toBe('coming_season');
    expect(seasonTip(d, '2026-10-30')).toBeNull(); // 32 days, and no spring sales so far
  });
  it('falls back when last year has no sales for the coming season', () => {
    const d = mk([sold('a', 'Coat', '2026-10-01'), sold('b', 'Dress', '2025-06-01')]);
    expect(seasonTip(d, T)).toMatchObject({ basis: 'this_season', itemType: 'Coat' });
  });
  it('ignores sales in the coming season of the same year (not previous years)', () => {
    const d = mk([sold('a', 'Dress', '2026-12-01')]);
    expect(seasonTip(d, '2026-12-05')).toMatchObject({ season: 'Summer', basis: 'this_season' });
  });
  it('treats Jan/Feb sales as part of the summer that began in December', () => {
    const d = mk([sold('a', 'Top', '2026-01-20'), sold('b', 'Top', '2026-12-02')]);
    // today 2027-01-15 -> current summer instance is Dec 2026..Feb 2027; Jan 2026 belongs to the previous summer
    expect(seasonTip(d, '2027-01-15')).toMatchObject({ season: 'Summer', basis: 'this_season', count: 1, totalSales: 1 });
  });
  it('reports drafts waiting of the winning type', () => {
    const d = mk([sold('a', 'Dress', '2026-10-01')], {});
    d.items.push(item('w1', { itemType: 'Dress', status: 'draft' }), item('w2', { itemType: 'Dress', status: 'listed' }), item('w3', { itemType: 'Top', status: 'draft' }));
    expect(seasonTip(d, T)?.waitingDrafts).toBe(1);
  });
  it('breaks ties alphabetically', () => {
    const d = mk([sold('a', 'Top', '2026-10-01'), sold('b', 'Dress', '2026-10-02')]);
    expect(seasonTip(d, T)?.itemType).toBe('Dress');
  });
  it('ignores returned items', () => {
    const r = sold('a', 'Dress', '2026-10-01');
    r.i.status = 'returned';
    expect(seasonTip(mk([r]), T)).toBeNull();
  });
});

describe('taxYear', () => {
  const d = data({
    trips: [trip('t1', { tripDate: '2026-08-01', total: 50 }), trip('t0', { tripDate: '2026-06-30', total: 20 })],
    items: [
      item('a', { cost: 10 }), item('b', { cost: 4 }), item('c', { cost: 30, purchaseDate: '2026-09-01' }),
      item('e', { cost: 8, purchaseDate: null, listedDate: '2026-02-01' }), item('r', { cost: 6, status: 'returned' }),
    ],
    orders: [order('o1', 'a', '2026-06-30', 50), order('o2', 'b', '2026-07-01', 40), order('o3', 'r', '2026-08-01', 30)],
    returns: [ret('r1', 'r', { orderId: 'o3', returnDate: '2026-08-10', refundAmount: 44.2 }), ret('r2', 'x', { returnDate: '2026-06-01', refundAmount: 15 })],
    expenses: [expense('e1', '2026-06-30', 5), expense('e2', '2026-07-01', 9.5), expense('e3', '2027-06-30', 0.5), expense('e4', '2027-07-01', 100)],
  });
  it('FY label and range', () => {
    expect(taxYear(d, 2026)).toMatchObject({ fy: 2026, label: 'FY 2026–27', start: '2026-07-01', end: '2027-06-30' });
  });
  it('puts 30 Jun and 1 Jul in different years', () => {
    const [a, b] = soldItems(d);
    expect(taxYear(d, 2025)).toMatchObject({ itemsSold: 1, income: a.earnings, costOfSold: 10, expenses: 5 });
    expect(taxYear(d, 2026)).toMatchObject({ itemsSold: 1, income: b.earnings, costOfSold: 4, expenses: 10 });
  });
  it('net = income - cost of sold - expenses', () => {
    const t = taxYear(d, 2026);
    expect(t.net).toBe(Math.round((t.income - 4 - 10) * 100) / 100);
  });
  it('includes refunds from returns dated in the FY', () => {
    expect(taxYear(d, 2026).refunds).toBe(44.2);
    expect(taxYear(d, 2025).refunds).toBe(15);
    expect(taxYear(d, 2027).refunds).toBe(0);
  });
  it('stockBought = trips in the FY + non-trip items by purchase (else listed) date', () => {
    expect(taxYear(d, 2026).stockBought).toBe(50 + 30 + 10 + 4 + 6); // t1 + c + a, b, r (no trip, listed 2026-10-01 default)
    expect(taxYear(d, 2025).stockBought).toBe(20 + 8);
  });
  it('an empty year is all zeros', () => {
    expect(taxYear(d, 2019)).toMatchObject({ itemsSold: 0, income: 0, refunds: 0, costOfSold: 0, expenses: 0, net: 0, stockBought: 0 });
    expect(taxYear(data(), 2026).net).toBe(0);
  });
});

describe('whatIf', () => {
  const item1 = { cost: 22, adRate: 5 };
  const scenarios = [
    { label: 'Buyer pays postage', listPrice: 60, postageCharged: 12.5 },
    { label: 'Free postage', listPrice: 70, postageCharged: 0 },
    { label: 'Flat $10', listPrice: 65, postageCharged: 10 },
  ];
  it('computes buyerPays, protection, ad, earnings, keep', () => {
    const [a] = whatIf(item1, scenarios, settings);
    expect(a.protection).toBeCloseTo(4.3, 10);
    expect(a.buyerPays).toBeCloseTo(60 + 12.5 + a.protection, 10);
    expect(a.adFee).toBeCloseTo(3, 10);
    expect(a.earnings).toBeCloseTo(60 + 12.5 - 12.5 - 3, 10); // label 12.50 either way
    expect(a.keep).toBeCloseTo(57 - 22, 10);
  });
  it('free postage means the label comes out of your pocket', () => {
    const b = whatIf(item1, scenarios, settings)[1];
    expect(b.earnings).toBeCloseTo(70 - 12.5 - 3.5, 10);
    expect(b.buyerPays).toBeCloseTo(70 + 4.9, 10);
  });
  it('flags exactly one best scenario (highest keep)', () => {
    const r = whatIf(item1, scenarios, settings);
    expect(r.filter((x) => x.best)).toHaveLength(1);
    const top = Math.max(...r.map((x) => x.keep));
    expect(r.find((x) => x.best)?.keep).toBe(top);
  });
  it('uses the default ad rate and cost 0 when unknown', () => {
    const [a] = whatIf({ cost: null, adRate: null }, [{ label: 'x', listPrice: 100, postageCharged: 0 }], settings);
    expect(a.adFee).toBeCloseTo(3, 10);
    expect(a.keep).toBeCloseTo(a.earnings, 10);
  });
  it('honours adFeeBase item_plus_postage', () => {
    const [a] = whatIf({ cost: 0, adRate: 10 }, [{ label: 'x', listPrice: 50, postageCharged: 10 }], { ...settings, adFeeBase: 'item_plus_postage' });
    expect(a.adFee).toBeCloseTo(6, 10);
  });
  it('no scenarios gives an empty list', () => {
    expect(whatIf(item1, [], settings)).toEqual([]);
  });
});
