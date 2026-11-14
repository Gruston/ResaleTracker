/// <reference types="jest" />
import { itemPriceFromPriceWithProtection,
  adFeeFor, buyerSeesAbout, ebayEarnings, formatMoney, formatMoney0, itemProfit, protectionFor, round2, sumMoney, youGetAbout,
} from '../money';
import { item, settings } from '../testUtils';
import type { OrderItem } from '../types';

const oi = (over: Partial<OrderItem> = {}): OrderItem => ({
  itemId: 'a', salePrice: 63.4, allocPostage: 12.5, allocProtection: 6.1, adFee: 3.4, allocTotal: 82, ...over,
});

describe('round2', () => {
  it('rounds to cents, half away from zero, tolerating float noise', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(12)).toBe(12);
  });
  it('never returns negative zero', () => {
    expect(Object.is(round2(-0.001), 0)).toBe(true);
    expect(Object.is(round2(-0), 0)).toBe(true);
  });
});

describe('sumMoney', () => {
  it('sums without float drift', () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumMoney([])).toBe(0);
  });
});

describe('formatMoney', () => {
  it('uses $, grouping and 2 decimals', () => {
    expect(formatMoney(1234.56)).toBe('$1,234.56');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(1234567.5)).toBe('$1,234,567.50');
    expect(formatMoney(999.999)).toBe('$1,000.00');
  });
  it('uses U+2212 minus for negatives', () => {
    expect(formatMoney(-12.5)).toBe('−$12.50');
    expect(formatMoney(-1234.5)).toBe('−$1,234.50');
  });
  it('does not show a minus for amounts that round to zero', () => {
    expect(formatMoney(-0.004)).toBe('$0.00');
  });
});

describe('formatMoney0', () => {
  it('rounds to whole dollars', () => {
    expect(formatMoney0(1234.56)).toBe('$1,235');
    expect(formatMoney0(0.4)).toBe('$0');
    expect(formatMoney0(-12)).toBe('−$12');
    expect(formatMoney0(-0.2)).toBe('$0');
    expect(formatMoney0(1234567)).toBe('$1,234,567');
  });
});

describe('fees', () => {
  it('protectionFor = $0.30 + eBay AU tiers on the item price (postage ignored)', () => {
    expect(protectionFor(63.4, 12.5, settings)).toBeCloseTo(0.3 + 1.6 + 0.06 * 43.4, 6);
    expect(protectionFor(0, 0, settings)).toBe(0);
  });
  it("matches eBay's published examples", () => {
    // https://www.ebay.com.au/help/buying/paying-items/buyer-protection-fee?id=5594
    expect(round2(protectionFor(10, 0, settings))).toBe(1.1);
    expect(round2(protectionFor(38, 0, settings))).toBe(2.98);
    expect(round2(protectionFor(60, 0, settings))).toBe(4.3);
    expect(round2(protectionFor(2500, 0, settings))).toBe(110.7);
    expect(round2(protectionFor(7500, 0, settings))).toBe(210.7);
    expect(round2(10 + protectionFor(10, 0, settings))).toBe(11.1);
    expect(round2(38 + protectionFor(38, 0, settings))).toBe(40.98);
  });
  it('itemPriceFromPriceWithProtection inverts price + protection', () => {
    expect(round2(itemPriceFromPriceWithProtection(40.98, settings))).toBe(38);
    expect(round2(itemPriceFromPriceWithProtection(2610.7, settings))).toBe(2500);
  });
  it('adFeeFor uses the item price by default', () => {
    expect(adFeeFor(100, 12.5, 3, settings)).toBeCloseTo(3, 10);
  });
  it('adFeeFor includes postage when adFeeBase = item_plus_postage', () => {
    expect(adFeeFor(100, 10, 5, { ...settings, adFeeBase: 'item_plus_postage' })).toBeCloseTo(5.5, 10);
  });
  it('adFeeFor with 0% or $0 price is 0', () => {
    expect(adFeeFor(50, 12.5, 0, settings)).toBe(0);
    expect(adFeeFor(0, 0, 5, settings)).toBe(0);
  });
  it('youGetAbout = list price minus ad fee', () => {
    expect(youGetAbout(100, 3, settings)).toBeCloseTo(97, 10);
    expect(youGetAbout(100, 5, { ...settings, adFeeBase: 'item_plus_postage' })).toBeCloseTo(100 - 5.625, 10);
  });
  it('buyerSeesAbout = price + protection + postage (default label cost)', () => {
    // 60 + (0.30 + 8% x 20 + 6% x 40) + 12.5
    expect(buyerSeesAbout(60, settings)).toBeCloseTo(60 + 4.3 + 12.5, 10);
    expect(buyerSeesAbout(60, settings, 0)).toBeCloseTo(60 + 4.3, 10);
  });
});

describe('earnings and profit', () => {
  it('worked example: cost 22, buyer paid 82, protection 6.10, postage 12.50, ad 3.40 -> earnings 60, profit 38', () => {
    const line = oi();
    expect(ebayEarnings(line)).toBe(60);
    expect(itemProfit(item('a', { cost: 22 }), line)).toBe(38);
  });
  it('null cost counts as 0', () => {
    expect(itemProfit(item('a', { cost: null }), oi())).toBe(60);
  });
  it('own-wardrobe item (cost 0) profit equals earnings', () => {
    expect(itemProfit(item('a', { cost: 0 }), oi())).toBe(60);
  });
  it('can be negative', () => {
    expect(itemProfit(item('a', { cost: 100 }), oi())).toBe(-40);
  });
  it('zero-priced sale: earnings are negative by the fees nobody paid for', () => {
    const z = oi({ salePrice: 0, allocPostage: 0, allocProtection: 0, adFee: 0, allocTotal: 0 });
    expect(ebayEarnings(z)).toBe(0);
  });
  it('avoids float drift', () => {
    expect(ebayEarnings(oi({ allocTotal: 40.17, allocPostage: 7.81, allocProtection: 2.36, adFee: 1.5 }))).toBe(28.5);
  });
});
