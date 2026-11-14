/// <reference types="jest" />
import { formatSku, parseSku, skuPrefix, storageFor } from '../sku';
import { sampleData } from '../fixtures';

const { skuCodes, storage } = sampleData;

describe('skuPrefix', () => {
  it('joins department and item-type codes', () => {
    expect(skuPrefix('Women', 'Dress', skuCodes)).toBe('WDR');
    expect(skuPrefix('Men', 'Shoes', skuCodes)).toBe('MSO');
    expect(skuPrefix('Kids', 'Jacket', skuCodes)).toBe('KJA');
    expect(skuPrefix('Women', 'Playsuit', skuCodes)).toBe('WPL');
  });
  it('uses X for unknown labels', () => {
    expect(skuPrefix('Women', 'Hat', skuCodes)).toBe('WX');
    expect(skuPrefix('Pets', 'Dress', skuCodes)).toBe('XDR');
    expect(skuPrefix('Women', 'Dress', [])).toBe('XX');
  });
  it('is not fooled by a department label equal to an item type label', () => {
    const codes = [{ kind: 'department' as const, label: 'Dress', code: 'Z', sort: 1 }, ...skuCodes];
    expect(skuPrefix('Women', 'Dress', codes)).toBe('WDR');
  });
});

describe('parseSku', () => {
  it('parses prefix and number', () => {
    expect(parseSku('WD-014')).toEqual({ prefix: 'WD', number: 14 });
    expect(parseSku('MF-1')).toEqual({ prefix: 'MF', number: 1 });
    expect(parseSku('WD-1234')).toEqual({ prefix: 'WD', number: 1234 });
  });
  it('returns null for non-SKUs', () => {
    expect(parseSku('')).toBeNull();
    expect(parseSku('WD')).toBeNull();
    expect(parseSku('wd-001')).toBeNull();
    expect(parseSku('WD-')).toBeNull();
    expect(parseSku('WD-0x1')).toBeNull();
  });
});

describe('formatSku', () => {
  it('pads to 3 digits like next_sku()', () => {
    expect(formatSku('WD', 15)).toBe('WD-015');
    expect(formatSku('WD', 1234)).toBe('WD-1234');
  });
});

describe('storageFor', () => {
  it('uses a full prefix match first', () => {
    expect(storageFor('WDR-014', storage)).toBe('Rack A · dresses, by colour');
    expect(storageFor('WSO-001', storage)).toBe('Box S1 · shoes');
  });
  it('falls back to the department letter', () => {
    expect(storageFor('MJ-003', storage)).toBe("Shelf 5 · men's");
    expect(storageFor('KD-001', storage)).toBe("Shelf 6 · kids'");
    expect(storageFor('WY-002', storage)).toBe("Rack C · other women's");
  });
  it('prefers a specific prefix over the department fallback', () => {
    expect(storageFor('MJ-003', [...storage, { prefix: 'MJ', location: 'Hook 1' }])).toBe('Hook 1');
  });
  it("is 'Not set' when nothing matches", () => {
    expect(storageFor('XX-001', storage)).toBe('Not set');
    expect(storageFor('WD-001', [])).toBe('Not set');
    expect(storageFor('', storage)).toBe('Not set');
  });
  it('accepts a bare prefix', () => {
    expect(storageFor('WTO', storage)).toBe('Shelf 2 · tops');
  });
});
