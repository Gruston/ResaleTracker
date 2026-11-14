/// <reference types="jest" />
import { data as makeData, item, order, ret, settings } from '../../../domain/testUtils';
import { formatMoney0 } from '../../../domain/money';
import {
  ALL_TYPES,
  buildEntries,
  displayName,
  filterEntries,
  itemTypesPresent,
  matchesQuery,
  parseStatusFilter,
  rowRight,
  rowSubtitle,
  sortEntries,
  statusMatches,
} from '../listing';

const shops = [{ id: 's1', name: 'Vinnies Newtown', kind: 'shop' as const, archived: false }];

const biz = makeData({
  settings,
  shops,
  items: [
    item('1', { sku: 'WS-001', brand: 'Gorman', title: 'Linen Skirt', itemType: 'Skirt', size: '10', status: 'sold', shopId: 's1', listedDate: '2026-09-01', firstListPrice: 60, cost: 10 }),
    item('2', { sku: 'WD-012', brand: 'Country Road', title: 'Wrap Dress', itemType: 'Dress', size: '12', status: 'listed', listedDate: '2026-10-20', firstListPrice: 80, onlineOrderNo: 'ON-777' }),
    item('3', { sku: 'MJ-003', brand: 'Rodd', title: 'Jacket', itemType: 'Jacket', department: 'Men', size: 'L', status: 'draft', listedDate: null, firstListPrice: null }),
    item('4', { sku: 'WT-004', brand: 'Zara', title: 'Silk Top', itemType: 'Top', size: '10', status: 'returned', listedDate: '2026-08-01', firstListPrice: 40 }),
  ],
  orders: [order('o1', '1', '2026-09-10', 60, { orderNo: '26-111-222', trackingNo: 'TRK999' })],
  returns: [],
});
const entries = buildEntries(biz);
const by = (sku: string) => entries.find((e) => e.item.sku === sku)!;

describe('status filters', () => {
  it('maps chips to statuses', () => {
    expect(statusMatches('Sold', 'sold')).toBe(true);
    expect(statusMatches('Sold', 'posted')).toBe(true);
    expect(statusMatches('To post', 'posted')).toBe(false);
    expect(statusMatches('To post', 'sold')).toBe(true);
    expect(statusMatches('All', 'faulty')).toBe(true);
    expect(statusMatches('Draft', 'listed')).toBe(false);
  });
  it('parses route params leniently', () => {
    expect(parseStatusFilter('To post')).toBe('To post');
    expect(parseStatusFilter('to%20post'.replace('%20', ' '))).toBe('To post');
    expect(parseStatusFilter(['listed'])).toBe('Listed');
    expect(parseStatusFilter('Posted')).toBe('Sold');
    expect(parseStatusFilter('nonsense')).toBe('All');
    expect(parseStatusFilter(undefined)).toBe('All');
  });
});

describe('search', () => {
  it('matches each searchable field', () => {
    expect(matchesQuery(by('WS-001'), 'skirt')).toBe(true);
    expect(matchesQuery(by('WS-001'), 'GORMAN')).toBe(true);
    expect(matchesQuery(by('WD-012'), 'wd-012')).toBe(true);
    expect(matchesQuery(by('WS-001'), 'vinnies')).toBe(true);
    expect(matchesQuery(by('WD-012'), 'on-777')).toBe(true);
    expect(matchesQuery(by('WS-001'), '26-111')).toBe(true);
    expect(matchesQuery(by('WS-001'), 'trk999')).toBe(true);
    expect(matchesQuery(by('MJ-003'), 'men')).toBe(true);
    expect(matchesQuery(by('WS-001'), 'zara')).toBe(false);
  });
  it('requires every word', () => {
    expect(matchesQuery(by('WS-001'), 'gorman skirt')).toBe(true);
    expect(matchesQuery(by('WS-001'), 'gorman dress')).toBe(false);
  });
  it('treats "size N" as an exact size', () => {
    expect(matchesQuery(by('WS-001'), 'size 10')).toBe(true);
    expect(matchesQuery(by('WD-012'), 'size 10')).toBe(false);
    expect(matchesQuery(by('WD-012'), 'size 1')).toBe(false);
    expect(matchesQuery(by('WS-001'), 'skirt size 10')).toBe(true);
  });
  it('empty query matches all', () => {
    expect(entries.every((e) => matchesQuery(e, '  '))).toBe(true);
  });
});

describe('filterEntries / sortEntries', () => {
  it('combines status, type and query', () => {
    expect(filterEntries(entries, { q: '', status: 'Listed', itemType: ALL_TYPES }).map((e) => e.item.sku)).toEqual(['WD-012']);
    expect(filterEntries(entries, { q: '', status: 'All', itemType: 'Top' }).map((e) => e.item.sku)).toEqual(['WT-004']);
    expect(filterEntries(entries, { q: 'size 10', status: 'All', itemType: ALL_TYPES })).toHaveLength(2);
  });
  it('sorts', () => {
    const skus = (k: Parameters<typeof sortEntries>[1]) => sortEntries(entries, k).map((e) => e.item.sku);
    expect(skus('az')).toEqual(['WD-012', 'WS-001', 'MJ-003', 'WT-004']);
    expect(skus('new')).toEqual(['WD-012', 'WS-001', 'WT-004', 'MJ-003']);
    expect(skus('price')).toEqual(['WD-012', 'WS-001', 'WT-004', 'MJ-003']);
    expect(skus('age')).toEqual(['WT-004', 'WS-001', 'WD-012', 'MJ-003']);
  });
  it('does not mutate its input', () => {
    const before = entries.map((e) => e.item.sku);
    sortEntries(entries, 'price');
    expect(entries.map((e) => e.item.sku)).toEqual(before);
  });
});

describe('helpers', () => {
  it('lists item types present', () => {
    expect(itemTypesPresent(biz.items)).toEqual(['Dress', 'Jacket', 'Skirt', 'Top']);
  });
  it('displayName avoids repeating the brand', () => {
    expect(displayName({ brand: 'Gorman', title: 'Linen Skirt' })).toBe('Gorman Linen Skirt');
    expect(displayName({ brand: 'Gorman', title: 'Gorman Linen Skirt Size 10' })).toBe('Gorman Linen Skirt Size 10');
    expect(displayName({ brand: '', title: 'Skirt' })).toBe('Skirt');
  });
  it('rowSubtitle', () => {
    expect(rowSubtitle(by('WD-012').item)).toBe('WD-012 · Women 12');
  });
  it('rowRight shows profit for sold, price and days for listed', () => {
    const sold = rowRight(by('WS-001'), '2026-11-14', formatMoney0)!;
    expect(sold.profit).toBe(true);
    expect(sold.sub).toBe('profit');
    const listed = rowRight(by('WD-012'), '2026-11-14', formatMoney0)!;
    expect(listed).toEqual({ value: '$80', sub: '25 days', profit: false });
    expect(rowRight(by('MJ-003'), '2026-11-14', formatMoney0)).toBeNull();
  });
  it('rowRight hides profit for returned items', () => {
    const b = makeData({
      items: [item('9', { status: 'returned', firstListPrice: 30, listedDate: '2026-11-13' })],
      orders: [order('o9', '9', '2026-11-14', 30)],
      returns: [ret('r9', '9')],
    });
    const r = rowRight(buildEntries(b)[0], '2026-11-14', formatMoney0)!;
    expect(r.profit).toBe(false);
    expect(r.sub).toBe('1 day');
  });
});
