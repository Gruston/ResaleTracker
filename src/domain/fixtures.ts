// Realistic sample business ported from the prototype's seed(). Used by tests and by the app's demo mode.
// Deterministic: stable string ids, no randomness, no clock. "Today" in the sample is 2026-11-14.
import { protectionFor, round2 } from './money';
import { allocateOrder } from './orders';
import { addDays } from './dates';
import { formatSku, skuPrefix } from './sku';
import type {
  BusinessData,
  Department,
  Expense,
  Item,
  ItemStatus,
  Order,
  Return,
  Settings,
  Shop,
  SkuCode,
  StorageLocation,
  Trip,
  TripLine,
} from './types';

export const SAMPLE_TODAY = '2026-11-14';
const BIZ = 'biz-sample';

const settings: Settings = {
  businessId: BIZ,
  protectionFixed: 0.3,
  defaultAdRate: 3,
  adFeeBase: 'item',
  defaultLabelCost: 12.5,
};

const skuCodes: SkuCode[] = [
  { kind: 'department', label: 'Women', code: 'W', sort: 1 },
  { kind: 'department', label: 'Men', code: 'M', sort: 2 },
  { kind: 'department', label: 'Kids', code: 'K', sort: 3 },
  { kind: 'department', label: 'Unisex', code: 'U', sort: 4 },
  ...(
    [
      ['Dress', 'DR'], ['Top', 'TO'], ['Shirt', 'SH'], ['Cardigan', 'CA'], ['Jumper', 'JU'], ['Jacket', 'JA'],
      ['Coat', 'CO'], ['Skirt', 'SK'], ['Pants', 'PA'], ['Jeans', 'JE'], ['Shoes', 'SO'], ['Bag', 'BA'],
      ['Accessory', 'AC'], ['Romper', 'RO'], ['Playsuit', 'PL'],
    ] as const
  ).map(([label, code], i): SkuCode => ({ kind: 'item_type', label, code, sort: i + 1 })),
];

const storage: StorageLocation[] = [
  ['WDR', 'Rack A · dresses, by colour'],
  ['WTO', 'Shelf 2 · tops'],
  ['WCA', 'Shelf 2 · knits'],
  ['WJU', 'Shelf 2 · knits'],
  ['WSK', 'Shelf 3 · skirts & pants'],
  ['WPA', 'Shelf 3 · skirts & pants'],
  ['WJA', 'Rack B · jackets & coats'],
  ['WCO', 'Rack B · jackets & coats'],
  ['WSO', 'Box S1 · shoes'],
  ['WBA', 'Box B1 · bags & accessories'],
  ['WAC', 'Box B1 · bags & accessories'],
  ['W', "Rack C · other women's"],
  ['M', "Shelf 5 · men's"],
  ['K', "Shelf 6 · kids'"],
  ['U', 'Shelf 7 · unisex'],
].map(([prefix, location]) => ({ prefix, location }));

const SHOP_IDS = {
  wardrobe: 'shop-wardrobe',
  vinnies: 'shop-vinnies-marrickville',
  salvos: 'shop-salvos-newtown',
  redcross: 'shop-redcross-paddington',
  glebe: 'shop-glebe-markets',
  iconic: 'shop-the-iconic',
} as const;

const shops: Shop[] = [
  { id: SHOP_IDS.wardrobe, name: 'My wardrobe', kind: 'wardrobe', archived: false },
  { id: SHOP_IDS.vinnies, name: 'Vinnies Marrickville', kind: 'shop', archived: false },
  { id: SHOP_IDS.salvos, name: 'Salvos Newtown', kind: 'shop', archived: false },
  { id: SHOP_IDS.redcross, name: 'Red Cross Paddington', kind: 'shop', archived: false },
  { id: SHOP_IDS.glebe, name: 'Glebe Markets', kind: 'shop', archived: false },
  { id: SHOP_IDS.iconic, name: 'The Iconic (online)', kind: 'online', archived: false },
];
const shopByName = (n: string | null) => shops.find((s) => s.name === n)?.id ?? null;

const TRIP_DATES: Record<string, string> = {
  T1: '2026-11-09',
  T2: '2026-11-01',
  T3: '2026-09-19',
  T4: '2026-10-03',
};

// title, brand, dept, type, size, colour, shop, cost, listed, firstListPrice, sold, salePrice, status, trip
type Row = [
  string, string, Department, string, string, string, string | null, number | null,
  string | null, number | null, string | null, number | null, ItemStatus, string?,
];
const rows: Row[] = [
  ['Wool blazer', 'Country Road', 'Women', 'Jacket', '10', 'Black', 'My wardrobe', 0, '2026-03-02', 60, '2026-03-10', 55, 'posted'],
  ['Leather crossbody bag', 'Mimco', 'Women', 'Bag', 'One size', 'Tan', 'My wardrobe', 0, '2026-03-05', 90, '2026-03-20', 80, 'posted'],
  ['Floral maxi dress', 'Sportsgirl', 'Women', 'Dress', '10', 'Floral', 'My wardrobe', 0, '2026-04-01', 40, '2026-04-12', 38, 'posted'],
  ['Linen midi dress', 'Seed Heritage', 'Women', 'Dress', '10', 'Sage', 'Vinnies Marrickville', 22, '2026-10-05', 69, '2026-10-19', 63.4, 'posted', 'T4'],
  ['Wool cardigan', 'Country Road', 'Women', 'Cardigan', 'M', 'Oatmeal', 'Salvos Newtown', 12, '2026-06-02', 49, '2026-06-20', 45, 'posted'],
  ['Floral print dress', 'Gorman', 'Women', 'Dress', '12', 'Multi', 'Red Cross Paddington', 18, '2026-07-01', 75, '2026-07-09', 72, 'posted'],
  ['Air Max 90 sneakers', 'Nike', 'Men', 'Shoes', 'US 10', 'White', 'Glebe Markets', 30, '2026-07-15', 110, '2026-08-30', 95, 'posted'],
  ['Leather tote bag', 'Witchery', 'Women', 'Bag', 'One size', 'Black', 'Vinnies Marrickville', 25, '2026-08-03', 75, '2026-08-11', 68, 'posted'],
  ['Puffer jacket', 'Zara', 'Women', 'Jacket', 'S', 'Black', 'Salvos Newtown', 15, '2026-05-20', 59, '2026-06-15', 55, 'posted'],
  ['Kids denim jacket', 'Seed Heritage', 'Kids', 'Jacket', '6', 'Blue', 'Red Cross Paddington', 6, '2026-08-10', 29, '2026-08-24', 28, 'posted'],
  ['Linen shirt', 'Country Road', 'Men', 'Shirt', 'L', 'White', 'Vinnies Marrickville', 8, '2026-09-01', 39, '2026-09-12', 35, 'posted'],
  ['Silk slip dress', 'Aje', 'Women', 'Dress', '8', 'Champagne', 'The Iconic (online)', 140, '2026-06-10', 290, '2026-09-28', 260, 'posted'],
  ['Knit cardigan', 'Gorman', 'Women', 'Cardigan', '10', 'Mustard', 'Glebe Markets', 20, '2026-06-25', 59, '2026-07-08', 58, 'posted'],
  ['Baby romper', 'Bonds', 'Kids', 'Romper', '00', 'Grey', 'Salvos Newtown', 4, '2026-10-08', 19, '2026-10-26', 18, 'posted'],
  ['Satin midi skirt', 'Zara', 'Women', 'Skirt', 'S', 'Green', 'Red Cross Paddington', 7, '2026-10-12', 32, '2026-10-26', 30, 'posted'],
  ['Wool wrap coat', 'Witchery', 'Women', 'Coat', '10', 'Camel', 'Vinnies Marrickville', 28, '2026-05-01', 119, '2026-06-08', 110, 'posted'],
  ['Kids running shoes', 'Nike', 'Kids', 'Shoes', 'US 2', 'Pink', 'Salvos Newtown', 10, '2026-10-20', 39, '2026-11-03', 38, 'posted'],
  ['Summer sundress', 'Country Road', 'Women', 'Dress', '10', 'Blue stripe', 'Salvos Newtown', 14, '2026-10-25', 55, '2026-11-08', 52, 'sold'],
  ['Printed tee', 'Gorman', 'Women', 'Top', '12', 'White', 'Red Cross Paddington', 6, '2026-11-03', 35, '2026-11-11', 34, 'sold', 'T2'],
  ['Tailored blazer', 'Zara', 'Women', 'Jacket', 'M', 'Navy', 'Salvos Newtown', 12, '2026-09-05', 49, '2026-09-20', 45, 'returned'],
  ['Knit jumper (hole found)', 'Seed Heritage', 'Women', 'Jumper', 'S', 'Cream', 'Vinnies Marrickville', 9, null, null, null, null, 'faulty'],
  ['Silk playsuit', 'Camilla', 'Women', 'Playsuit', '10', 'Print', 'Vinnies Marrickville', 25, '2026-11-12', 90, null, null, 'listed'],
  ['Trench coat', 'Country Road', 'Women', 'Coat', '12', 'Stone', 'Vinnies Marrickville', 25, '2026-07-10', 89, null, null, 'listed'],
  ['Silk scarf', 'Gorman', 'Women', 'Accessory', 'One size', 'Floral', 'Glebe Markets', 8, '2026-09-20', 35, null, null, 'listed', 'T3'],
  ['Logo hoodie', 'Nike', 'Men', 'Jumper', 'L', 'Grey', 'Salvos Newtown', 12, '2026-11-10', 48, null, null, 'listed', 'T1'],
  ['Girls party dress', 'Seed Heritage', 'Kids', 'Dress', '8', 'Pink', 'Red Cross Paddington', 5, '2026-11-02', 24, null, null, 'listed', 'T2'],
  ['Leather heels', 'Witchery', 'Women', 'Shoes', '38', 'Tan', 'Vinnies Marrickville', 15, '2026-05-15', 65, null, null, 'listed'],
  ['Mini skirt', 'Aje', 'Women', 'Skirt', '10', 'Ivory', 'The Iconic (online)', 95, '2026-08-01', 180, null, null, 'listed'],
  ['Linen pants', 'Zara', 'Women', 'Pants', 'M', 'Khaki', 'Salvos Newtown', 10, '2026-11-10', 39, null, null, 'listed', 'T1'],
  ['501 jeans', "Levi's", 'Men', 'Jeans', '32', 'Indigo', null, null, '2026-03-01', 70, null, null, 'listed'],
  ['Merino knit', 'Country Road', 'Women', 'Jumper', 'M', 'Navy', 'Vinnies Marrickville', 11, null, 45, null, null, 'draft', 'T4'],
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const itemIdAt = (i: number) => `item-${pad2(i + 1)}`;
const itemIdByTitle = (t: string) => itemIdAt(rows.findIndex((r) => r[0] === t));

const counters: Record<string, number> = {};
const items: Item[] = rows.map((r, i) => {
  const [title, brand, department, itemType, size, colour, shop, cost, listed, first, , , status, trip] = r;
  const prefix = skuPrefix(department, itemType, skuCodes);
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  const sold = r[10] != null;
  const adRate = title === 'Linen midi dress' ? 5.4 : title === 'Silk playsuit' ? 3 : [3, 2, 5, 3][i % 4];
  return {
    id: itemIdAt(i),
    sku: formatSku(prefix, counters[prefix]),
    skuPrefix: prefix,
    skuNumber: counters[prefix],
    title,
    brand,
    department,
    itemType,
    size,
    description: `${brand} ${title.toLowerCase()} in ${colour.toLowerCase()}, size ${size}. Excellent used condition with no marks or flaws. Smoke-free home. Fast postage.`,
    shopId: shopByName(shop),
    tripId: trip ? `trip-${trip.slice(1)}` : null,
    tripLineId: null, // filled below
    purchaseDate: trip ? TRIP_DATES[trip] : null,
    cost,
    onlineOrderNo: shop === 'The Iconic (online)' ? `ICN-${884200 + i}` : null,
    status,
    listedDate: listed,
    // prototype: every third sold item was first listed 25% higher
    firstListPrice: first != null && sold && i % 3 === 0 ? Math.round(first * 1.25) : first,
    adRate,
    channel: 'ebay',
    ebayListingId: null,
    photos: [],
  };
});

// ---- orders -----------------------------------------------------------------
const orders: Order[] = [];
const COMBINED = ['Satin midi skirt', 'Baby romper'];

function singleOrder(i: number): Order {
  const r = rows[i];
  const item = items[i];
  const price = r[11] as number;
  const postage = item.itemType === 'Shoes' || item.itemType === 'Coat' ? 16 : 12.5;
  const isWorkedExample = r[0] === 'Linen midi dress';
  const protection = isWorkedExample ? 6.1 : round2(protectionFor(price, postage, settings));
  const orderTotal = round2(price + postage + protection);
  const [oi] = allocateOrder(
    { orderTotal, buyerProtection: protection, postage, items: [{ itemId: item.id, salePrice: price, adRate: item.adRate as number }] },
    settings,
  );
  // worked example from the brief: ad fee $3.40 (price 63.40 -> total 82.00, earnings 60.00, profit 38.00)
  const orderItem = isWorkedExample ? { ...oi, adFee: 3.4 } : oi;
  return makeOrder(`order-${pad2(i + 1)}`, i, r[10] as string, orderTotal, protection, postage, [orderItem]);
}

function makeOrder(id: string, i: number, soldDate: string, orderTotal: number, buyerProtection: number, postage: number, oItems: Order['items'], orderNo?: string): Order {
  const posted = items[i].status === 'posted' || items[i].status === 'returned';
  return {
    id,
    channel: 'ebay',
    orderNo: orderNo ?? `26-${13800 + i * 37}-${40211 + i * 91}`,
    soldDate,
    orderTotal,
    buyerProtection,
    postage,
    trackingNo: posted ? `33LT${520000 + i * 713}01000931` : null,
    postedDate: posted ? addDays(soldDate, 2) : null,
    postageReceiptPath: null,
    items: oItems,
  };
}

rows.forEach((r, i) => {
  if (r[10] == null || COMBINED.includes(r[0])) return;
  orders.push(singleOrder(i));
});

// combined order: one buyer bought the skirt and the romper together; one label, fees split by item price
{
  const ia = rows.findIndex((r) => r[0] === COMBINED[0]);
  const ib = rows.findIndex((r) => r[0] === COMBINED[1]);
  const prices = [rows[ia][11] as number, rows[ib][11] as number];
  const postage = 12.5;
  const protection = round2(protectionFor(prices[0] + prices[1], postage, settings));
  const orderTotal = round2(prices[0] + prices[1] + postage + protection);
  const oItems = allocateOrder(
    {
      orderTotal,
      buyerProtection: protection,
      postage,
      items: [
        { itemId: items[ia].id, salePrice: prices[0], adRate: items[ia].adRate as number },
        { itemId: items[ib].id, salePrice: prices[1], adRate: items[ib].adRate as number },
      ],
    },
    settings,
  );
  orders.push(makeOrder('order-combined-1', ia, rows[ia][10] as string, orderTotal, protection, postage, oItems, '26-14250-77310'));
}
orders.sort((a, b) => a.soldDate.localeCompare(b.soldDate) || a.id.localeCompare(b.id));

// ---- returns ----------------------------------------------------------------
const blazerIdx = rows.findIndex((r) => r[0] === 'Tailored blazer');
const blazerOrder = orders.find((o) => o.items.some((x) => x.itemId === items[blazerIdx].id)) as Order;
const returns: Return[] = [
  {
    id: 'return-1',
    itemId: items[blazerIdx].id,
    orderId: blazerOrder.id,
    returnDate: '2026-10-05',
    refundAmount: blazerOrder.items[0].allocTotal,
    reason: 'Buyer said it was too small.',
    outcome: 'pending',
  },
];

// ---- trips ------------------------------------------------------------------
type L = [string, number, TripLine['outcome'], string?, number?]; // description, price, outcome, item title, qty
const tripDefs: { key: string; shop: string; total: number; lines: L[] }[] = [
  {
    key: 'T1', shop: 'Salvos Newtown', total: 79,
    lines: [
      ['Zara linen pants', 10, 'listed', 'Linen pants'],
      ['Nike hoodie', 12, 'listed', 'Logo hoodie'],
      ['Kids raincoat', 6, 'family'],
      ['Witchery belt', 8, 'keeping'],
      ['Cotton On top', 4, 'faulty'],
      ['Cotton On tops', 15, 'to_list', undefined, 3],
      ['Seed cardigan', 14, 'to_list'],
      ['Country Road skirt', 10, 'to_list'],
    ],
  },
  {
    key: 'T2', shop: 'Red Cross Paddington', total: 20,
    lines: [
      ['Seed girls dress', 5, 'listed', 'Girls party dress'],
      ['Gorman tee', 6, 'listed', 'Printed tee'],
      ['Mimco purse', 9, 'family'],
    ],
  },
  { key: 'T3', shop: 'Glebe Markets', total: 8, lines: [['Gorman silk scarf', 8, 'listed', 'Silk scarf']] },
  {
    key: 'T4', shop: 'Vinnies Marrickville', total: 33,
    lines: [
      ['Seed linen dress', 22, 'listed', 'Linen midi dress'],
      ['Country Road merino', 11, 'listed', 'Merino knit'],
    ],
  },
];

const trips: Trip[] = tripDefs.map((t) => {
  const tripId = `trip-${t.key.slice(1)}`;
  const lines: TripLine[] = t.lines.map(([description, price, outcome, itemTitle, qty], i) => {
    const id = `${tripId}-line-${i + 1}`;
    const itemId = itemTitle ? itemIdByTitle(itemTitle) : null;
    if (itemId) {
      const it = items.find((x) => x.id === itemId) as Item;
      it.tripLineId = id;
    }
    return { id, tripId, description, qty: qty ?? 1, price, outcome, itemId, sort: i };
  });
  return { id: tripId, shopId: shopByName(t.shop), tripDate: TRIP_DATES[t.key], total: t.total, receiptPath: null, notes: null, lines };
});

// ---- expenses ---------------------------------------------------------------
const expenses: Expense[] = [
  ['2026-03-04', 'Postage satchels (50 pack)', 'Packaging', 24.95],
  ['2026-03-04', 'Tissue paper', 'Packaging', 8.5],
  ['2026-06-12', 'Packing tape (3 rolls)', 'Packaging', 6],
  ['2026-08-20', 'Pens', 'Stationery', 4.5],
  ['2026-10-02', 'Postage satchels (50 pack)', 'Packaging', 24.95],
].map(([expenseDate, description, category, amount], i) => ({
  id: `expense-${i + 1}`,
  expenseDate: expenseDate as string,
  description: description as string,
  category: category as Expense['category'],
  amount: amount as number,
  receiptPath: null,
}));

/** Complete, internally consistent sample business (today = SAMPLE_TODAY, 2026-11-14). */
export const sampleData: BusinessData = {
  settings,
  skuCodes,
  storage,
  shops,
  trips,
  items,
  orders,
  returns,
  expenses,
};

