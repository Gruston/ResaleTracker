/// <reference types="jest" />
import {
  isIsoDate,
  isPathForBusiness,
  validateListingResult,
  validatePriceResult,
  validateReceiptResult,
  validateRequest,
} from '../ai';

// No @types/node in this project: declare just what this test needs.
declare const require: (id: string) => any;
declare const __dirname: string;
const { readFileSync } = require('fs');
const { join } = require('path');

const B = '11111111-1111-4111-8111-111111111111';

describe('shared copy', () => {
  it('supabase/functions/_shared/ai.ts is identical to src/domain/ai.ts', () => {
    const a = readFileSync(join(__dirname, '../ai.ts'), 'utf8');
    const b = readFileSync(join(__dirname, '../../../supabase/functions/_shared/ai.ts'), 'utf8');
    expect(b).toBe(a);
  });
});

describe('paths and dates', () => {
  it('accepts only paths inside the business folder', () => {
    expect(isPathForBusiness(`${B}/a.jpg`, B)).toBe(true);
    expect(isPathForBusiness(`${B}/items/a.jpg`, B)).toBe(true);
    expect(isPathForBusiness(`other/a.jpg`, B)).toBe(false);
    expect(isPathForBusiness(`${B}/../x/a.jpg`, B)).toBe(false);
    expect(isPathForBusiness(`${B}/`, B)).toBe(false);
    expect(isPathForBusiness(`${B}x/a.jpg`, B)).toBe(false);
    expect(isPathForBusiness(5, B)).toBe(false);
  });
  it('checks ISO dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('28/02/2026')).toBe(false);
  });
});

describe('validateRequest', () => {
  const listing = { action: 'listing', businessId: B, photoPaths: [`${B}/1.jpg`], brand: ' Zara ', size: '' };
  it('accepts a listing and trims text', () => {
    const r = validateRequest(listing);
    expect(r.ok && r.value.action === 'listing' && r.value.brand).toBe('Zara');
    expect(r.ok && 'size' in r.value).toBe(false);
  });
  it('rejects bad listings', () => {
    expect(validateRequest({ ...listing, photoPaths: [] }).ok).toBe(false);
    expect(validateRequest({ ...listing, photoPaths: Array(7).fill(`${B}/1.jpg`) }).ok).toBe(false);
    expect(validateRequest({ ...listing, photoPaths: ['x/1.jpg'] }).ok).toBe(false);
    expect(validateRequest({ ...listing, businessId: 'nope' }).ok).toBe(false);
    expect(validateRequest({ ...listing, brand: 5 }).ok).toBe(false);
    expect(validateRequest(null).ok).toBe(false);
    expect(validateRequest({ ...listing, action: 'x' }).ok).toBe(false);
  });
  const comp = { title: 't', brand: 'b', itemType: 'Dress', size: '10', salePrice: 30, daysToSell: 5 };
  const price = { action: 'price', businessId: B, item: { brand: 'Zara', itemType: 'Dress', department: 'Women', size: '10' }, comparables: [comp] };
  it('accepts price requests, up to 30 comparables', () => {
    expect(validateRequest(price).ok).toBe(true);
    expect(validateRequest({ ...price, comparables: undefined }).ok).toBe(true);
    expect(validateRequest({ ...price, comparables: Array(30).fill(comp) }).ok).toBe(true);
    expect(validateRequest({ ...price, comparables: Array(31).fill(comp) }).ok).toBe(false);
    expect(validateRequest({ ...price, comparables: [{ ...comp, salePrice: 'x' }] }).ok).toBe(false);
    expect(validateRequest({ ...price, item: undefined }).ok).toBe(false);
  });
  it('validates receipt requests', () => {
    expect(validateRequest({ action: 'receipt', businessId: B, receiptPath: `${B}/r.jpg` }).ok).toBe(true);
    expect(validateRequest({ action: 'receipt', businessId: B, receiptPath: 'zzz/r.jpg' }).ok).toBe(false);
  });
});

describe('validateListingResult', () => {
  const good = { title: 'Zara Womens Linen Dress Size 10 Black', description: 'A lovely black linen dress for summer.', keywords: ['zara', 'Zara', 'dress', 5] };
  it('accepts and de-duplicates keywords', () => {
    const r = validateListingResult(good);
    expect(r.ok && r.value.keywords).toEqual(['zara', 'dress']);
  });
  it('rejects long, shouting or empty output', () => {
    expect(validateListingResult({ ...good, title: 'x'.repeat(81) }).ok).toBe(false);
    expect(validateListingResult({ ...good, title: 'ZARA WOMENS LINEN DRESS SIZE 10' }).ok).toBe(false);
    expect(validateListingResult({ ...good, title: 'Zara dress XL UK' }).ok).toBe(true);
    expect(validateListingResult({ ...good, description: '' }).ok).toBe(false);
    expect(validateListingResult({ ...good, keywords: 'a' }).ok).toBe(false);
    expect(validateListingResult('hi').ok).toBe(false);
  });
});

describe('validatePriceResult', () => {
  it('accepts an ordered range and rounds', () => {
    const r = validatePriceResult({ low: 20, high: 40.456, suggested: 30, reasoning: 'Based on 4 sales.' });
    expect(r.ok && r.value.high).toBe(40.46);
  });
  it('rejects disordered or missing values', () => {
    expect(validatePriceResult({ low: 20, high: 10, suggested: 15, reasoning: 'x' }).ok).toBe(false);
    expect(validatePriceResult({ low: 20, high: 40, suggested: 50, reasoning: 'x' }).ok).toBe(false);
    expect(validatePriceResult({ low: -1, high: 40, suggested: 5, reasoning: 'x' }).ok).toBe(false);
    expect(validatePriceResult({ low: 1, high: 4, suggested: 2, reasoning: '' }).ok).toBe(false);
    expect(validatePriceResult({ low: '1', high: 4, suggested: 2, reasoning: 'x' }).ok).toBe(false);
  });
});

describe('validateReceiptResult', () => {
  it('accepts a receipt, defaulting qty and dropping bad optional fields', () => {
    const r = validateReceiptResult({
      shop: ' Vinnies ',
      date: '2026-13-01',
      total: '5',
      lines: [{ description: 'Shirt', price: 4.5 }, { description: 'Jeans', qty: 2, price: 10 }],
    });
    expect(r.ok && r.value).toEqual({
      shop: 'Vinnies',
      lines: [{ description: 'Shirt', qty: 1, price: 4.5 }, { description: 'Jeans', qty: 2, price: 10 }],
    });
  });
  it('keeps valid date and total', () => {
    const r = validateReceiptResult({ date: '2026-11-01', total: 14.5, lines: [] });
    expect(r.ok && r.value).toEqual({ date: '2026-11-01', total: 14.5, lines: [] });
  });
  it('rejects bad lines', () => {
    expect(validateReceiptResult({ lines: [{ description: 'x', qty: 0, price: 1 }] }).ok).toBe(false);
    expect(validateReceiptResult({ lines: [{ description: 'x', qty: 1.5, price: 1 }] }).ok).toBe(false);
    expect(validateReceiptResult({ lines: [{ description: 'x', price: -1 }] }).ok).toBe(false);
    expect(validateReceiptResult({}).ok).toBe(false);
  });
});
