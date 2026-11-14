import type { BusinessData, Channel, ItemStatus, Order, Return, Settings } from '@/domain/types';
import { supabase } from '@/lib/supabase';
import { todayISO } from '@/lib/today';
import { uuid } from '@/lib/uuid';
import { allocateOrder } from '../domain';
import { orderItemToRow, orderPatchToRow, orderToRow, returnToRow } from '../mappers';
import { check, useBizMutation } from './helpers';

export interface RecordSaleInput {
  orderNo?: string | null;
  soldDate: string; // YYYY-MM-DD
  /** What the buyer paid all-in for the whole order. */
  orderTotal: number;
  buyerProtection: number;
  postage: number;
  items: { itemId: string; salePrice: number }[];
  channel?: Channel; // default 'ebay'
}

function buildOrder(
  input: RecordSaleInput,
  data: Pick<BusinessData, 'items'> & { settings: Settings },
): Order {
  if (!input.items.length) throw new Error('Pick at least one item');
  const allocations = allocateOrder(
    {
      orderTotal: input.orderTotal,
      buyerProtection: input.buyerProtection,
      postage: input.postage,
      items: input.items.map((i) => ({
        itemId: i.itemId,
        salePrice: i.salePrice,
        adRate: data.items.find((x) => x.id === i.itemId)?.adRate ?? data.settings.defaultAdRate,
      })),
    },
    data.settings,
  );
  return {
    id: uuid(),
    channel: input.channel ?? 'ebay',
    orderNo: input.orderNo?.trim() ? input.orderNo.trim() : null,
    soldDate: input.soldDate,
    orderTotal: input.orderTotal,
    buyerProtection: input.buyerProtection,
    postage: input.postage,
    trackingNo: null,
    postedDate: null,
    postageReceiptPath: null,
    items: allocations,
  };
}

/**
 * Records a sale of one or more items as one (combined) order. Allocations (postage, protection, ad fee per item)
 * come from allocateOrder(); the items become 'sold'. Resolves with the new order.
 */
export function useRecordSale() {
  return useBizMutation<RecordSaleInput, Order>(
    async ({ businessId, data }, input) => {
      const order = buildOrder(input, data);
      const { items, ...row } = order;
      check(await supabase.from('orders').insert(orderToRow(businessId, row)));
      check(await supabase.from('order_items').insert(items.map((oi) => orderItemToRow(businessId, order.id, oi))));
      check(
        await supabase
          .from('items')
          .update({ status: 'sold' })
          .in('id', items.map((i) => i.itemId)),
      );
      return order;
    },
    (draft, input) => {
      const order = buildOrder(input, draft);
      draft.orders.unshift(order);
      for (const oi of order.items) {
        const it = draft.items.find((i) => i.id === oi.itemId);
        if (it) it.status = 'sold';
      }
      return order;
    },
  );
}

export interface MarkPostedInput {
  orderId: string;
  /** default: today */
  postedDate?: string;
  trackingNo?: string | null;
  postageReceiptPath?: string | null;
}

/** Marks an order as posted (items that are 'sold' become 'posted'); optionally saves tracking and the label receipt. */
export function useMarkPosted() {
  return useBizMutation<MarkPostedInput, void>(
    async ({ data }, input) => {
      const patch: Partial<Order> = { postedDate: input.postedDate ?? todayISO() };
      if (input.trackingNo !== undefined) patch.trackingNo = input.trackingNo;
      if (input.postageReceiptPath !== undefined) patch.postageReceiptPath = input.postageReceiptPath;
      check(await supabase.from('orders').update(orderPatchToRow(patch)).eq('id', input.orderId));
      const order = data.orders.find((o) => o.id === input.orderId);
      const ids = (order?.items ?? [])
        .map((oi) => oi.itemId)
        .filter((id) => data.items.find((i) => i.id === id)?.status === 'sold');
      if (ids.length) check(await supabase.from('items').update({ status: 'posted' }).in('id', ids));
    },
    (draft, input) => {
      const order = draft.orders.find((o) => o.id === input.orderId);
      if (!order) throw new Error('Order not found');
      order.postedDate = input.postedDate ?? todayISO();
      if (input.trackingNo !== undefined) order.trackingNo = input.trackingNo;
      if (input.postageReceiptPath !== undefined) order.postageReceiptPath = input.postageReceiptPath;
      for (const oi of order.items) {
        const it = draft.items.find((i) => i.id === oi.itemId);
        if (it && it.status === 'sold') it.status = 'posted';
      }
    },
  );
}

/** Edit order details (order number, tracking number, postage receipt photo, dates) without changing item status. */
export function useUpdateOrder() {
  return useBizMutation<
    { orderId: string; patch: Partial<Pick<Order, 'orderNo' | 'trackingNo' | 'postedDate' | 'postageReceiptPath' | 'soldDate'>> },
    void
  >(
    async (_ctx, { orderId, patch }) => {
      check(await supabase.from('orders').update(orderPatchToRow(patch)).eq('id', orderId));
    },
    (draft, { orderId, patch }) => {
      const o = draft.orders.find((x) => x.id === orderId);
      if (o) Object.assign(o, patch);
    },
  );
}

export interface RecordReturnInput {
  itemId: string;
  orderId?: string | null;
  returnDate?: string; // default today
  refundAmount: number;
  reason?: string | null;
}

function buildReturn(input: RecordReturnInput): Return {
  return {
    id: uuid(),
    itemId: input.itemId,
    orderId: input.orderId ?? null,
    returnDate: input.returnDate ?? todayISO(),
    refundAmount: input.refundAmount,
    reason: input.reason ?? null,
    outcome: 'pending',
  };
}

/** Records a return (outcome 'pending') and sets the item to 'returned'. Resolves with the return. */
export function useRecordReturn() {
  return useBizMutation<RecordReturnInput, Return>(
    async ({ businessId }, input) => {
      const ret = buildReturn(input);
      check(await supabase.from('returns').insert(returnToRow(businessId, ret)));
      check(await supabase.from('items').update({ status: 'returned' }).eq('id', input.itemId));
      return ret;
    },
    (draft, input) => {
      const ret = buildReturn(input);
      draft.returns.push(ret);
      const it = draft.items.find((i) => i.id === input.itemId);
      if (it) it.status = 'returned';
      return ret;
    },
  );
}

export interface ResolveReturnInput {
  returnId: string;
  /** 'relisted' puts the item back to 'listed'; 'thrown_out' marks it 'faulty'. */
  outcome: 'relisted' | 'thrown_out';
  /** new listed date when relisting (default today) */
  listedDate?: string;
}

/** Resolves a pending return. */
export function useResolveReturn() {
  return useBizMutation<ResolveReturnInput, void>(
    async ({ data }, { returnId, outcome, listedDate }) => {
      const ret = data.returns.find((r) => r.id === returnId);
      if (!ret) throw new Error('Return not found');
      check(await supabase.from('returns').update({ outcome }).eq('id', returnId));
      const itemPatch: { status: ItemStatus; listed_date?: string } =
        outcome === 'relisted' ? { status: 'listed', listed_date: listedDate ?? todayISO() } : { status: 'faulty' };
      check(await supabase.from('items').update(itemPatch).eq('id', ret.itemId));
    },
    (draft, { returnId, outcome, listedDate }) => {
      const ret = draft.returns.find((r) => r.id === returnId);
      if (!ret) throw new Error('Return not found');
      ret.outcome = outcome;
      const it = draft.items.find((i) => i.id === ret.itemId);
      if (it) {
        if (outcome === 'relisted') {
          it.status = 'listed';
          it.listedDate = listedDate ?? todayISO();
        } else {
          it.status = 'faulty';
        }
      }
    },
  );
}
