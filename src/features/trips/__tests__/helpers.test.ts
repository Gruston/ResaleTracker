/// <reference types="jest" />
import {
  brandGuess,
  isTripDone,
  isValidDate,
  lineHeading,
  parseMoney,
  parseQty,
  perEach,
  readDraftLines,
  sortTripsNewest,
  sortedLabel,
  totalMismatchNote,
} from '../helpers';
import { line, trip } from '@/domain/testUtils';

describe('parsing', () => {
  it('parses money', () => {
    expect(parseMoney('$1,200.5')).toBe(1200.5);
    expect(parseMoney('12')).toBe(12);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('-3')).toBeNull();
  });
  it('parses qty', () => {
    expect(parseQty('3')).toBe(3);
    expect(parseQty('0')).toBeNull();
    expect(parseQty('1.5')).toBeNull();
  });
  it('validates dates', () => {
    expect(isValidDate('2026-11-14')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('14/11/2026')).toBe(false);
    expect(isValidDate('2024-02-29')).toBe(true);
  });
});

describe('line helpers', () => {
  it('heading and per-each', () => {
    const l = line('a', { description: 'Cotton On tops', qty: 3, price: 15 });
    expect(lineHeading(l)).toBe('3 × Cotton On tops');
    expect(perEach(l)).toBe(5);
    expect(lineHeading(line('b', { description: 'Nike cap', qty: 1 }))).toBe('Nike cap');
  });
  it('guesses brand', () => {
    expect(brandGuess('Country Road linen dress')).toBe('Country Road');
    expect(brandGuess('Zara knit vest')).toBe('Zara');
    expect(brandGuess('')).toBe('');
  });
});

describe('trip helpers', () => {
  it('notes a mismatch kindly', () => {
    const t = trip('t', { total: 47, lines: [line('a', { price: 14 }), line('b', { price: 8 })] });
    expect(totalMismatchNote(t)).toBe('Lines add up to $22.00; receipt says $47.00.');
    expect(totalMismatchNote({ ...t, total: 22 })).toBeNull();
    expect(totalMismatchNote({ ...t, lines: [] })).toBeNull();
  });
  it('progress labels', () => {
    const t = trip('t', { lines: [line('a', { outcome: 'family' }), line('b', { outcome: 'to_list' })] });
    expect(sortedLabel(t)).toBe('1 of 2 sorted');
    expect(isTripDone(t)).toBe(false);
    expect(isTripDone({ lines: [line('a', { outcome: 'keeping' })] })).toBe(true);
    expect(isTripDone({ lines: [] })).toBe(false);
  });
  it('sorts newest first', () => {
    const out = sortTripsNewest([{ tripDate: '2026-01-01' }, { tripDate: '2026-03-01' }, { tripDate: '2026-02-01' }]);
    expect(out.map((t) => t.tripDate)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
  });
});

describe('readDraftLines', () => {
  it('skips blanks and flags partial rows', () => {
    const r = readDraftLines([
      { key: '1', description: 'Zara vest', qty: '1', price: '8' },
      { key: '2', description: '', qty: '1', price: '' },
      { key: '3', description: 'Cap', qty: '', price: 'x' },
    ]);
    expect(r.lines).toEqual([{ description: 'Zara vest', qty: 1, price: 8 }]);
    expect(r.invalid).toEqual(['3']);
  });
});
