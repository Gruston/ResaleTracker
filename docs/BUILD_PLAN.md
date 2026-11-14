# Build plan – Phase 2 (core app)

Requirements: "Resale Tracker – Requirements & Design Brief" (Claude Doc). Visual/behaviour reference: `docs/prototype/index.html`. Phase 2 = everything in the prototype that is not marked "Simulated" or "Phase 2", without AI and without the eBay connection. Sales are entered by hand in this phase.

## Architecture in one paragraph

On sign-in the app loads the whole business (`BusinessData` in `src/domain/types.ts`) with one query (`useBusinessData()`), persisted to AsyncStorage so it opens offline. Screens read from it and derive everything (profit, analytics) with pure functions in `src/domain/`. Writes go through mutation hooks in `src/data/` which call Supabase and then invalidate `['business', businessId]`. Data volume is small (hundreds of items), so client-side aggregation is fine.

## Contracts (wave 1 builds these; wave 2 uses them as-is)

### `src/domain/` (pure TS + Jest tests)

`money.ts`
- `round2(n)`, `formatMoney(n)` → "$1,234.56", `formatMoney0(n)` → "$1,235" / "−$12"
- `protectionFor(itemPrice, postage, s: Settings)` = fixed + pct% × (itemPrice + postage)
- `adFeeFor(itemPrice, postage, adRate, s)` uses `s.adFeeBase`
- `youGetAbout(listPrice, adRate, s)` = listPrice − ad fee (postage passes through)
- `buyerSeesAbout(listPrice, s, postage = s.defaultLabelCost)` = listPrice + protection + postage
- `ebayEarnings(oi: OrderItem)` = allocTotal − allocProtection − allocPostage − adFee
- `itemProfit(item, oi)` = ebayEarnings − (item.cost ?? 0)

`orders.ts`
- `allocateOrder(input: { orderTotal, buyerProtection, postage, items: {itemId, salePrice, adRate}[] }, s)` → `OrderItem[]`. Splits postage & protection in proportion to salePrice; ad fee per item from its adRate; `allocTotal = salePrice + allocPostage + allocProtection`. Rounding: allocate cents so the parts sum exactly to the order figures (largest-remainder). Single-item orders = no split.
- `saleForItem(data, itemId)` → `{ order, orderItem } | null` (ignores orders whose item has a return with refund)

`sku.ts`
- `skuPrefix(department, itemType, codes: SkuCode[])` → 'WD'
- `storageFor(sku, storage: StorageLocation[])` → full prefix match, else department letter, else 'Not set'
- `parseSku('WD-014')` → `{ prefix: 'WD', number: 14 }`

`lines.ts`
- `splitLine(line)` → `qty` lines of qty 1 at even price (cents remainder on the first), descriptions "X 1", "X 2"…
- `tripProgress(trip)` → `{ sorted, total }` (sorted = outcome ≠ 'to_list')

`dates.ts`
- `daysBetween(a, b)`, `today()` (Australia/Sydney), `formatDate('2026-11-14')` → "14 Nov 2026"
- `seasonOf(date)` → 'Summer' | 'Autumn' | 'Winter' | 'Spring'; `seasonMonths(season)` → "Dec–Feb" etc; `nextSeason(date)`
- `financialYearOf(date)` → 2026 for 2026-07-01..2027-06-30; `fyLabel(2026)` → "FY 2026–27"

`analytics.ts` (all take `BusinessData`; "sold" = item has an order and is not returned/faulty)
- `soldItems(data)` → `{ item, order, orderItem, profit, earnings, daysToSell }[]`
- `kpisForMonth(data, 'YYYY-MM')`, `profitByMonth(data, months[])`
- `byItemType(data, dept?)`, `bySize(data, dept)`, `typeByMonth(data, months[])`
- `discounts(data)` → avg drop % from firstListPrice to salePrice, share sold at first price, by type, suggested first price for a target; `byAdRate(data)`
- `shopStats(data)` → per shop: bought, sold, sellThroughPct, profit, profitPerDollar, avgDays, leftCount, leftCost
- `tripStats(data, tripId)` → spent, itemsSold/itemsTotal, earned, left, net
- `priceBands(data)` → under 30 / 30–80 / 80–150 / 150+: sold, avgProfit, avgDays, profitPerWeekListed
- `brandStats(data)` → sold, avgProfit, avgDays, avgBuyerPaid
- `ageing(data, today)` → buckets 0–30 / 31–90 / 91–180 / 180+: count, cost
- `businessTotals(data)` → earned, stockBought (trip totals + non-trip item costs), boughtForFamilyOrSelf, supplies, net, unsoldAtCost
- `seasonTip(data, today)` → best item type for the current/coming season or null
- `taxYear(data, fy)` → itemsSold, income, refunds, costOfSold, expenses, net, stockBought
- `whatIf(listPrice scenarios…)` → per scenario: buyerPays, protection, ad, earnings, keep

### `src/data/` (Supabase + TanStack Query)

- `QueryProvider` (with AsyncStorage persistence) and `AuthProvider` / `useSession()`
- Auth: email one-time code (`signInWithOtp` + `verifyOtp` type 'email'), no deep links.
- `useBusiness()` → current business id (first membership); if none, screen to create one (`create_business` RPC, name "Kat's Resale").
- `useBusinessData()` → `{ data: BusinessData, isLoading, refetch }`
- Mutations (each invalidates business data): `useCreateTrip`, `useUpdateTrip`, `useDeleteTrip`, `useUpsertTripLine`, `useDeleteTripLine`, `useSplitTripLine`, `useCreateItem` (calls `next_sku` RPC, then insert; links trip line → outcome 'listed'), `useUpdateItem`, `useDeleteItem`, `useAddItemPhoto` / `useRemoveItemPhoto`, `useRecordSale` (creates order + order_items using `allocateOrder`, sets items status 'sold'), `useMarkPosted`, `useRecordReturn`, `useResolveReturn` ('relisted' → item back to 'listed' with new listedDate; 'thrown_out' → 'faulty'), `useCreateExpense` / `useDeleteExpense`, `useUpsertShop`, `useUpdateSettings`, `useUpsertSkuCode`, `useUpsertStorage`, `useAddMember`.
- `uploadImage(localUri, businessId, folder)` → storage path (compress with expo-image-manipulator to max 1600px, JPEG 0.7); `useSignedUrl(path)`.

### `src/components/` (shared UI, match the prototype)

`Screen` (safe area + scroll + large title or back header), `Card`, `ListGroup` + `Row` (thumb, title, subtitle, right value, chevron), `Pill` (status colours), `Button` (primary/secondary/small), `Field` (TextInput with label), `Select` (bottom-sheet picker), `Segmented`, `Chips`, `Sheet` (modal bottom sheet), `KpiTile`, `Bars` (horizontal bars), `VBars` (monthly columns), `MoneyBar` (stacked bar + legend), `Progress`, `EmptyState`, `Icon` (home, trips, items, insights, more, chev, back, search, camera, calc, plus), `Thumb` (photo or brand initials), `Fab`.

## Tasks and file ownership

Wave 1 (parallel):
- **T1 Domain** – owns `src/domain/**` (except `types.ts`, which is fixed: propose changes in report) and `src/domain/__tests__/**`. Thorough tests, including the prototype's worked example: cost $22, buyer paid $82, protection $6.10, postage $12.50, ad $3.40 → earnings $60, profit $38.
- **T2 Shell + data + components** – owns `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/sign-in.tsx`, `src/app/setup.tsx`, `src/data/**`, `src/components/**`, `src/lib/**`. Tab bar: Home, Trips, Items, Insights, More, plus a floating + button (sheet: New trip, New item, New expense). Placeholder screens for each tab. Add a `src/data/mock.ts` with the prototype's sample data as `BusinessData`, used when `EXPO_PUBLIC_DEMO=1` or Supabase is not configured, so screens can be developed and demoed without a backend.

Wave 2 (parallel, after wave 1 merged):
- **T3 Trips** – `src/app/(tabs)/trips/**`, `src/features/trips/**`: list with progress, trip detail (receipt photo, KPIs from `tripStats`, lines, outcome sheet, split line, add/edit line, create item from line), new trip form (shop picker with add-new, date, total, receipt photo).
- **T4 Items** – `src/app/(tabs)/items/**`, `src/features/items/**`: list (search across title/brand/SKU/type/size/shop/order no/tracking; status chips; item-type select; sort A–Z/Newest/Price/Longest listed), item detail with tabs Details/Purchase/Listing/Sale/Shipping (Sale and Shipping tab bodies come from T5 components: import `SaleTab`, `ShippingTab` from `src/features/sales`), add/edit item (photos, dept, type, size, brand, shop incl. My wardrobe → cost 0, cost, title, description, listing price + ad rate with live You get about / Buyer sees about, date listed), SKU shown with storage location.
- **T5 Sales** – `src/features/sales/**`, `src/app/sale/**`: record sale (one or more items → combined order; order total, buyer protection, postage, per-item sale price), `SaleTab` (combined-order note with links, MoneyBar, breakdown table, return card with Relist / Damaged throw out), `ShippingTab` (tracking, mark posted, postage receipt photo), record return.
- **T6 Insights + Home** – `src/app/(tabs)/index.tsx`, `src/app/(tabs)/insights/**`, `src/app/what-if.tsx`, `src/features/insights/**`: Home (KPIs, season tip, needs attention, stock, recent sales), Insights tabs Overview (business totals) / What sells / Discounts / Shops & brands (incl. trips) / Price bands / Stock, pricing what-if.
- **T7 More** – `src/app/(tabs)/more/**`, `src/features/more/**`: shops, SKU codes and storage (editable), fee settings, expenses (list, by category, add with receipt photo), tax-year report + CSV export (expo-file-system + expo-sharing), export everything CSV, load history from CSV (eBay Seller Hub orders report or simple template; column mapping preview; creates items/orders), sharing (add Damon by email), sign out.

Wave 3: orchestrator review, integration fixes, full typecheck/tests/bundle, push.
