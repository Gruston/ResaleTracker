/// <reference types="jest" />
import { csvCell, csvMoney, detectDelimiter, parseCsv, parseCsvTable, stripBom, toCsv } from '../csv';

describe('parseCsv', () => {
  it('parses plain rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles CRLF, CR and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\r1,2\r')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\n1\n\n')).toEqual([['a'], ['1']]);
  });

  it('strips a BOM', () => {
    expect(parseCsv('﻿Sold date,Item title\n2026-01-01,Dress')[0]).toEqual(['Sold date', 'Item title']);
    expect(stripBom('﻿x')).toBe('x');
    expect(stripBom('x')).toBe('x');
  });

  it('handles quoted commas, escaped quotes and embedded newlines', () => {
    const text = 'title,notes\n"Dress, silk","She said ""hi"""\n"Line1\nLine2",x';
    expect(parseCsv(text)).toEqual([
      ['title', 'notes'],
      ['Dress, silk', 'She said "hi"'],
      ['Line1\nLine2', 'x'],
    ]);
  });

  it('keeps empty fields, including a trailing one', () => {
    expect(parseCsv('a,,c,\n,,,')).toEqual([['a', '', 'c', ''], ['', '', '', '']]);
  });

  it('treats a quote in the middle of a field as a literal', () => {
    expect(parseCsv('5" heel,x')).toEqual([['5" heel', 'x']]);
  });

  it('copes with an unterminated quote', () => {
    expect(parseCsv('a,"b c')).toEqual([['a', 'b c']]);
  });

  it('keeps a quoted empty field as a cell', () => {
    expect(parseCsv('a,""\n1,2')).toEqual([['a', ''], ['1', '2']]);
  });

  it('drops blank lines but keeps rows with only separators', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('returns nothing for empty text', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });

  it('detects semicolon and tab delimiters', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('a,b;c')).toBe(',');
    expect(detectDelimiter('"a;b;c",d')).toBe(',');
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('parses an eBay-style header line with quoted headers', () => {
    const rows = parseCsv('"Sales Record Number","Order Number","Item Title","Sold For","Total Price"\r\n"1","12-345","Dress, midi","$82.00","$100.60"\r\n');
    expect(rows[1]).toEqual(['1', '12-345', 'Dress, midi', '$82.00', '$100.60']);
  });
});

describe('parseCsvTable', () => {
  it('splits headers and rows, padding short rows and trimming long ones', () => {
    const t = parseCsvTable('a, b ,c\n1,2\n1,2,3,4');
    expect(t.headers).toEqual(['a', 'b', 'c']);
    expect(t.rows).toEqual([['1', '2', ''], ['1', '2', '3']]);
  });

  it('handles empty input', () => {
    expect(parseCsvTable('')).toEqual({ headers: [], rows: [] });
  });
});

describe('writing', () => {
  it('quotes only when needed', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(' padded')).toBe('" padded"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(true)).toBe('true');
  });

  it('joins rows with CRLF and ends with one', () => {
    expect(toCsv([['a', 'b'], [1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n');
    expect(toCsv([])).toBe('');
  });

  it('round trips awkward values', () => {
    const rows = [['Title', 'Notes'], ['Dress, "silk"', 'line1\nline2'], ['', ' x ']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('formats money', () => {
    expect(csvMoney(12.5)).toBe('12.50');
    expect(csvMoney(0)).toBe('0.00');
    expect(csvMoney(-3)).toBe('-3.00');
    expect(csvMoney(null)).toBe('');
    expect(csvMoney(undefined)).toBe('');
  });
});
