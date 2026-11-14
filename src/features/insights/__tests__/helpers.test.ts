/// <reference types="jest" />
import { discounts, byItemType, priceBands, shopStats } from '@/domain';
import { sampleData, SAMPLE_TODAY } from '@/domain/fixtures';
import { data as emptyData, item, order } from '@/domain/testUtils';
import {
  bestTypeSentence,
  chartMonths,
  discountSentence,
  fmtDays,
  heatColor,
  homeAlerts,
  moneyOrDash,
  pluralType,
  priceBandSentence,
  shopInsightLines,
  shortShopName,
  stockSummary,
  typeByMonthFor,
} from '../helpers';
import { defaultInputs, parseAmount, runWhatIf } from '../whatIfHelpers';

describe('insights helpers', () => {
  it('chartMonths ends this month with nine months', () => {
    const m = chartMonths('2026-11-14');
    expect(m).toHaveLength(9);
    expect(m[0]).toBe('2026-03');
    expect(m[8]).toBe('2026-11');
  });

  it('pluralType and fmtDays', () => {
    expect(pluralType('Dress')).toBe('Dresses');
    expect(pluralType('Top')).toBe('Tops');
    expect(pluralType('Jeans')).toBe('Jeanses');
    expect(fmtDays(null)).toBe('—');
    expect(fmtDays(12.6)).toBe('13');
    expect(moneyOrDash(5, false)).toBe('—');
  });

  it('empty business gives no sentences and no NaN', () => {
    const d = emptyData();
    expect(bestTypeSentence(byItemType(d), 'All')).toBeNull();
    expect(discountSentence(discounts(d))).toBeNull();
    expect(priceBandSentence(priceBands(d))).toBeNull();
    expect(shopInsightLines(shopStats(d))).toEqual([]);
    expect(stockSummary(d)).toEqual({ count: 0, cost: 0, asking: 0 });
    expect(homeAlerts(d).missingCost.firstId).toBeNull();
  });

  it('sample data produces sentences', () => {
    expect(bestTypeSentence(byItemType(sampleData, 'Women'), 'Women')).toMatch(/^Your best-selling item type in Women is \w+/);
    expect(discountSentence(discounts(sampleData))).toMatch(/below your first listing price\. To get about \$90, list at about \$\d+\./);
    expect(shopInsightLines(shopStats(sampleData)).length).toBeGreaterThan(0);
    expect(priceBandSentence(priceBands(sampleData))).toMatch(/^Profit per week listed is highest for/);
  });

  it('typeByMonthFor filters by department', () => {
    const months = chartMonths(SAMPLE_TODAY);
    const all = typeByMonthFor(sampleData, months);
    const kids = typeByMonthFor(sampleData, months, 'Kids');
    expect(kids.rows.reduce((a, r) => a + r.total, 0)).toBeLessThanOrEqual(all.rows.reduce((a, r) => a + r.total, 0));
    expect(all.max).toBeGreaterThanOrEqual(1);
  });

  it('homeAlerts counts to-post and missing cost', () => {
    const d = emptyData({
      items: [item('a', { status: 'sold', cost: 5 }), item('b', { cost: null, status: 'listed' })],
      orders: [order('o1', 'a', '2026-11-10', 30)],
    });
    const a = homeAlerts(d);
    expect(a.toPost.count).toBe(1);
    expect(a.missingCost).toEqual({ count: 1, firstId: 'b' });
  });

  it('heatColor scales opacity', () => {
    expect(heatColor(0, 4)).toBe('transparent');
    expect(heatColor(4, 4)).toBe('rgba(46,107,94,0.75)');
  });

  it('shortShopName drops The', () => {
    expect(shortShopName('The Salvos Surry Hills')).toBe('Salvos');
  });
});

describe('what-if helpers', () => {
  it('parses amounts', () => {
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('$12,50')).toBe(12.5);
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount('-3')).toBe(0);
  });

  it('runs three scenarios and marks one best', () => {
    const d = emptyData();
    const res = runWhatIf({ cost: 10, adRate: null }, defaultInputs({ firstListPrice: 60 }), d.settings);
    expect(res).toHaveLength(3);
    expect(res.filter((r) => r.best)).toHaveLength(1);
    expect(res[1].postageCharged).toBe(0);
  });

  it('copes with no item and zero prices', () => {
    const d = emptyData();
    const res = runWhatIf(undefined, { a: '', b: '', c: '', flat: '' }, d.settings);
    expect(res.every((r) => Number.isFinite(r.keep))).toBe(true);
  });
});
