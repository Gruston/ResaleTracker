// Row (snake_case, from Supabase) <-> domain (camelCase) mappers.
import type {
  AdFeeBase,
  Channel,
  Department,
  Expense,
  ExpenseCategory,
  Item,
  ItemPhoto,
  ItemStatus,
  LineOutcome,
  Order,
  OrderItem,
  Return,
  ReturnOutcome,
  Settings,
  Shop,
  ShopKind,
  SkuCode,
  StorageLocation,
  Trip,
  TripLine,
} from '@/domain/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

/** numeric columns usually arrive as numbers, but tolerate strings. */
export function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function numOrNull(v: unknown): number | null {
  return v === null || v === undefined || v === '' ? null : num(v);
}
function strOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

export function settingsFromRow(r: Row): Settings {
  return {
    businessId: r.business_id,
    protectionFixed: num(r.protection_fixed, 0.75),
    protectionPct: num(r.protection_pct, 5),
    defaultAdRate: num(r.default_ad_rate, 3),
    adFeeBase: (r.ad_fee_base ?? 'item') as AdFeeBase,
    defaultLabelCost: num(r.default_label_cost, 12.5),
  };
}
export function settingsToRow(s: Partial<Settings>): Row {
  const out: Row = {};
  if (s.protectionFixed !== undefined) out.protection_fixed = s.protectionFixed;
  if (s.protectionPct !== undefined) out.protection_pct = s.protectionPct;
  if (s.defaultAdRate !== undefined) out.default_ad_rate = s.defaultAdRate;
  if (s.adFeeBase !== undefined) out.ad_fee_base = s.adFeeBase;
  if (s.defaultLabelCost !== undefined) out.default_label_cost = s.defaultLabelCost;
  return out;
}

export function skuCodeFromRow(r: Row): SkuCode {
  return { kind: r.kind, label: r.label, code: r.code, sort: num(r.sort) };
}
export function skuCodeToRow(businessId: string, c: SkuCode): Row {
  return { business_id: businessId, kind: c.kind, label: c.label, code: c.code, sort: c.sort };
}

export function storageFromRow(r: Row): StorageLocation {
  return { prefix: r.prefix, location: r.location };
}
export function storageToRow(businessId: string, s: StorageLocation): Row {
  return { business_id: businessId, prefix: s.prefix, location: s.location };
}

export function shopFromRow(r: Row): Shop {
  return { id: r.id, name: r.name, kind: (r.kind ?? 'shop') as ShopKind, archived: !!r.archived };
}
export function shopToRow(businessId: string, s: Shop): Row {
  return { id: s.id, business_id: businessId, name: s.name, kind: s.kind, archived: s.archived };
}

export function tripLineFromRow(r: Row): TripLine {
  return {
    id: r.id,
    tripId: r.trip_id,
    description: r.description ?? '',
    qty: num(r.qty, 1),
    price: num(r.price),
    outcome: (r.outcome ?? 'to_list') as LineOutcome,
    itemId: strOrNull(r.item_id),
    sort: num(r.sort),
  };
}
export function tripLineToRow(businessId: string, l: TripLine): Row {
  return {
    id: l.id,
    business_id: businessId,
    trip_id: l.tripId,
    description: l.description,
    qty: l.qty,
    price: l.price,
    outcome: l.outcome,
    item_id: l.itemId,
    sort: l.sort,
  };
}

export function tripFromRow(r: Row, lines: TripLine[]): Trip {
  return {
    id: r.id,
    shopId: strOrNull(r.shop_id),
    tripDate: r.trip_date,
    total: num(r.total),
    receiptPath: strOrNull(r.receipt_path),
    notes: strOrNull(r.notes),
    lines: [...lines].sort((a, b) => a.sort - b.sort),
  };
}
export function tripToRow(businessId: string, t: Omit<Trip, 'lines'>): Row {
  return {
    id: t.id,
    business_id: businessId,
    shop_id: t.shopId,
    trip_date: t.tripDate,
    total: t.total,
    receipt_path: t.receiptPath,
    notes: t.notes,
  };
}

export function itemPhotoFromRow(r: Row): ItemPhoto {
  return { id: r.id, path: r.path, sort: num(r.sort) };
}

export function itemFromRow(r: Row, photos: ItemPhoto[]): Item {
  return {
    id: r.id,
    sku: r.sku,
    skuPrefix: r.sku_prefix,
    skuNumber: num(r.sku_number),
    title: r.title ?? '',
    brand: r.brand ?? '',
    department: r.department as Department,
    itemType: r.item_type,
    size: r.size ?? '',
    description: r.description ?? '',
    shopId: strOrNull(r.shop_id),
    tripId: strOrNull(r.trip_id),
    tripLineId: strOrNull(r.trip_line_id),
    purchaseDate: strOrNull(r.purchase_date),
    cost: numOrNull(r.cost),
    onlineOrderNo: strOrNull(r.online_order_no),
    status: (r.status ?? 'draft') as ItemStatus,
    listedDate: strOrNull(r.listed_date),
    firstListPrice: numOrNull(r.first_list_price),
    adRate: numOrNull(r.ad_rate),
    channel: (r.channel ?? 'ebay') as Channel,
    ebayListingId: strOrNull(r.ebay_listing_id),
    photos: [...photos].sort((a, b) => a.sort - b.sort),
  };
}
/** Full row for an insert (photos are stored separately). */
export function itemToRow(businessId: string, i: Omit<Item, 'photos'>): Row {
  return {
    id: i.id,
    business_id: businessId,
    sku: i.sku,
    sku_prefix: i.skuPrefix,
    sku_number: i.skuNumber,
    ...itemPatchToRow(i),
  };
}
/** Partial row for an update. Only keys present in the patch are emitted. */
export function itemPatchToRow(p: Partial<Omit<Item, 'photos' | 'id'>>): Row {
  const out: Row = {};
  if (p.title !== undefined) out.title = p.title;
  if (p.brand !== undefined) out.brand = p.brand;
  if (p.department !== undefined) out.department = p.department;
  if (p.itemType !== undefined) out.item_type = p.itemType;
  if (p.size !== undefined) out.size = p.size;
  if (p.description !== undefined) out.description = p.description;
  if (p.shopId !== undefined) out.shop_id = p.shopId;
  if (p.tripId !== undefined) out.trip_id = p.tripId;
  if (p.tripLineId !== undefined) out.trip_line_id = p.tripLineId;
  if (p.purchaseDate !== undefined) out.purchase_date = p.purchaseDate;
  if (p.cost !== undefined) out.cost = p.cost;
  if (p.onlineOrderNo !== undefined) out.online_order_no = p.onlineOrderNo;
  if (p.status !== undefined) out.status = p.status;
  if (p.listedDate !== undefined) out.listed_date = p.listedDate;
  if (p.firstListPrice !== undefined) out.first_list_price = p.firstListPrice;
  if (p.adRate !== undefined) out.ad_rate = p.adRate;
  if (p.channel !== undefined) out.channel = p.channel;
  if (p.ebayListingId !== undefined) out.ebay_listing_id = p.ebayListingId;
  return out;
}

export function orderItemFromRow(r: Row): OrderItem {
  return {
    itemId: r.item_id,
    salePrice: num(r.sale_price),
    allocPostage: num(r.alloc_postage),
    allocProtection: num(r.alloc_protection),
    adFee: num(r.ad_fee),
    allocTotal: num(r.alloc_total),
  };
}
export function orderItemToRow(businessId: string, orderId: string, oi: OrderItem): Row {
  return {
    order_id: orderId,
    item_id: oi.itemId,
    business_id: businessId,
    sale_price: oi.salePrice,
    alloc_postage: oi.allocPostage,
    alloc_protection: oi.allocProtection,
    ad_fee: oi.adFee,
    alloc_total: oi.allocTotal,
  };
}

export function orderFromRow(r: Row, items: OrderItem[]): Order {
  return {
    id: r.id,
    channel: (r.channel ?? 'ebay') as Channel,
    orderNo: strOrNull(r.order_no),
    soldDate: r.sold_date,
    orderTotal: num(r.order_total),
    buyerProtection: num(r.buyer_protection),
    postage: num(r.postage),
    trackingNo: strOrNull(r.tracking_no),
    postedDate: strOrNull(r.posted_date),
    postageReceiptPath: strOrNull(r.postage_receipt_path),
    items,
  };
}
export function orderToRow(businessId: string, o: Omit<Order, 'items'>): Row {
  return {
    id: o.id,
    business_id: businessId,
    channel: o.channel,
    order_no: o.orderNo,
    sold_date: o.soldDate,
    order_total: o.orderTotal,
    buyer_protection: o.buyerProtection,
    postage: o.postage,
    tracking_no: o.trackingNo,
    posted_date: o.postedDate,
    postage_receipt_path: o.postageReceiptPath,
  };
}
export function orderPatchToRow(p: Partial<Omit<Order, 'id' | 'items'>>): Row {
  const out: Row = {};
  if (p.channel !== undefined) out.channel = p.channel;
  if (p.orderNo !== undefined) out.order_no = p.orderNo;
  if (p.soldDate !== undefined) out.sold_date = p.soldDate;
  if (p.orderTotal !== undefined) out.order_total = p.orderTotal;
  if (p.buyerProtection !== undefined) out.buyer_protection = p.buyerProtection;
  if (p.postage !== undefined) out.postage = p.postage;
  if (p.trackingNo !== undefined) out.tracking_no = p.trackingNo;
  if (p.postedDate !== undefined) out.posted_date = p.postedDate;
  if (p.postageReceiptPath !== undefined) out.postage_receipt_path = p.postageReceiptPath;
  return out;
}

export function returnFromRow(r: Row): Return {
  return {
    id: r.id,
    itemId: r.item_id,
    orderId: strOrNull(r.order_id),
    returnDate: r.return_date,
    refundAmount: num(r.refund_amount),
    reason: strOrNull(r.reason),
    outcome: (r.outcome ?? 'pending') as ReturnOutcome,
  };
}
export function returnToRow(businessId: string, r: Return): Row {
  return {
    id: r.id,
    business_id: businessId,
    item_id: r.itemId,
    order_id: r.orderId,
    return_date: r.returnDate,
    refund_amount: r.refundAmount,
    reason: r.reason,
    outcome: r.outcome,
  };
}

export function expenseFromRow(r: Row): Expense {
  return {
    id: r.id,
    expenseDate: r.expense_date,
    description: r.description ?? '',
    category: (r.category ?? 'Other') as ExpenseCategory,
    amount: num(r.amount),
    receiptPath: strOrNull(r.receipt_path),
  };
}
export function expenseToRow(businessId: string, e: Expense): Row {
  return {
    id: e.id,
    business_id: businessId,
    expense_date: e.expenseDate,
    description: e.description,
    category: e.category,
    amount: e.amount,
    receipt_path: e.receiptPath,
  };
}
