/// <reference types="jest" />
import { settings } from '@/domain/testUtils';
import type { SkuCode } from '@/domain/types';
import {
  buildBatch,
  chunk,
  newShopNames,
  runImport,
  skuNeeds,
  type ImportPlan,
  type PlannedRow,
  type SkuReservation,
} from '../importMap';

const codes: SkuCode[] = [
  { kind: 'department', label: 'Women', code: 'W', sort: 1 },
  { kind: 'department', label: 'Men', code: 'M', sort: 2 },
  { kind: 'item_type', label: 'Dress', code: 'DR', sort: 1 },
  { kind: 'item_type', label: 'Top', code: 'TO', sort: 2 },
];

function row(n: number, over: { dept?: 'Women' | 'Men'; type?: string; shop?: string | null; notes?: string[]; adRate?: number | null } = {}): PlannedRow {
  const plan: ImportPlan = {
    item: {
      title: `Thing ${n}`,
      brand: '',
      department: over.dept ?? 'Women',
      itemType: over.type ?? 'Dress',
      size: '',
      shopId: null,
      cost: 5,
      listedDate: '2026-03-01',
      firstListPrice: null,
      adRate: over.adRate === undefined ? 3 : over.adRate,
    },
    sale: { orderNo: `N${n}`, soldDate: '2026-03-14', orderTotal: 100, buyerProtection: 6, postage: 10, salePrice: 84 },
    newShopName: over.shop ?? null,
    notes: over.notes ?? [],
  };
  return { rowNumber: n + 1, plan };
}

describe('chunk', () => {
  it('splits 300 rows into 6 batches of 50', () => {
    const parts = chunk(Array.from({ length: 300 }, (_, i) => i));
    expect(parts.map((p) => p.length)).toEqual([50, 50, 50, 50, 50, 50]);
  });
  it('keeps the remainder and handles empty lists', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 50)).toEqual([]);
  });
  it('treats a size below 1 as 1', () => {
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe('newShopNames', () => {
  it('lists each new shop once, ignoring case and spaces', () => {
    const rows = [row(1, { shop: 'Salvos Bondi' }), row(2, { shop: 'salvos bondi ' }), row(3, { shop: 'Vinnies' }), row(4)];
    expect(newShopNames(rows)).toEqual(['Salvos Bondi', 'Vinnies']);
  });
});

describe('skuNeeds', () => {
  it('counts rows per SKU prefix', () => {
    const rows = [row(1), row(2), row(3, { type: 'Top' }), row(4, { dept: 'Men' })];
    expect([...skuNeeds(rows, codes)]).toEqual([['WDR', 2], ['WTO', 1], ['MDR', 1]]);
  });
});

describe('buildBatch', () => {
  const reserved = new Map<string, SkuReservation[]>([
    ['WDR', [{ sku: 'WDR-010', sku_number: 10 }, { sku: 'WDR-011', sku_number: 11 }]],
    ['WTO', [{ sku: 'WTO-001', sku_number: 1 }]],
  ]);

  it('hands out reserved SKUs per prefix in row order', () => {
    const built = buildBatch([row(1), row(2, { type: 'Top' }), row(3)], reserved, new Map(), settings, codes);
    expect(built.map((b) => b.item.sku)).toEqual(['WDR-010', 'WTO-001', 'WDR-011']);
    expect(built.map((b) => b.rowNumber)).toEqual([2, 3, 4]);
  });

  it('makes posted items and orders posted on the sold date, with one allocated line', () => {
    const [b] = buildBatch([row(1)], reserved, new Map(), settings, codes);
    expect(b.item.status).toBe('posted');
    expect(b.item.listedDate).toBe('2026-03-01');
    expect(b.order.postedDate).toBe('2026-03-14');
    expect(b.order.orderNo).toBe('N1');
    expect(b.order.items).toHaveLength(1);
    expect(b.order.items[0].itemId).toBe(b.item.id);
    expect(b.order.items[0].salePrice).toBe(84);
    expect(b.order.items[0].allocPostage).toBeCloseTo(10, 2);
    expect(b.order.items[0].allocProtection).toBeCloseTo(6, 2);
    expect(b.order.items[0].adFee).toBeCloseTo(84 * 0.03, 2);
  });

  it('uses the default ad rate when the row has none', () => {
    const [b] = buildBatch([row(1, { adRate: null })], reserved, new Map(), settings, codes);
    expect(b.order.items[0].adFee).toBeCloseTo((84 * settings.defaultAdRate) / 100, 2);
  });

  it('points new-shop rows at the shop that was created', () => {
    const [b] = buildBatch([row(1, { shop: 'Salvos Bondi' })], reserved, new Map([['salvos bondi', 'shop-9']]), settings, codes);
    expect(b.item.shopId).toBe('shop-9');
  });

  it('gives every item and order its own id', () => {
    const built = buildBatch([row(1), row(3)], reserved, new Map(), settings, codes);
    expect(new Set(built.flatMap((b) => [b.item.id, b.order.id])).size).toBe(4);
  });

  it('throws when too few SKUs were reserved', () => {
    expect(() => buildBatch([row(1), row(2), row(3)], reserved, new Map(), settings, codes)).toThrow('No SKU reserved');
  });
});

describe('runImport', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => row(i + 1));
  const noShops = async () => new Map<string, string>();

  it('writes 300 rows as 6 batches and reports progress after each', async () => {
    const sizes: number[] = [];
    const progress: number[] = [];
    const res = await runImport(many(300), {
      createShops: noShops,
      saveBatch: async (rows) => void sizes.push(rows.length),
      onProgress: (p) => progress.push(p.done),
    });
    expect(sizes).toEqual([50, 50, 50, 50, 50, 50]);
    expect(progress).toEqual([0, 50, 100, 150, 200, 250, 300]);
    expect(res).toMatchObject({ imported: 300, failed: [], stopped: false });
  });

  it('creates shops once, before any batch, and counts them', async () => {
    const order: string[] = [];
    const rows = [row(1, { shop: 'A' }), row(2, { shop: 'a' }), row(3, { shop: 'B' })];
    const res = await runImport(rows, {
      createShops: async (names) => {
        order.push(`shops:${names.join('+')}`);
        return new Map(names.map((n) => [n.toLowerCase(), n]));
      },
      saveBatch: async () => void order.push('batch'),
    });
    expect(order).toEqual(['shops:A+B', 'batch']);
    expect(res.newShops).toBe(2);
  });

  it('stops between batches when asked, and lists the unsaved rows', async () => {
    let stop = false;
    const res = await runImport(many(120), {
      createShops: noShops,
      saveBatch: async () => {
        stop = true;
      },
      shouldStop: () => stop,
    });
    expect(res.stopped).toBe(true);
    expect(res.imported).toBe(50);
    expect(res.failed).toHaveLength(70);
    expect(res.failed[0]).toEqual({ rowNumber: 52, reason: 'Stopped before this row' });
  });

  it('retries a failed batch row by row so only the bad row is lost', async () => {
    const res = await runImport(many(10), {
      createShops: noShops,
      saveBatch: async (rows) => {
        if (rows.some((r) => r.rowNumber === 5)) throw new Error('bad date');
      },
    });
    expect(res.imported).toBe(9);
    expect(res.failed).toEqual([{ rowNumber: 5, reason: 'Could not save: bad date' }]);
    expect(res.stopped).toBe(false);
  });

  it('stops after three rows in a row fail', async () => {
    const res = await runImport(many(10), {
      createShops: noShops,
      saveBatch: async () => {
        throw new Error('offline');
      },
    });
    expect(res.imported).toBe(0);
    expect(res.stopped).toBe(true);
    expect(res.failed).toHaveLength(10);
    expect(res.failed.filter((f) => f.reason === 'Stopped after repeated errors')).toHaveLength(7);
  });

  it('counts estimated rows', async () => {
    const rows = [row(1, { notes: ['Buyer protection estimated'] }), row(2)];
    const res = await runImport(rows, { createShops: noShops, saveBatch: async () => undefined });
    expect(res.estimated).toBe(1);
  });

  it('does nothing for no rows', async () => {
    const createShops = jest.fn(noShops);
    const res = await runImport([], { createShops, saveBatch: async () => undefined });
    expect(createShops).not.toHaveBeenCalled();
    expect(res).toMatchObject({ imported: 0, failed: [], newShops: 0 });
  });
});
