/// <reference types="jest" />
import {
  addDays, daysBetween, financialYearOf, formatDate, formatDateShort, fyLabel, fyRange, monthLabel, monthLabelLong, monthOf,
  monthsEndingAt, nextSeason, nextSeasonStart, seasonMonths, seasonOf, seasonStartYear, today,
} from '../dates';

describe('daysBetween / addDays', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-10-05', '2026-10-19')).toBe(14);
    expect(daysBetween('2026-10-19', '2026-10-05')).toBe(-14);
    expect(daysBetween('2026-11-14', '2026-11-14')).toBe(0);
  });
  it('crosses month, year and leap days', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
  it('is unaffected by daylight saving', () => {
    expect(daysBetween('2026-10-03', '2026-10-05')).toBe(2);
    expect(daysBetween('2026-04-04', '2026-04-06')).toBe(2);
  });
  it('addDays moves forwards and backwards', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-11-14', 0)).toBe('2026-11-14');
  });
});

describe('today', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('uses the Sydney date', () => {
    // 2026-11-13T23:30Z is already 14 Nov in Sydney (AEDT, UTC+11)
    jest.useFakeTimers().setSystemTime(new Date('2026-11-13T23:30:00Z'));
    try {
      expect(today()).toBe('2026-11-14');
      jest.setSystemTime(new Date('2026-06-30T13:59:00Z')); // AEST, UTC+10: 23:59 on 30 Jun
      expect(today()).toBe('2026-06-30');
      jest.setSystemTime(new Date('2026-06-30T14:00:00Z'));
      expect(today()).toBe('2026-07-01');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('formatting', () => {
  it('formatDate', () => {
    expect(formatDate('2026-11-14')).toBe('14 Nov 2026');
    expect(formatDate('2026-01-05')).toBe('5 Jan 2026');
  });
  it('formatDateShort / monthLabel', () => {
    expect(formatDateShort('2026-11-14')).toBe('14 Nov');
    expect(monthLabel('2026-03')).toBe('Mar');
    expect(monthLabelLong('2026-03')).toBe('Mar 2026');
    expect(monthOf('2026-11-14')).toBe('2026-11');
  });
});

describe('monthsEndingAt', () => {
  it('lists months oldest first', () => {
    expect(monthsEndingAt('2026-11', 3)).toEqual(['2026-09', '2026-10', '2026-11']);
  });
  it('crosses year boundaries', () => {
    expect(monthsEndingAt('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('count 1 is just the month; 0 is empty', () => {
    expect(monthsEndingAt('2026-11', 1)).toEqual(['2026-11']);
    expect(monthsEndingAt('2026-11', 0)).toEqual([]);
  });
});

describe('seasons (Australian)', () => {
  it.each([
    ['2026-12-01', 'Summer'], ['2026-01-15', 'Summer'], ['2026-02-28', 'Summer'],
    ['2026-03-01', 'Autumn'], ['2026-05-31', 'Autumn'],
    ['2026-06-01', 'Winter'], ['2026-08-31', 'Winter'],
    ['2026-09-01', 'Spring'], ['2026-11-30', 'Spring'],
  ] as const)('%s is %s', (d, s) => {
    expect(seasonOf(d)).toBe(s);
  });
  it('seasonMonths', () => {
    expect(seasonMonths('Summer')).toBe('Dec–Feb');
    expect(seasonMonths('Autumn')).toBe('Mar–May');
    expect(seasonMonths('Winter')).toBe('Jun–Aug');
    expect(seasonMonths('Spring')).toBe('Sep–Nov');
  });
  it('nextSeason wraps around', () => {
    expect(nextSeason('2026-11-14')).toBe('Summer');
    expect(nextSeason('2026-01-14')).toBe('Autumn');
    expect(nextSeason('2026-04-14')).toBe('Winter');
    expect(nextSeason('2026-07-14')).toBe('Spring');
  });
  it('nextSeasonStart', () => {
    expect(nextSeasonStart('2026-11-14')).toBe('2026-12-01');
    expect(nextSeasonStart('2026-12-14')).toBe('2027-03-01');
    expect(nextSeasonStart('2027-01-14')).toBe('2027-03-01');
    expect(nextSeasonStart('2026-04-14')).toBe('2026-06-01');
    expect(nextSeasonStart('2026-07-14')).toBe('2026-09-01');
  });
  it('seasonStartYear puts Jan/Feb in the summer that began the previous December', () => {
    expect(seasonStartYear('2027-01-10')).toBe(2026);
    expect(seasonStartYear('2026-12-10')).toBe(2026);
    expect(seasonStartYear('2026-03-10')).toBe(2026);
  });
});

describe('financial year', () => {
  it('FY runs 1 Jul to 30 Jun', () => {
    expect(financialYearOf('2026-07-01')).toBe(2026);
    expect(financialYearOf('2027-06-30')).toBe(2026);
    expect(financialYearOf('2026-06-30')).toBe(2025);
    expect(financialYearOf('2026-11-14')).toBe(2026);
    expect(financialYearOf('2027-01-01')).toBe(2026);
  });
  it('fyLabel', () => {
    expect(fyLabel(2026)).toBe('FY 2026–27');
    expect(fyLabel(2099)).toBe('FY 2099–00');
    expect(fyLabel(2008)).toBe('FY 2008–09');
  });
  it('fyRange', () => {
    expect(fyRange(2026)).toEqual({ start: '2026-07-01', end: '2027-06-30' });
  });
});
