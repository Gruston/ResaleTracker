// Small builders for domain tests (not used by the app).
import { allocateOrder } from './orders';
import type { BusinessData, Expense, Item, Order, Return, Settings, Trip, TripLine } from './types';

export const settings: Settings = {
  businessId: 'b1',
  protectionFixed: 0.3,
  defaultAdRate: 3,
  adFeeBase: 'item',
  defaultLabelCost: 12.5,
};

export function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id, sku: `WD-${id}`, skuPrefix: 'WD', skuNumber: 1, title: `Item ${id}`, brand: 'Brand', department: 'Women',
    itemType: 'Dress', size: '10', description: '', shopId: null, tripId: null, tripLineId: null, purchaseDate: null,
    cost: 10, onlineOrderNo: null, status: 'listed', listedDate: '2026-10-01', firstListPrice: 50, adRate: 3,
    channel: 'ebay', ebayListingId: null, photos: [], ...over,
  };
}

/** Single-item order. Postage 12.50 and protection 0.75 + 5% unless overridden. */
export function order(id: string, itemId: string, soldDate: string, salePrice: number, over: Partial<Order> = {}, adRate = 3): Order {
  const postage = over.postage ?? 12.5;
  const buyerProtection = over.buyerProtection ?? Math.round((0.75 + 0.05 * (salePrice + postage)) * 100) / 100;
  const orderTotal = over.orderTotal ?? Math.round((salePrice + postage + buyerProtection) * 100) / 100;
  return {
    id, channel: 'ebay', orderNo: null, soldDate, orderTotal, buyerProtection, postage, trackingNo: null,
    postedDate: null, postageReceiptPath: null,
    items: allocateOrder({ orderTotal, buyerProtection, postage, items: [{ itemId, salePrice, adRate }] }, settings),
    ...over,
  };
}

export function ret(id: string, itemId: string, over: Partial<Return> = {}): Return {
  return { id, itemId, orderId: null, returnDate: '2026-11-01', refundAmount: 0, reason: null, outcome: 'pending', ...over };
}

export function line(id: string, over: Partial<TripLine> = {}): TripLine {
  return { id, tripId: 't1', description: 'Thing', qty: 1, price: 5, outcome: 'to_list', itemId: null, sort: 0, ...over };
}

export function trip(id: string, over: Partial<Trip> = {}): Trip {
  return { id, shopId: null, tripDate: '2026-10-01', total: 0, receiptPath: null, notes: null, lines: [], ...over };
}

export function expense(id: string, expenseDate: string, amount: number): Expense {
  return { id, expenseDate, description: 'x', category: 'Packaging', amount, receiptPath: null };
}

export function data(over: Partial<BusinessData> = {}): BusinessData {
  return { settings, skuCodes: [], storage: [], shops: [], trips: [], items: [], orders: [], returns: [], expenses: [], ...over };
}
