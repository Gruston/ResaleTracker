import { adFeeFor, round2 } from './money';
import type { BusinessData, Order, OrderItem, Return, Settings } from './types';

export interface AllocateOrderInput {
  /** What the buyer paid all-in for the whole order. */
  orderTotal: number;
  buyerProtection: number;
  postage: number;
  items: { itemId: string; salePrice: number; adRate: number }[];
}

/**
 * Split `totalCents` across weights using largest remainder so the parts sum exactly.
 * All-zero weights split evenly.
 */
export function allocateCents(totalCents: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const neg = totalCents < 0;
  const total = Math.abs(totalCents);
  const w = weights.reduce((a, b) => a + b, 0) > 0 ? weights : weights.map(() => 1);
  const wsum = w.reduce((a, b) => a + b, 0);
  const exact = w.map((x) => (total * x) / wsum);
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, r: e - Math.floor(e) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k].i] += 1;
  return floors.map((c) => (neg ? -c : c) / 100);
}

/**
 * Turn one order into per-item allocations. Postage and buyer protection are split in proportion to sale price
 * (cents by largest remainder, so parts sum exactly); ad fee per item is adRate% of the sale price (or price +
 * its postage share when settings.adFeeBase = 'item_plus_postage'); allocTotal = price + postage + protection.
 */
export function allocateOrder(input: AllocateOrderInput, s: Settings): OrderItem[] {
  const prices = input.items.map((i) => Math.round(i.salePrice * 100));
  const postage = allocateCents(Math.round(input.postage * 100), prices);
  const protection = allocateCents(Math.round(input.buyerProtection * 100), prices);
  return input.items.map((it, k) => {
    const salePrice = prices[k] / 100;
    return {
      itemId: it.itemId,
      salePrice,
      allocPostage: postage[k],
      allocProtection: protection[k],
      adFee: round2(adFeeFor(salePrice, postage[k], it.adRate, s)),
      allocTotal: round2(salePrice + postage[k] + protection[k]),
    };
  });
}

export interface ItemSale {
  order: Order;
  orderItem: OrderItem;
}

function returnCancelsOrder(r: Return, order: Order): boolean {
  if (r.outcome !== 'relisted') return false;
  return r.orderId != null ? r.orderId === order.id : order.soldDate <= r.returnDate;
}

/** Pick the live sale from an item's candidate orders: drop orders undone by a relisted return, take the latest. */
export function pickSale(candidates: ItemSale[], itemReturns: Return[]): ItemSale | null {
  let best: ItemSale | null = null;
  for (const c of candidates) {
    if (itemReturns.some((r) => returnCancelsOrder(r, c.order))) continue;
    if (!best || c.order.soldDate >= best.order.soldDate) best = c;
  }
  return best;
}

/** Group every order line by item id (internal helper for analytics; one pass over the data). */
export function salesByItem(data: Pick<BusinessData, 'orders' | 'returns'>): Map<string, ItemSale> {
  const cands = new Map<string, ItemSale[]>();
  for (const order of data.orders) {
    for (const orderItem of order.items) {
      const list = cands.get(orderItem.itemId) ?? [];
      list.push({ order, orderItem });
      cands.set(orderItem.itemId, list);
    }
  }
  const out = new Map<string, ItemSale>();
  for (const [id, list] of cands) {
    const pick = pickSale(list, data.returns.filter((r) => r.itemId === id));
    if (pick) out.set(id, pick);
  }
  return out;
}

/**
 * The live sale of an item: its latest order, ignoring orders that were undone by a return with outcome
 * 'relisted'. Returned/faulty items still resolve here (so the Sale tab can show the return); `soldItems`
 * applies the status rule.
 */
export function saleForItem(data: Pick<BusinessData, 'orders' | 'returns'>, itemId: string): ItemSale | null {
  const cands: ItemSale[] = [];
  for (const order of data.orders) {
    const orderItem = order.items.find((i) => i.itemId === itemId);
    if (orderItem) cands.push({ order, orderItem });
  }
  return pickSale(cands, data.returns.filter((r) => r.itemId === itemId));
}
