/// <reference types="jest" />
import {
  checkReceipt,
  friendlyReceiptError,
  matchShop,
  mergeDraftLines,
  mismatchText,
  normaliseShopName,
  sanitiseReceiptDate,
  summaryText,
} from '../receipt';
import type { Shop } from '@/domain/types';

const shop = (id: string, name: string, archived = false): Shop => ({ id, name, kind: 'shop', archived });
const mk = () => {
  let n = 0;
  return () => `k${++n}`;
};

describe('shop matching', () => {
  const shops = [shop('1', 'Salvos'), shop('2', "Vinnies St Mary's"), shop('3', 'Red Cross')];
  it('ignores case, punctuation and shop words', () => {
    expect(normaliseShopName('SALVOS STORES')).toBe('salvos');
    expect(normaliseShopName('The Salvos Op Shop')).toBe('salvos');
    expect(matchShop('salvos stores', shops)?.id).toBe('1');
    expect(matchShop('Vinnies St. Marys Store', shops)?.id).toBe('2');
    expect(matchShop('RED-CROSS', shops)?.id).toBe('3');
  });
  it('returns null for unknown, empty or noise-only names', () => {
    expect(matchShop('Lifeline', shops)).toBeNull();
    expect(matchShop(undefined, shops)).toBeNull();
    expect(matchShop('Op Shop', shops)).toBeNull();
  });
  it('prefers an active shop over an archived one', () => {
    expect(matchShop('Salvos', [shop('a', 'Salvos', true), shop('b', 'Salvos Store')])?.id).toBe('b');
    expect(matchShop('Salvos', [shop('a', 'Salvos', true)])?.id).toBe('a');
  });
});

describe('date sanity', () => {
  it('accepts a past date and rejects future, invalid and ancient ones', () => {
    expect(sanitiseReceiptDate('2026-11-10', '2026-11-14')).toBe('2026-11-10');
    expect(sanitiseReceiptDate('2026-11-14', '2026-11-14')).toBe('2026-11-14');
    expect(sanitiseReceiptDate('2026-11-15', '2026-11-14')).toBeNull();
    expect(sanitiseReceiptDate('2026-02-30', '2026-11-14')).toBeNull();
    expect(sanitiseReceiptDate('2019-01-01', '2026-11-14')).toBeNull();
    expect(sanitiseReceiptDate(undefined, '2026-11-14')).toBeNull();
  });
});

describe('mergeDraftLines', () => {
  const blank = { key: 'b', description: '', qty: '1', price: '' };
  const typed = { key: 't', description: 'Jumper', qty: '1', price: '6.50' };
  const incoming = [
    { description: 'Dress', qty: 1, price: 8 },
    { description: 'Shirts', qty: 3, price: 12.5 },
  ];
  it('replaces blank drafts', () => {
    const out = mergeDraftLines([blank], incoming, mk());
    expect(out).toEqual([
      { key: 'k1', description: 'Dress', qty: '1', price: '8.00' },
      { key: 'k2', description: 'Shirts', qty: '3', price: '12.50' },
    ]);
  });
  it('appends after typed lines and drops blank ones', () => {
    const out = mergeDraftLines([typed, blank], incoming, mk());
    expect(out.map((d) => d.description)).toEqual(['Jumper', 'Dress', 'Shirts']);
  });
  it('keeps existing when there is nothing to add', () => {
    expect(mergeDraftLines([blank], [], mk())).toEqual([blank]);
  });
});

describe('checkReceipt', () => {
  it('matches within 5 cents', () => {
    const c = checkReceipt([{ price: 10 }, { price: 20.03 }], 30);
    expect(c.matches).toBe(true);
    expect(mismatchText(c)).toBeNull();
  });
  it('reports the difference', () => {
    const c = checkReceipt([{ price: 30 }, { price: 30.5 }], 64);
    expect(c.matches).toBe(false);
    expect(c.difference).toBe(-3.5);
    expect(mismatchText(c)).toContain('$3.50 less');
    expect(mismatchText(checkReceipt([{ price: 70 }], 64))).toContain('$6.00 more');
  });
  it('has no difference without a total', () => {
    const c = checkReceipt([{ price: 5 }], undefined);
    expect(c.difference).toBeNull();
    expect(summaryText(c)).toBe('Read 1 line. Check them before saving.');
  });
  it('writes the summary', () => {
    expect(summaryText(checkReceipt(new Array(7).fill({ price: 9.1428571 }), 64))).toBe('Read 7 lines, $64.00 total. Check them before saving.');
  });
});

describe('friendlyReceiptError', () => {
  it('maps setup, offline and cap errors', () => {
    expect(friendlyReceiptError(new Error('Edge Function returned a non-2xx status code')).message).toMatch(/Ask Greg/);
    expect(friendlyReceiptError(new Error('Network request failed')).retry).toBe(true);
    const cap = friendlyReceiptError(new Error('You have used all 50 AI helpers for today. Try again tomorrow.'));
    expect(cap.retry).toBe(false);
  });
  it('passes through other friendly messages', () => {
    expect(friendlyReceiptError(new Error('That receipt photo is not valid.')).message).toBe('That receipt photo is not valid.');
  });
});
