/// <reference types="jest" />
import { taxYear } from '@/domain/analytics';
import { sampleData } from '@/domain/fixtures';
import { data as makeData, expense, item, line, order, ret, trip } from '@/domain/testUtils';
import { parseCsv } from '../csv';
import {
  expensesCsv,
  exportEverything,
  financialYearsWithData,
  itemsCsv,
  salesCsv,
  taxDetailCsv,
  taxFileName,
  tripsCsv,
  TAX_CSV_HEADER,
} from '../exports';

const col = (rows: string[][], name: string) => {
  const i = rows[0].indexOf(name);
  if (i < 0) throw new Error(`no column ${name}`);
  return rows.slice(1).map((r) => r[i]);
};

function small() {
  const a = item('1', { sku: 'WD-001', title: 'Silk, midi dress', cost: 22, status: 'sold', shopId: 's1', itemType: 'Dress' });
  const b = item('2', { sku: 'MS-002', title: 'Linen "shirt"', cost: null, status: 'listed', department: 'Men', itemType: 'Shirt', skuPrefix: 'MS' });
  return makeData({
    shops: [{ id: 's1', name: 'Vinnies, Newtown', kind: 'shop', archived: false }],
    storage: [{ prefix: 'WD', location: 'Rack A' }, { prefix: 'M', location: 'Box 2' }],
    items: [b, a],
    orders: [order('o1', '1', '2026-08-10', 82, { orderNo: '12-34' })],
    expenses: [expense('e1', '2026-08-01', 24.5), expense('e2', '2026-05-30', 10)],
    trips: [
      trip('t1', {
        shopId: 's1',
        tripDate: '2026-07-04',
        total: 40,
        notes: 'Good day',
        lines: [
          line('l1', { qty: 2, outcome: 'listed' }),
          line('l2', { qty: 1, outcome: 'family' }),
          line('l3', { qty: 1, outcome: 'to_list' }),
        ],
      }),
    ],
  });
}

describe('itemsCsv', () => {
  it('has one row per item, sorted by SKU, with shop, storage and blank cost', () => {
    const rows = parseCsv(itemsCsv(small()));
    expect(col(rows, 'SKU')).toEqual(['MS-002', 'WD-001']);
    expect(col(rows, 'Title')).toEqual(['Linen "shirt"', 'Silk, midi dress']);
    expect(col(rows, 'Shop')).toEqual(['', 'Vinnies, Newtown']);
    expect(col(rows, 'Cost')).toEqual(['', '22.00']);
    expect(col(rows, 'Storage location')).toEqual(['Box 2', 'Rack A']);
  });

  it('is only a header for an empty business', () => {
    expect(parseCsv(itemsCsv(makeData()))).toHaveLength(1);
  });
});

describe('salesCsv', () => {
  it('has one row per order line with the fee columns and profit', () => {
    const rows = parseCsv(salesCsv(small()));
    expect(rows).toHaveLength(2);
    expect(col(rows, 'SKU')).toEqual(['WD-001']);
    expect(col(rows, 'Order no')).toEqual(['12-34']);
    expect(col(rows, 'Sale price')).toEqual(['82.00']);
    expect(col(rows, 'Postage')).toEqual(['12.50']);
    // protection 0.75 + 5% x 94.50 = 5.475 -> 5.48 ; ad fee 3% x 82 = 2.46
    expect(col(rows, 'Buyer protection')).toEqual(['5.48']);
    expect(col(rows, 'Ad fee')).toEqual(['2.46']);
    // earnings = 82 + 12.5 + 5.48 - 5.48 - 12.5 - 2.46 = 79.54 ; profit = 57.54
    expect(col(rows, 'eBay earnings')).toEqual(['79.54']);
    expect(col(rows, 'Profit')).toEqual(['57.54']);
  });

  it('includes the refund for a returned item and one row per item of a combined order', () => {
    const d = small();
    d.returns = [ret('r1', '1', { refundAmount: 94.5, outcome: 'thrown_out' })];
    d.items[1].status = 'returned';
    const rows = parseCsv(salesCsv(d));
    expect(col(rows, 'Refund')).toEqual(['94.50']);
  });
});

describe('expensesCsv and tripsCsv', () => {
  it('lists expenses oldest first', () => {
    const rows = parseCsv(expensesCsv(small()));
    expect(col(rows, 'Date')).toEqual(['2026-05-30', '2026-08-01']);
    expect(col(rows, 'Amount')).toEqual(['10.00', '24.50']);
    expect(col(rows, 'Receipt photo')).toEqual(['No', 'No']);
  });

  it('counts pieces by outcome', () => {
    const rows = parseCsv(tripsCsv(small()));
    expect(col(rows, 'Shop')).toEqual(['Vinnies, Newtown']);
    expect(col(rows, 'Pieces')).toEqual(['4']);
    expect(col(rows, 'Listed')).toEqual(['2']);
    expect(col(rows, 'For family')).toEqual(['1']);
    expect(col(rows, 'To list')).toEqual(['1']);
    expect(col(rows, 'Notes')).toEqual(['Good day']);
  });

  it('exportEverything gives the four named files', () => {
    expect(exportEverything(small()).map((f) => f.name)).toEqual(['items.csv', 'sales.csv', 'expenses.csv', 'trips.csv']);
  });
});

describe('financialYearsWithData', () => {
  it('lists years with data newest first and always the current year', () => {
    expect(financialYearsWithData(small(), '2026-11-14')).toEqual([2026, 2025]);
    expect(financialYearsWithData(makeData(), '2026-11-14')).toEqual([2026]);
  });

  it('counts returns, trips and non-trip item purchases', () => {
    const d = makeData({
      trips: [trip('t', { tripDate: '2023-09-01' })],
      returns: [ret('r', 'x', { returnDate: '2024-02-02' })],
      items: [item('9', { purchaseDate: '2021-01-01', status: 'draft' })],
    });
    expect(financialYearsWithData(d, '2026-11-14')).toEqual([2026, 2023, 2020]);
  });
});

describe('taxDetailCsv', () => {
  it('has the accountant columns in order', () => {
    expect(parseCsv(taxDetailCsv(makeData(), 2026))[0]).toEqual([...TAX_CSV_HEADER]);
    expect([...TAX_CSV_HEADER]).toEqual([
      'Date', 'Type', 'SKU', 'Description', 'Sale price', 'Buyer protection', 'Postage', 'Ad fee', 'eBay earnings',
      'Cost', 'Profit', 'Expense category', 'Amount',
    ]);
  });

  it('has one row per sale and per expense in the year, oldest first, and nothing from other years', () => {
    const rows = parseCsv(taxDetailCsv(small(), 2026));
    expect(col(rows, 'Type')).toEqual(['Expense', 'Sale']);
    expect(col(rows, 'Date')).toEqual(['2026-08-01', '2026-08-10']);
    expect(col(rows, 'Expense category')).toEqual(['Packaging', '']);
    expect(col(rows, 'Amount')).toEqual(['24.50', '']);
    expect(col(rows, 'SKU')).toEqual(['', 'WD-001']);
    expect(col(rows, 'Cost')).toEqual(['', '22.00']);
    expect(col(rows, 'Profit')).toEqual(['', '57.54']);
    // the 2026-05-30 expense belongs to FY 2025
    expect(parseCsv(taxDetailCsv(small(), 2025)).slice(1).map((r) => r[1])).toEqual(['Expense']);
  });

  it('puts a sale before an expense on the same day', () => {
    const d = small();
    d.expenses = [expense('e', '2026-08-10', 5)];
    expect(col(parseCsv(taxDetailCsv(d, 2026)), 'Type')).toEqual(['Sale', 'Expense']);
  });

  it('leaves out returned items, as the tax summary does', () => {
    const d = small();
    d.items[1].status = 'returned';
    expect(col(parseCsv(taxDetailCsv(d, 2026)), 'Type')).toEqual(['Expense']);
  });

  it('adds up to the tax-year summary for the sample business', () => {
    for (const fy of financialYearsWithData(sampleData, '2026-11-14')) {
      const t = taxYear(sampleData, fy);
      const rows = parseCsv(taxDetailCsv(sampleData, fy));
      const type = col(rows, 'Type');
      const sum = (name: string, kind: string) =>
        Math.round(col(rows, name).reduce((a, v, i) => a + (type[i] === kind && v ? Number(v) : 0), 0) * 100) / 100;
      expect(type.filter((x) => x === 'Sale')).toHaveLength(t.itemsSold);
      expect(sum('eBay earnings', 'Sale')).toBeCloseTo(t.income, 2);
      expect(sum('Cost', 'Sale')).toBeCloseTo(t.costOfSold, 2);
      expect(sum('Amount', 'Expense')).toBeCloseTo(t.expenses, 2);
      expect(sum('Profit', 'Sale') - sum('Amount', 'Expense')).toBeCloseTo(t.net, 2);
    }
  });

  it('names the file after the year', () => {
    expect(taxFileName(2026)).toBe('resale-tax-FY-2026-27.csv');
  });
});
