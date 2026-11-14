// Shared types. Mirror supabase/migrations/*_init.sql (snake_case columns -> camelCase here).
// The data layer (src/data) maps rows <-> these types. Money values are numbers in AUD dollars.

export type Department = 'Women' | 'Men' | 'Kids';
export type ItemStatus = 'draft' | 'listed' | 'sold' | 'posted' | 'returned' | 'faulty';
export type LineOutcome = 'to_list' | 'listed' | 'family' | 'keeping' | 'faulty';
export type ShopKind = 'shop' | 'online' | 'wardrobe';
export type Channel = 'ebay' | 'depop' | 'other';
export type ReturnOutcome = 'pending' | 'relisted' | 'thrown_out';
export type ExpenseCategory = 'Packaging' | 'Stationery' | 'Printer and labels' | 'eBay fees' | 'Other';
export type AdFeeBase = 'item' | 'item_plus_postage';

export interface Settings {
  businessId: string;
  protectionFixed: number; // $
  protectionPct: number; // % of item + postage
  defaultAdRate: number; // %
  adFeeBase: AdFeeBase;
  defaultLabelCost: number; // $
}

export interface SkuCode {
  kind: 'department' | 'item_type';
  label: string; // 'Women' | 'Dress'
  code: string; // 'W' | 'D'
  sort: number;
}

export interface StorageLocation {
  prefix: string; // 'WD' or department letter 'M'
  location: string;
}

export interface Shop {
  id: string;
  name: string;
  kind: ShopKind;
  archived: boolean;
}

export interface TripLine {
  id: string;
  tripId: string;
  description: string;
  qty: number;
  price: number; // line total
  outcome: LineOutcome;
  itemId: string | null;
  sort: number;
}

export interface Trip {
  id: string;
  shopId: string | null;
  tripDate: string; // YYYY-MM-DD
  total: number;
  receiptPath: string | null;
  notes: string | null;
  lines: TripLine[];
}

export interface ItemPhoto {
  id: string;
  path: string;
  sort: number;
}

export interface Item {
  id: string;
  sku: string;
  skuPrefix: string;
  skuNumber: number;
  title: string;
  brand: string;
  department: Department;
  itemType: string;
  size: string;
  description: string;
  shopId: string | null;
  tripId: string | null;
  tripLineId: string | null;
  purchaseDate: string | null;
  cost: number | null; // null = unknown, 0 = own wardrobe
  onlineOrderNo: string | null;
  status: ItemStatus;
  listedDate: string | null;
  firstListPrice: number | null;
  adRate: number | null;
  channel: Channel;
  ebayListingId: string | null;
  photos: ItemPhoto[];
}

export interface OrderItem {
  itemId: string;
  salePrice: number;
  allocPostage: number;
  allocProtection: number;
  adFee: number;
  allocTotal: number; // item's share of orderTotal
}

export interface Order {
  id: string;
  channel: Channel;
  orderNo: string | null;
  soldDate: string;
  orderTotal: number; // buyer paid all-in, whole order
  buyerProtection: number;
  postage: number;
  trackingNo: string | null;
  postedDate: string | null;
  postageReceiptPath: string | null;
  items: OrderItem[];
}

export interface Return {
  id: string;
  itemId: string;
  orderId: string | null;
  returnDate: string;
  refundAmount: number;
  reason: string | null;
  outcome: ReturnOutcome;
}

export interface Expense {
  id: string;
  expenseDate: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  receiptPath: string | null;
}

/** Everything the app loads for one business. Volumes are small (hundreds to low thousands of rows). */
export interface BusinessData {
  settings: Settings;
  skuCodes: SkuCode[];
  storage: StorageLocation[];
  shops: Shop[];
  trips: Trip[];
  items: Item[];
  orders: Order[];
  returns: Return[];
  expenses: Expense[];
}
