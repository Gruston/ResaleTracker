/// <reference types="jest" />
import { SAMPLE_TODAY, sampleData as d } from '../fixtures';
import { businessTotals, shopStats, soldItems, taxYear, tripStats } from '../analytics';
import { ebayEarnings, itemProfit, sumMoney } from '../money';
import { parseSku, storageFor } from '../sku';

describe('sampleData', () => {
  it('has the expected shape', () => {
    expect(d.items).toHaveLength(31);
    expect(d.trips).toHaveLength(4);
    expect(d.expenses).toHaveLength(5);
    expect(d.returns).toHaveLength(1);
    expect(d.shops.map((s) => s.name)).toContain('My wardrobe');
    expect(d.settings).toMatchObject({ protectionFixed: 0.3, defaultAdRate: 3, adFeeBase: 'item', defaultLabelCost: 12.5 });
    expect(SAMPLE_TODAY).toBe('2026-11-14');
  });

  it('has unique ids and SKUs, and SKUs match prefix/number', () => {
    for (const ids of [d.items.map((i) => i.id), d.items.map((i) => i.sku), d.orders.map((o) => o.id), d.trips.map((t) => t.id), d.shops.map((s) => s.id)]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
    for (const i of d.items) expect(parseSku(i.sku)).toEqual({ prefix: i.skuPrefix, number: i.skuNumber });
  });

  it('every item has a storage location', () => {
    for (const i of d.items) expect(storageFor(i.sku, d.storage)).not.toBe('Not set');
  });

  it('references are consistent', () => {
    const itemIds = new Set(d.items.map((i) => i.id));
    const shopIds = new Set(d.shops.map((s) => s.id));
    const tripIds = new Set(d.trips.map((t) => t.id));
    for (const i of d.items) {
      if (i.shopId) expect(shopIds.has(i.shopId)).toBe(true);
      if (i.tripId) expect(tripIds.has(i.tripId)).toBe(true);
    }
    for (const o of d.orders) for (const x of o.items) expect(itemIds.has(x.itemId)).toBe(true);
    for (const t of d.trips) {
      expect(shopIds.has(t.shopId as string)).toBe(true);
      for (const l of t.lines) if (l.itemId) expect(d.items.find((i) => i.id === l.itemId)?.tripLineId).toBe(l.id);
    }
  });

  it('trip totals equal the sum of their lines', () => {
    for (const t of d.trips) expect(sumMoney(t.lines.map((l) => l.price))).toBe(t.total);
  });

  it('own-wardrobe items have cost 0 and one item has unknown cost', () => {
    const w = d.shops.find((s) => s.kind === 'wardrobe')?.id;
    const own = d.items.filter((i) => i.shopId === w);
    expect(own).toHaveLength(3);
    expect(own.every((i) => i.cost === 0)).toBe(true);
    expect(d.items.filter((i) => i.cost == null)).toHaveLength(1);
  });

  it('has a qty-3 line', () => {
    expect(d.trips.flatMap((t) => t.lines).some((l) => l.qty === 3 && l.price === 15)).toBe(true);
  });

  it('every order adds up exactly', () => {
    for (const o of d.orders) {
      expect(sumMoney(o.items.map((x) => x.allocPostage))).toBe(o.postage);
      expect(sumMoney(o.items.map((x) => x.allocProtection))).toBe(o.buyerProtection);
      expect(sumMoney(o.items.map((x) => x.allocTotal))).toBe(o.orderTotal);
    }
  });

  it('contains the worked example: Linen midi dress earns 60 and profits 38', () => {
    const dress = d.items.find((i) => i.title === 'Linen midi dress')!;
    const oi = d.orders.flatMap((o) => o.items).find((x) => x.itemId === dress.id)!;
    expect(dress.cost).toBe(22);
    expect(oi).toMatchObject({ allocTotal: 82, allocProtection: 6.1, allocPostage: 12.5, adFee: 3.4 });
    expect(ebayEarnings(oi)).toBe(60);
    expect(itemProfit(dress, oi)).toBe(38);
  });

  it('has one combined order of the skirt and the romper', () => {
    const combined = d.orders.filter((o) => o.items.length > 1);
    expect(combined).toHaveLength(1);
    const titles = combined[0].items.map((x) => d.items.find((i) => i.id === x.itemId)?.title).sort();
    expect(titles).toEqual(['Baby romper', 'Satin midi skirt']);
  });

  it('has a pending return on a returned item, a faulty item and a to-post item', () => {
    const r = d.returns[0];
    expect(d.items.find((i) => i.id === r.itemId)?.status).toBe('returned');
    expect(r.outcome).toBe('pending');
    expect(d.items.filter((i) => i.status === 'faulty')).toHaveLength(1);
    expect(d.items.filter((i) => i.status === 'sold').length).toBeGreaterThan(0);
  });

  it('sold items exclude the returned and faulty ones', () => {
    const sold = soldItems(d);
    expect(sold).toHaveLength(19);
    expect(sold.every((s) => s.item.status !== 'returned' && s.item.status !== 'faulty')).toBe(true);
  });

  it('analytics run on it with plausible totals', () => {
    const t = businessTotals(d);
    expect(t.stockBought).toBe(658);
    expect(t.boughtForFamilyOrSelf).toBe(23);
    expect(t.supplies).toBe(68.9);
    expect(t.net).toBe(sumMoney([t.earned, -t.stockBought, -t.supplies]));
    expect(shopStats(d).map((s) => s.name)).not.toContain('My wardrobe');
    expect(tripStats(d, 'trip-4')).toMatchObject({ spent: 33, itemsSold: 1, earned: 60, net: 27 });
    expect(taxYear(d, 2026).itemsSold + taxYear(d, 2025).itemsSold).toBe(19);
  });
});
