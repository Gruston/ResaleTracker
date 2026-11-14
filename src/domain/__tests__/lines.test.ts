/// <reference types="jest" />
import { splitLine, tripProgress } from '../lines';
import { line, trip } from '../testUtils';
import { sumMoney } from '../money';

describe('splitLine', () => {
  it('splits "3 × Cotton On tops $15" into three $5 lines', () => {
    const out = splitLine(line('l1', { description: 'Cotton On tops', qty: 3, price: 15, sort: 5 }));
    expect(out).toHaveLength(3);
    expect(out.map((l) => l.description)).toEqual(['Cotton On top 1', 'Cotton On top 2', 'Cotton On top 3']);
    expect(out.map((l) => l.price)).toEqual([5, 5, 5]);
    expect(out.every((l) => l.qty === 1 && l.outcome === 'to_list' && l.tripId === 't1')).toBe(true);
    expect(out.map((l) => l.sort)).toEqual([5, 6, 7]);
  });

  it('puts remainder cents on the first line', () => {
    const out = splitLine(line('l1', { description: 'Socks', qty: 3, price: 10 }));
    expect(out.map((l) => l.price)).toEqual([3.34, 3.33, 3.33]);
    expect(sumMoney(out.map((l) => l.price))).toBe(10);
  });

  it('handles awkward totals exactly', () => {
    const out = splitLine(line('l1', { qty: 7, price: 19.99 }));
    expect(sumMoney(out.map((l) => l.price))).toBe(19.99);
    expect(out[0].price).toBeGreaterThanOrEqual(out[6].price);
  });

  it('naively singularises: strips one trailing s, not from "ss" or single letters', () => {
    expect(splitLine(line('l', { description: 'Dress', qty: 2, price: 10 }))[0].description).toBe('Dress 1');
    expect(splitLine(line('l', { description: 'Jeans', qty: 2, price: 10 }))[0].description).toBe('Jean 1');
    expect(splitLine(line('l', { description: 's', qty: 2, price: 10 }))[0].description).toBe('s 1');
    expect(splitLine(line('l', { description: 'Top', qty: 2, price: 10 }))[0].description).toBe('Top 1');
  });

  it('a qty 1 line comes back as one unchanged copy without an id', () => {
    const out = splitLine(line('l1', { description: 'Tops', qty: 1, price: 4 }));
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe('Tops');
    expect(out[0].price).toBe(4);
    expect('id' in out[0]).toBe(false);
  });

  it('zero price splits into zero-priced lines', () => {
    expect(splitLine(line('l', { qty: 2, price: 0 })).map((l) => l.price)).toEqual([0, 0]);
  });

  it('keeps the item link on the first line only', () => {
    const out = splitLine(line('l', { qty: 2, price: 10, outcome: 'listed', itemId: 'i1' }));
    expect(out.map((l) => l.itemId)).toEqual(['i1', null]);
    expect(out.every((l) => l.outcome === 'listed')).toBe(true);
  });
});

describe('tripProgress', () => {
  it("counts lines whose outcome is not 'to_list' as sorted", () => {
    const t = trip('t', {
      lines: [
        line('1', { outcome: 'listed' }), line('2', { outcome: 'family' }), line('3', { outcome: 'keeping' }),
        line('4', { outcome: 'faulty' }), line('5', { outcome: 'to_list' }),
      ],
    });
    expect(tripProgress(t)).toEqual({ sorted: 4, total: 5 });
  });
  it('handles a trip with no lines', () => {
    expect(tripProgress(trip('t'))).toEqual({ sorted: 0, total: 0 });
  });
  it('all to list = nothing sorted', () => {
    expect(tripProgress(trip('t', { lines: [line('1'), line('2')] }))).toEqual({ sorted: 0, total: 2 });
  });
});
