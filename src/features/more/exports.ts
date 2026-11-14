// Pure builders for the CSV files: export everything (items, sales, expenses, trips) and the tax-year detail.
import { financialYearOf, fyLabel } from '@/domain/dates';
import { soldItems } from '@/domain/analytics';
import { ebayEarnings, itemProfit, round2 } from '@/domain/money';
import { storageFor } from '@/domain/sku';
import type { BusinessData, Item, Shop } from '@/domain/types';
import { csvMoney, toCsv, type CsvCell } from './csv';

function shopName(shops: readonly Shop[], id: string | null): string {
  return (id && shops.find((s) => s.id === id)?.name) || '';
}

const byDate = <T>(get: (x: T) => string) => (a: T, b: T) => (get(a) < get(b) ? -1 : get(a) > get(b) ? 1 : 0);

export function itemsCsv(data: BusinessData): string {
  const header = [
    'SKU', 'Title', 'Brand', 'Department', 'Item type', 'Size', 'Status', 'Shop', 'Purchase date', 'Cost',
    'Date listed', 'First listing price', 'Ad rate (%)', 'Online order no', 'Storage location',
  ];
  const rows: CsvCell[][] = [...data.items]
    .sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0))
    .map((i) => [
      i.sku, i.title, i.brand, i.department, i.itemType, i.size, i.status, shopName(data.shops, i.shopId),
      i.purchaseDate, csvMoney(i.cost), i.listedDate, csvMoney(i.firstListPrice), i.adRate, i.onlineOrderNo,
      storageFor(i.sku, data.storage),
    ]);
  return toCsv([header, ...rows]);
}

/** One row per order line (a combined order gives one row per item). */
export function salesCsv(data: BusinessData): string {
  const header = [
    'Sold date', 'Order no', 'SKU', 'Title', 'Item status', 'Sale price', 'Postage', 'Buyer protection', 'Ad fee',
    "Buyer's share of order total", 'eBay earnings', 'Cost', 'Profit', 'Posted date', 'Tracking no', 'Refund',
  ];
  const itemById = new Map<string, Item>(data.items.map((i) => [i.id, i]));
  const rows: CsvCell[][] = [];
  for (const o of [...data.orders].sort(byDate((x) => x.soldDate))) {
    for (const oi of o.items) {
      const it = itemById.get(oi.itemId);
      const refund = data.returns.filter((r) => r.itemId === oi.itemId && (r.orderId == null || r.orderId === o.id)).reduce((a, r) => a + r.refundAmount, 0);
      rows.push([
        o.soldDate, o.orderNo, it?.sku ?? '', it?.title ?? '', it?.status ?? '', csvMoney(oi.salePrice),
        csvMoney(oi.allocPostage), csvMoney(oi.allocProtection), csvMoney(oi.adFee), csvMoney(oi.allocTotal),
        csvMoney(ebayEarnings(oi)), csvMoney(it?.cost ?? null), it ? csvMoney(itemProfit(it, oi)) : '', o.postedDate,
        o.trackingNo, refund ? csvMoney(round2(refund)) : '',
      ]);
    }
  }
  return toCsv([header, ...rows]);
}

export function expensesCsv(data: BusinessData): string {
  const header = ['Date', 'What', 'Category', 'Amount', 'Receipt photo'];
  const rows: CsvCell[][] = [...data.expenses]
    .sort(byDate((e) => e.expenseDate))
    .map((e) => [e.expenseDate, e.description, e.category, csvMoney(e.amount), e.receiptPath ? 'Yes' : 'No']);
  return toCsv([header, ...rows]);
}

export function tripsCsv(data: BusinessData): string {
  const header = ['Trip date', 'Shop', 'Total', 'Pieces', 'Listed', 'For family', 'Keeping', 'Faulty', 'To list', 'Notes'];
  const rows: CsvCell[][] = [...data.trips].sort(byDate((t) => t.tripDate)).map((t) => {
    const count = (o: string) => t.lines.filter((l) => l.outcome === o).reduce((a, l) => a + l.qty, 0);
    return [
      t.tripDate, shopName(data.shops, t.shopId), csvMoney(t.total), t.lines.reduce((a, l) => a + l.qty, 0),
      count('listed'), count('family'), count('keeping'), count('faulty'), count('to_list'), t.notes,
    ];
  });
  return toCsv([header, ...rows]);
}

export interface ExportFile {
  name: string;
  csv: string;
}

/** The four files in "Export everything (CSV)". */
export function exportEverything(data: BusinessData): ExportFile[] {
  return [
    { name: 'items.csv', csv: itemsCsv(data) },
    { name: 'sales.csv', csv: salesCsv(data) },
    { name: 'expenses.csv', csv: expensesCsv(data) },
    { name: 'trips.csv', csv: tripsCsv(data) },
  ];
}

// ---------------------------------------------------------------------------
// Tax year
// ---------------------------------------------------------------------------

/**
 * Financial years (starting years) that have any data: sales, expenses, trips, returns or items bought.
 * Newest first. Always includes the year of `todayDate`.
 */
export function financialYearsWithData(data: BusinessData, todayDate: string): number[] {
  const set = new Set<number>([financialYearOf(todayDate)]);
  const add = (d: string | null | undefined) => {
    if (d) set.add(financialYearOf(d));
  };
  for (const s of soldItems(data)) add(s.order.soldDate);
  for (const e of data.expenses) add(e.expenseDate);
  for (const t of data.trips) add(t.tripDate);
  for (const r of data.returns) add(r.returnDate);
  for (const i of data.items) if (!i.tripId) add(i.purchaseDate ?? i.listedDate);
  return [...set].sort((a, b) => b - a);
}

export const TAX_CSV_HEADER = [
  'Date', 'Type', 'SKU', 'Description', 'Sale price', 'Buyer protection', 'Postage', 'Ad fee', 'eBay earnings',
  'Cost', 'Profit', 'Expense category', 'Amount',
] as const;

/** Detailed CSV for the accountant: one row per sale and per expense in the financial year, oldest first. */
export function taxDetailCsv(data: BusinessData, fy: number): string {
  type Row = { date: string; order: number; cells: CsvCell[] };
  const rows: Row[] = [];
  for (const s of soldItems(data)) {
    if (financialYearOf(s.order.soldDate) !== fy) continue;
    const oi = s.orderItem;
    rows.push({
      date: s.order.soldDate,
      order: 0,
      cells: [
        s.order.soldDate, 'Sale', s.item.sku, s.item.title, csvMoney(oi.salePrice), csvMoney(oi.allocProtection),
        csvMoney(oi.allocPostage), csvMoney(oi.adFee), csvMoney(s.earnings), csvMoney(s.item.cost ?? 0),
        csvMoney(s.profit), '', '',
      ],
    });
  }
  for (const e of data.expenses) {
    if (financialYearOf(e.expenseDate) !== fy) continue;
    rows.push({
      date: e.expenseDate,
      order: 1,
      cells: [e.expenseDate, 'Expense', '', e.description, '', '', '', '', '', '', '', e.category, csvMoney(e.amount)],
    });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));
  return toCsv([[...TAX_CSV_HEADER], ...rows.map((r) => r.cells)]);
}

/** File name for the accountant CSV, e.g. "resale-tax-FY-2026-27.csv". */
export function taxFileName(fy: number): string {
  return `resale-tax-${fyLabel(fy).replace(/\s+/g, '-').replace('–', '-')}.csv`;
}
