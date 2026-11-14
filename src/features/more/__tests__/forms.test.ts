/// <reference types="jest" />
import { settings } from '@/domain/testUtils';
import type { Shop, SkuCode, StorageLocation } from '@/domain/types';
import {
  addMemberErrorText,
  canArchive,
  cleanCode,
  feeFormFrom,
  isLikelyEmail,
  isValidDate,
  nextItemTypeSort,
  parseAmount,
  parseFeeForm,
  sortStorage,
  validateCode,
  validateExpense,
  validateNewItemType,
  validateShopName,
  validateStoragePrefix,
  ITEM_TYPE_CODE_RE,
} from '../forms';

const codes: SkuCode[] = [
  { kind: 'department', label: 'Women', code: 'W', sort: 1 },
  { kind: 'department', label: 'Men', code: 'M', sort: 2 },
  { kind: 'item_type', label: 'Dress', code: 'D', sort: 1 },
  { kind: 'item_type', label: 'Top', code: 'T', sort: 2 },
];

describe('amounts and dates', () => {
  it('parses amounts', () => {
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('$1,200')).toBe(1200);
    expect(parseAmount('.5')).toBe(0.5);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('-3')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
  });

  it('validates dates', () => {
    expect(isValidDate('2026-11-14')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('14/11/2026')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('shops', () => {
  const shops: Shop[] = [
    { id: '1', name: 'Vinnies', kind: 'shop', archived: false },
    { id: '2', name: 'My wardrobe', kind: 'wardrobe', archived: false },
  ];
  it('needs a unique, non-empty name (ignoring case and itself)', () => {
    expect(validateShopName('  ', shops)).toMatch(/Enter/);
    expect(validateShopName('vinnies', shops)).toMatch(/already/);
    expect(validateShopName('Salvos', shops)).toBeNull();
    expect(validateShopName('VINNIES', shops, '1')).toBeNull();
  });
  it('does not let My wardrobe be archived', () => {
    expect(canArchive(shops[0])).toBe(true);
    expect(canArchive(shops[1])).toBe(false);
  });
});

describe('SKU codes', () => {
  it('cleans typed codes', () => {
    expect(cleanCode('d1')).toBe('D');
    expect(cleanCode(' sw ')).toBe('SW');
  });

  it('item type codes are 1-2 capital letters', () => {
    expect(ITEM_TYPE_CODE_RE.test('A')).toBe(true);
    expect(ITEM_TYPE_CODE_RE.test('AB')).toBe(true);
    expect(ITEM_TYPE_CODE_RE.test('ABC')).toBe(false);
    expect(ITEM_TYPE_CODE_RE.test('a')).toBe(false);
    expect(ITEM_TYPE_CODE_RE.test('')).toBe(false);
    expect(ITEM_TYPE_CODE_RE.test('A1')).toBe(false);
  });

  it('validates new and edited codes for format and uniqueness', () => {
    expect(validateCode('item_type', 'SW', codes)).toBeNull();
    expect(validateCode('item_type', 'sw', codes)).toMatch(/capital/);
    expect(validateCode('item_type', 'ABC', codes)).toMatch(/1 or 2/);
    expect(validateCode('item_type', '', codes)).toMatch(/1 or 2/);
    expect(validateCode('item_type', 'D', codes)).toBe('D is already used for Dress');
    expect(validateCode('item_type', 'D', codes, 'Dress')).toBeNull(); // unchanged
    expect(validateCode('item_type', 'T', codes, 'Dress')).toBe('T is already used for Top');
    // department W does not clash with an item type W
    expect(validateCode('item_type', 'W', codes)).toBeNull();
    expect(validateCode('department', 'K', codes)).toBeNull();
    expect(validateCode('department', 'KK', codes)).toMatch(/one capital/);
    expect(validateCode('department', 'W', codes)).toMatch(/already/);
  });

  it('validates new item type names', () => {
    expect(validateNewItemType('', codes)).toMatch(/Enter/);
    expect(validateNewItemType('dress', codes)).toMatch(/already/);
    expect(validateNewItemType('Swimwear', codes)).toBeNull();
  });

  it('puts a new item type last', () => {
    expect(nextItemTypeSort(codes)).toBe(3);
    expect(nextItemTypeSort([])).toBe(1);
  });
});

describe('storage', () => {
  const storage: StorageLocation[] = [
    { prefix: 'WD', location: 'Rack A' },
    { prefix: 'M', location: 'Box 1' },
    { prefix: 'KT', location: 'Box 2' },
  ];
  it('validates prefixes', () => {
    expect(validateStoragePrefix('WT', storage)).toBeNull();
    expect(validateStoragePrefix('K', storage)).toBeNull();
    expect(validateStoragePrefix('wd', storage)).toMatch(/capital/);
    expect(validateStoragePrefix('', storage)).toMatch(/capital/);
    expect(validateStoragePrefix('WD', storage)).toMatch(/already has/);
  });
  it('sorts department letters first', () => {
    expect(sortStorage(storage).map((s) => s.prefix)).toEqual(['M', 'KT', 'WD']);
  });
});

describe('fee settings form', () => {
  it('round trips the settings', () => {
    const f = feeFormFrom(settings);
    expect(f).toEqual({ protectionFixed: '0.75', protectionPct: '5', defaultAdRate: '3', adFeeBase: 'item', defaultLabelCost: '12.5' });
    const r = parseFeeForm(f);
    expect(r).toEqual({
      ok: true,
      patch: { protectionFixed: 0.75, protectionPct: 5, defaultAdRate: 3, adFeeBase: 'item', defaultLabelCost: 12.5 },
    });
  });

  it('reports errors per field', () => {
    const r = parseFeeForm({ ...feeFormFrom(settings), protectionFixed: '', protectionPct: '500', defaultAdRate: 'x' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['defaultAdRate', 'protectionFixed', 'protectionPct']);
    expect(r.errors.protectionPct).toMatch(/too high/);
  });

  it('accepts the ad fee base choice', () => {
    const r = parseFeeForm({ ...feeFormFrom(settings), adFeeBase: 'item_plus_postage' });
    expect(r.ok && r.patch.adFeeBase).toBe('item_plus_postage');
  });
});

describe('expense form', () => {
  it('requires what, a positive amount and a real date', () => {
    expect(validateExpense({ description: 'Satchels', amount: '24.50', date: '2026-11-14' })).toEqual({});
    expect(Object.keys(validateExpense({ description: ' ', amount: '0', date: '2026-02-30' })).sort()).toEqual(['amount', 'date', 'description']);
    expect(validateExpense({ description: 'x', amount: '', date: '2026-11-14' }).amount).toBeDefined();
  });
});

describe('people', () => {
  it('checks emails loosely', () => {
    expect(isLikelyEmail('damon@example.com')).toBe(true);
    expect(isLikelyEmail(' damon@example.com ')).toBe(true);
    expect(isLikelyEmail('damon@')).toBe(false);
    expect(isLikelyEmail('damon example.com')).toBe(false);
  });

  it('explains add-member errors in plain words', () => {
    expect(addMemberErrorText('no account with that email yet; ask them to sign in to the app once first')).toMatch(/has not signed in/);
    expect(addMemberErrorText('only the owner can add members')).toMatch(/Only the person/);
    expect(addMemberErrorText('Network request failed')).toMatch(/connection/);
    expect(addMemberErrorText('boom')).toBe('Could not add Damon: boom');
  });
});
