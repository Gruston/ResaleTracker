/// <reference types="jest" />
import { settings } from '@/domain/testUtils';
import type { Shop, SkuCode } from '@/domain/types';
import {
  dedupeKey,
  groupReasons,
  guessMapping,
  inferItemType,
  matchItemType,
  missingRequired,
  normalizeDepartment,
  normalizeHeader,
  parseDate,
  parseMoney,
  planRow,
  planRows,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type ColumnMapping,
  type ImportContext,
} from '../importMap';
import { parseCsvTable, toCsv } from '../csv';

const codes: SkuCode[] = [
  { kind: 'department', label: 'Women', code: 'W', sort: 1 },
  { kind: 'item_type', label: 'Dress', code: 'D', sort: 1 },
  { kind: 'item_type', label: 'Top', code: 'T', sort: 2 },
  { kind: 'item_type', label: 'Jumper', code: 'J', sort: 3 },
  { kind: 'item_type', label: 'Pants', code: 'P', sort: 4 },
  { kind: 'item_type', label: 'Shoes', code: 'F', sort: 5 },
  { kind: 'item_type', label: 'Shirt', code: 'S', sort: 6 },
];
const shops: Shop[] = [
  { id: 's1', name: 'Vinnies Newtown', kind: 'shop', archived: false },
  { id: 's2', name: 'My wardrobe', kind: 'wardrobe', archived: false },
];
const ctx: ImportContext = { settings, shops, skuCodes: codes, today: '2026-11-14' };

describe('parseMoney', () => {
  it.each([
    ['$82.00', 82],
    ['82', 82],
    ['1,234.50', 1234.5],
    ['AU $12.5', 12.5],
    ['AUD 12', 12],
    ['(12.00)', -12],
    ['-3.40', -3.4],
    ['−3.40', -3.4],
    ['3.40-', -3.4],
    ['12,50', 12.5],
    ['1.234,50', 1234.5],
    ['1,234', 1234],
    [' 7 ', 7],
    ['0', 0],
    ['0.00', 0],
  ])('reads %s', (raw, expected) => {
    expect(parseMoney(raw)).toBe(expected);
  });

  it.each(['', '  ', 'abc', '--', '1.2.3', '$', '12abc'])('returns null for %p', (raw) => {
    expect(parseMoney(raw)).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
  });

  it('rounds to cents', () => {
    expect(parseMoney('12.345')).toBe(12.35);
  });
});

describe('parseDate', () => {
  it.each([
    ['2026-11-14', '2026-11-14'],
    ['2026/11/14', '2026-11-14'],
    ['2026-11-14T10:30:00Z', '2026-11-14'],
    ['2026-11-14 10:30', '2026-11-14'],
    ['14/11/2026', '2026-11-14'],
    ['14-11-2026', '2026-11-14'],
    ['14.11.26', '2026-11-14'],
    ['3/4/2026', '2026-04-03'], // day first
    ['11/14/2026', '2026-11-14'], // only valid month first
    ['14 Nov 2026', '2026-11-14'],
    ['14 November 2026', '2026-11-14'],
    ['14-Nov-26', '2026-11-14'],
    ['Nov 14, 2026', '2026-11-14'],
    ['November 14 2026', '2026-11-14'],
    ['29/02/2028', '2028-02-29'],
    ['14/11/2026 09:15', '2026-11-14'],
  ])('reads %s', (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });

  it.each(['', 'soon', '31/02/2026', '2026-13-01', '00/00/0000', '14 Foo 2026', '2027-02-29'])('rejects %p', (raw) => {
    expect(parseDate(raw)).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe('department and item type', () => {
  it('normalises departments', () => {
    expect(normalizeDepartment("Women's")).toBe('Women');
    expect(normalizeDepartment('womens')).toBe('Women');
    expect(normalizeDepartment('W')).toBe('Women');
    expect(normalizeDepartment('Ladies')).toBe('Women');
    expect(normalizeDepartment('Mens')).toBe('Men');
    expect(normalizeDepartment('male')).toBe('Men');
    expect(normalizeDepartment('Kids')).toBe('Kids');
    expect(normalizeDepartment('Boys')).toBe('Kids');
    expect(normalizeDepartment('Girls')).toBe('Kids');
    expect(normalizeDepartment('Homewares')).toBeNull();
    expect(normalizeDepartment('')).toBeNull();
    expect(normalizeDepartment(null)).toBeNull();
  });

  it('matches item types by case, plural and synonym', () => {
    expect(matchItemType('dress', codes)).toBe('Dress');
    expect(matchItemType('DRESSES', codes)).toBe('Dress');
    expect(matchItemType('Tops', codes)).toBe('Top');
    expect(matchItemType('Sweater', codes)).toBe('Jumper');
    expect(matchItemType('trousers', codes)).toBe('Pants');
    expect(matchItemType('boots', codes)).toBe('Shoes');
    expect(matchItemType('Swimwear', codes)).toBeNull();
    expect(matchItemType('', codes)).toBeNull();
  });

  it('does not map a synonym to a type the business does not have', () => {
    expect(matchItemType('handbag', codes)).toBeNull();
  });

  it('infers a type from a title', () => {
    expect(inferItemType('Zimmermann silk wrap dress', codes)).toBe('Dress');
    expect(inferItemType('Country Road linen shirt', codes)).toBe('Shirt');
    expect(inferItemType('Mystery item', codes)).toBeNull();
  });
});

describe('guessMapping', () => {
  const idx = (headers: string[], m: ColumnMapping, f: keyof ColumnMapping) => (m[f] == null ? null : headers[m[f] as number]);

  it('maps eBay Seller Hub orders report headers', () => {
    const headers = [
      'Sales Record Number', 'Order Number', 'Buyer Username', 'Item Number', 'Item Title', 'Quantity', 'Sold For',
      'Shipping And Handling', 'Total Price', 'Sale Date', 'Paid On Date', 'Post To Name',
    ];
    const m = guessMapping(headers);
    expect(idx(headers, m, 'title')).toBe('Item Title');
    expect(idx(headers, m, 'salePrice')).toBe('Sold For');
    expect(idx(headers, m, 'postage')).toBe('Shipping And Handling');
    expect(idx(headers, m, 'orderTotal')).toBe('Total Price');
    expect(idx(headers, m, 'soldDate')).toBe('Sale Date');
    expect(idx(headers, m, 'orderNo')).toBe('Order Number');
    expect(missingRequired(m)).toEqual([]);
  });

  it('maps the app template headers back to every field', () => {
    const m = guessMapping([...TEMPLATE_HEADERS]);
    expect(Object.values(m).every((v) => v !== null)).toBe(true);
    expect(new Set(Object.values(m)).size).toBe(Object.keys(m).length);
    expect(idx([...TEMPLATE_HEADERS], m, 'firstListPrice')).toBe('First listing price');
    expect(idx([...TEMPLATE_HEADERS], m, 'adFee')).toBe('Ad fee');
  });

  it('maps casual spreadsheet headings', () => {
    const headers = ['Date sold', 'Item', 'Brand', 'Dept', 'Type', 'Size', 'Paid', 'Sold price', 'Postage', 'Bought from'];
    const m = guessMapping(headers);
    expect(idx(headers, m, 'soldDate')).toBe('Date sold');
    expect(idx(headers, m, 'title')).toBe('Item');
    expect(idx(headers, m, 'department')).toBe('Dept');
    expect(idx(headers, m, 'itemType')).toBe('Type');
    expect(idx(headers, m, 'cost')).toBe('Paid');
    expect(idx(headers, m, 'salePrice')).toBe('Sold price');
    expect(idx(headers, m, 'shop')).toBe('Bought from');
  });

  it('never uses a column twice', () => {
    const m = guessMapping(['Total', 'Total price', 'Date', 'Title']);
    const used = Object.values(m).filter((v) => v !== null);
    expect(new Set(used).size).toBe(used.length);
  });

  it('leaves unknown headings unmapped and reports missing required fields', () => {
    const m = guessMapping(['Foo', 'Bar']);
    expect(Object.values(m).every((v) => v === null)).toBe(true);
    expect(missingRequired(m)).toEqual(['soldDate', 'title', 'salePrice']);
  });

  it('accepts order total instead of sale price', () => {
    const m = guessMapping(['Sale date', 'Item title', 'Total price']);
    expect(missingRequired(m)).toEqual([]);
  });

  it('normalises headers', () => {
    expect(normalizeHeader('  Sold_For ($) ')).toBe('sold for');
  });
});

// A mapping for a file laid out like the template.
const tm = guessMapping([...TEMPLATE_HEADERS]);
const row = (over: Record<string, string> = {}): string[] =>
  TEMPLATE_HEADERS.map((h, i) => over[h] ?? TEMPLATE_ROWS[0][i]);

describe('planRow', () => {
  it('builds an item and sale from a full template row', () => {
    const r = planRow(row(), tm, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.item).toMatchObject({
      title: 'Zimmermann silk wrap dress',
      brand: 'Zimmermann',
      department: 'Women',
      itemType: 'Dress',
      size: '10',
      cost: 22,
      listedDate: '2026-03-14',
      firstListPrice: 95,
      shopId: 's1',
    });
    expect(r.plan.sale).toEqual({
      orderNo: '12-34567-89012',
      soldDate: '2026-03-14',
      orderTotal: 100.6,
      buyerProtection: 6.1,
      postage: 12.5,
      salePrice: 82,
    });
    expect(r.plan.item.adRate).toBeCloseTo((3.4 / 82) * 100, 10);
    expect(r.plan.newShopName).toBeNull();
    expect(r.plan.notes).toEqual([]);
  });

  it('turns the ad fee into an ad rate on item + postage when settings say so', () => {
    const c = { ...ctx, settings: { ...settings, adFeeBase: 'item_plus_postage' as const } };
    const r = planRow(row(), tm, c);
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.item.adRate).toBeCloseTo((3.4 / 94.5) * 100, 10);
  });

  it('gives a zero ad rate for an explicit $0 ad fee and null when blank', () => {
    const zero = planRow(row({ 'Ad fee': '0' }), tm, ctx);
    const blank = planRow(row({ 'Ad fee': '' }), tm, ctx);
    if (!zero.ok || !blank.ok) throw new Error('expected ok');
    expect(zero.plan.item.adRate).toBe(0);
    expect(blank.plan.item.adRate).toBeNull();
  });

  it('skips rows without a title, date or price, with reasons', () => {
    expect(planRow(row({ 'Item title': '' }), tm, ctx)).toEqual({ ok: false, reason: 'No item title' });
    expect(planRow(row({ 'Sold date': '' }), tm, ctx)).toEqual({ ok: false, reason: 'No sold date' });
    expect(planRow(row({ 'Sold date': 'next week' }), tm, ctx)).toEqual({
      ok: false,
      reason: 'Could not read the sold date "next week"',
    });
    expect(planRow(row({ 'Sale price': '', 'Order total': '' }), tm, ctx)).toEqual({ ok: false, reason: 'No sale price' });
    expect(planRow(row({ 'Sale price': 'lots' }), tm, ctx)).toEqual({ ok: false, reason: 'Could not read the sale price "lots"' });
    expect(planRow(row({ 'Sale price': '0' }), tm, ctx)).toEqual({ ok: false, reason: 'Sale price is not above $0' });
  });

  it('estimates postage and buyer protection when missing, and says so', () => {
    const r = planRow(row({ Postage: '', 'Buyer protection': '', 'Order total': '' }), tm, ctx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.sale.postage).toBe(12.5);
    // 0.75 + 5% x (82 + 12.5) = 5.475 -> 5.48
    expect(r.plan.sale.buyerProtection).toBe(5.48);
    expect(r.plan.sale.orderTotal).toBe(99.98);
    expect(r.plan.notes.join(' ')).toMatch(/estimated/);
  });

  it('derives buyer protection from the order total when the file has it', () => {
    const r = planRow(row({ 'Buyer protection': '' }), tm, ctx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.sale.buyerProtection).toBe(6.1); // 100.60 - 82 - 12.50
  });

  it('works back from the order total when there is no sale price', () => {
    // total = (price + postage) * 1.05 + 0.75  ->  price + postage = (100.60 - 0.75) / 1.05 = 95.095..
    const r = planRow(row({ 'Sale price': '', 'Buyer protection': '' }), tm, ctx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.sale.postage).toBe(12.5);
    expect(r.plan.sale.salePrice).toBeCloseTo(82.6, 1);
    const s = r.plan.sale;
    expect(s.salePrice + s.postage + s.buyerProtection).toBeCloseTo(100.6, 2);
    expect(r.plan.notes.join(' ')).toMatch(/worked out/);
  });

  it('uses the file buyer protection when working back from the total', () => {
    const r = planRow(row({ 'Sale price': '' }), tm, ctx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.sale.salePrice).toBe(82); // 100.60 - 12.50 - 6.10
  });

  it('defaults department and item type with notes, and infers the type from the title', () => {
    const r = planRow(row({ Department: 'Homewares', 'Item type': 'Gadget', 'Item title': 'Great silk dress' }), tm, ctx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.item.department).toBe('Women');
    expect(r.plan.item.itemType).toBe('Dress');
    expect(r.plan.notes.join(' ')).toMatch(/Department "Homewares"/);
    expect(r.plan.notes.join(' ')).toMatch(/taken from the title/);

    const other = planRow(row({ 'Item type': '', 'Item title': 'Mystery' }), tm, ctx);
    if (!other.ok) throw new Error('expected ok');
    expect(other.plan.item.itemType).toBe('Other');
  });

  it('keeps cost unknown when blank, 0 for the wardrobe shop, and ignores unreadable optional numbers', () => {
    const blank = planRow(row({ Cost: '', Shop: 'Vinnies Newtown' }), tm, ctx);
    const wardrobe = planRow(row({ Cost: '', Shop: 'my wardrobe' }), tm, ctx);
    const bad = planRow(row({ Cost: 'free', 'First listing price': 'n/a' }), tm, ctx);
    if (!blank.ok || !wardrobe.ok || !bad.ok) throw new Error('expected ok');
    expect(blank.plan.item.cost).toBeNull();
    expect(wardrobe.plan.item.cost).toBe(0);
    expect(wardrobe.plan.item.shopId).toBe('s2');
    expect(bad.plan.item.cost).toBeNull();
    expect(bad.plan.item.firstListPrice).toBeNull();
    expect(bad.plan.notes.join(' ')).toMatch(/Ignored cost "free"/);
  });

  it('flags a shop that does not exist yet', () => {
    const r = planRow(row({ Shop: 'Salvos Marrickville' }), tm, ctx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.newShopName).toBe('Salvos Marrickville');
    expect(r.plan.item.shopId).toBeNull();
  });

  it('works when only the required columns exist', () => {
    const headers = ['Sale date', 'Item title', 'Sold for'];
    const m = guessMapping(headers);
    const r = planRow(['3/4/2026', 'Blue top', '$30.00'], m, ctx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.plan.sale.soldDate).toBe('2026-04-03');
    expect(r.plan.item.itemType).toBe('Top');
    expect(r.plan.item.cost).toBeNull();
    expect(r.plan.item.listedDate).toBe('2026-04-03');
    expect(r.plan.sale.orderNo).toBeNull();
  });
});

describe('planRows', () => {
  it('numbers rows from 2 and collects skips', () => {
    const rows = [row(), row({ 'Item title': '' }), row({ 'Order number': '99', 'Item title': 'Second' })];
    const s = planRows(rows, tm, ctx);
    expect(s.plans.map((p) => p.rowNumber)).toEqual([2, 4]);
    expect(s.skipped).toEqual([{ rowNumber: 3, reason: 'No item title' }]);
  });

  it('skips rows already loaded and duplicates inside the file', () => {
    const existing = new Set([dedupeKey('12-34567-89012', 'Zimmermann silk wrap dress') as string]);
    const s = planRows([row(), row({ 'Order number': '7', 'Item title': 'X' }), row({ 'Order number': '7', 'Item title': 'x' })], tm, ctx, existing);
    expect(s.plans.map((p) => p.rowNumber)).toEqual([3]);
    expect(s.skipped.map((x) => x.rowNumber)).toEqual([2, 4]);
    expect(s.skipped[0].reason).toMatch(/Already loaded/);
  });

  it('does not treat rows without an order number as duplicates', () => {
    const s = planRows([row({ 'Order number': '' }), row({ 'Order number': '' })], tm, ctx);
    expect(s.plans).toHaveLength(2);
  });

  it('groups skip reasons by kind', () => {
    const g = groupReasons([
      { reason: 'No sold date' },
      { reason: 'Could not read the sold date "a"' },
      { reason: 'Could not read the sold date "b"' },
      { reason: 'No sold date' },
      { reason: 'No sold date' },
    ]);
    expect(g).toEqual([
      { reason: 'No sold date', count: 3 },
      { reason: 'Could not read the sold date', count: 2 },
    ]);
  });
});

describe('dedupeKey', () => {
  it('needs an order number and ignores case', () => {
    expect(dedupeKey('', 'x')).toBeNull();
    expect(dedupeKey(null, 'x')).toBeNull();
    expect(dedupeKey(' AB-1 ', ' Dress ')).toBe('ab-1|dress');
  });
});

describe('template', () => {
  it('imports cleanly end to end through the CSV reader', () => {
    const text = toCsv([[...TEMPLATE_HEADERS], ...TEMPLATE_ROWS]);
    const t = parseCsvTable(text);
    const s = planRows(t.rows, guessMapping(t.headers), ctx);
    expect(s.skipped).toEqual([]);
    expect(s.plans).toHaveLength(TEMPLATE_ROWS.length);
    expect(s.plans[1].plan.item.cost).toBe(0);
    expect(s.plans[1].plan.item.shopId).toBe('s2');
  });
});
