import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Bars, Callout, Card, Chips, KV, KpiGrid, KpiTile, ListGroup, Row, SectionTitle, Thumb, VBars } from '@/components';
import {
  ageing,
  bySize,
  brandStats,
  businessTotals,
  byAdRate,
  byItemType,
  discounts,
  formatMoney,
  formatMoney0,
  priceBands,
  profitByMonth,
  shopStats,
  soldItems,
  sumMoney,
  tripStats,
  formatDate,
  daysBetween,
  type BusinessData,
  type Department,
} from '@/domain';
import { colors, type as t } from '@/theme';
import { HeatGrid } from './HeatGrid';
import {
  ageLabel,
  bestTypeSentence,
  chartMonths,
  discountSentence,
  fmtDays,
  fmtPct,
  plural,
  priceBandSentence,
  shopInsightLines,
  shortShopName,
  typeByMonthFor,
  type Dept,
} from './helpers';
import { SubBars } from './SubBars';
import { Table } from './Table';

export interface TabProps {
  data: BusinessData;
  today: string;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function CardTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={t.title} accessibilityRole="header">
        {title}
      </Text>
      {sub ? <Text style={t.label}>{sub}</Text> : null}
    </View>
  );
}

function Note({ children }: { children: string }) {
  return <Text style={styles.note}>{children}</Text>;
}

function Empty({ children }: { children: string }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const signed = (n: number) => (n < 0 ? `−${formatMoney0(Math.abs(n))}` : formatMoney0(n));

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function OverviewTab({ data, today }: TabProps) {
  const v = useMemo(() => {
    const sold = soldItems(data);
    const wardrobeIds = new Set(data.shops.filter((s) => s.kind === 'wardrobe').map((s) => s.id));
    const own = sold.filter((s) => s.item.shopId != null && wardrobeIds.has(s.item.shopId));
    const lost = data.items.filter((i) => i.status === 'faulty' || i.status === 'returned');
    return {
      sold,
      totals: businessTotals(data),
      buyerPaid: sumMoney(sold.map((s) => s.orderItem.allocTotal)),
      earnings: sumMoney(sold.map((s) => s.earnings)),
      profit: sumMoney(sold.map((s) => s.profit)),
      avgDays: mean(sold.map((s) => s.daysToSell).filter((d): d is number => d != null)),
      avgBuyer: mean(sold.map((s) => s.orderItem.allocTotal)),
      avgProfit: mean(sold.map((s) => s.profit)),
      ownCount: own.length,
      ownProfit: sumMoney(own.map((s) => s.profit)),
      lostCount: lost.length,
      lostCost: sumMoney(lost.map((i) => i.cost ?? 0)),
      months: profitByMonth(data, chartMonths(today)),
    };
  }, [data, today]);
  const n = v.totals.net;
  const has = v.sold.length > 0;
  return (
    <>
      <Card>
        <Text style={t.title} accessibilityRole="header">
          Business totals, all time
        </Text>
        <View style={{ marginTop: 6 }}>
          <KV label="Earned from eBay" value={formatMoney(v.totals.earned)} />
          <KV label="− Stock bought" value={formatMoney(v.totals.stockBought)} muted />
          <View style={{ paddingLeft: 12 }}>
            <KV label="incl. bought for family or yourself" value={formatMoney(v.totals.boughtForFamilyOrSelf)} muted />
          </View>
          <KV label="− Supplies and expenses" value={formatMoney(v.totals.supplies)} muted />
          <KV label="Money in minus money out" value={formatMoney(n)} total />
          <KV label="Unsold stock held (at cost)" value={formatMoney(v.totals.unsoldAtCost)} last />
        </View>
        <Note>Use these to check the investment against your bank app.</Note>
      </Card>
      <KpiGrid>
        <KpiTile value={formatMoney0(v.buyerPaid)} label="Buyers paid" />
        <KpiTile value={formatMoney0(v.earnings)} label="eBay earnings" />
        <KpiTile value={signed(v.profit)} label="Profit" />
      </KpiGrid>
      <Card>
        <CardTitle title="Profit by month" />
        <VBars
          items={v.months.map((m) => ({ label: m.label, value: m.profit, display: formatMoney0(m.profit) }))}
        />
      </Card>
      <Card>
        <KV label="Items sold" value={String(v.sold.length)} />
        <KV label="Average days to sell" value={fmtDays(v.avgDays)} />
        <KV label="Average buyer all-in price" value={v.avgBuyer == null ? '—' : formatMoney(v.avgBuyer)} />
        <KV label="Average profit per item" value={v.avgProfit == null ? '—' : formatMoney(v.avgProfit)} />
        <KV label="Sold from your own wardrobe" value={`${v.ownCount} · ${formatMoney0(v.ownProfit)} profit`} />
        <KV label="Returns and faulty" value={`${v.lostCount} · ${formatMoney(v.lostCost)} cost`} last />
      </Card>
      {!has ? <Empty>No sales yet. Once you record a sale, your results appear here.</Empty> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// What sells
// ---------------------------------------------------------------------------

const DEPT_OPTIONS: { value: Dept; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Women', label: 'Women' },
  { value: 'Men', label: 'Men' },
  { value: 'Kids', label: 'Kids' },
  { value: 'Unisex', label: 'Unisex' },
];

export function WhatSellsTab({ data, today }: TabProps) {
  const [dept, setDept] = useState<Dept>('All');
  const d: Department | undefined = dept === 'All' ? undefined : dept;
  const types = useMemo(() => byItemType(data, d), [data, d]);
  const sizes = useMemo(() => {
    const depts: Department[] = d ? [d] : ['Women', 'Men', 'Kids', 'Unisex'];
    return depts.map((x) => ({ dept: x, sizes: bySize(data, x) })).filter((x) => x.sizes.length);
  }, [data, d]);
  const heat = useMemo(() => typeByMonthFor(data, chartMonths(today), d), [data, today, d]);
  const sentence = bestTypeSentence(types, dept);
  return (
    <>
      <Chips options={DEPT_OPTIONS} value={dept} onChange={setDept} />
      {sentence ? <Callout>{sentence}</Callout> : null}
      <Card>
        <CardTitle title="Best-selling item types" sub="Number sold · profit · avg days to sell" />
        {types.length ? (
          <SubBars
            items={types.map((x) => ({
              label: x.itemType,
              value: x.sold,
              display: `${x.sold} sold`,
              sub: `${formatMoney0(x.profit)} · ${fmtDays(x.avgDaysToSell)}d`,
            }))}
          />
        ) : (
          <Empty>No sales yet.</Empty>
        )}
      </Card>
      {sizes.map((s) => (
        <Card key={s.dept}>
          <CardTitle title={`Best-selling sizes · ${s.dept}`} />
          <Bars items={s.sizes.map((z) => ({ label: z.size, value: z.sold, display: `${z.sold} sold` }))} />
        </Card>
      ))}
      <Card>
        <CardTitle title="What sells when" sub="Items sold by month · Winter Jun–Aug, Spring Sep–Nov" />
        {heat.rows.length ? <HeatGrid data={heat} /> : <Empty>No sales in the last nine months.</Empty>}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

export function DiscountsTab({ data }: TabProps) {
  const disc = useMemo(() => discounts(data), [data]);
  const ads = useMemo(() => byAdRate(data), [data]);
  const sentence = discountSentence(disc);
  const has = disc.count > 0;
  return (
    <>
      <KpiGrid>
        <KpiTile value={has ? fmtPct(disc.avgDropPct) : '—'} label="Avg drop from first price" />
        <KpiTile value={has ? fmtPct(disc.soldAtFirstPricePct) : '—'} label="Sold at first price" />
        <KpiTile value={has ? `${disc.avgAdRate.toFixed(1)}%` : '—'} label="Avg ad rate" />
      </KpiGrid>
      {sentence ? (
        <Callout>{sentence}</Callout>
      ) : (
        <Callout>Once you have sold items with a first listing price, you will see how far you usually drop.</Callout>
      )}
      <Card>
        <CardTitle title="By item type" />
        <Table
          columns={[
            { label: 'Type' },
            { label: 'Sold', numeric: true, width: 52 },
            { label: 'First price', numeric: true },
            { label: 'Sold for', numeric: true },
            { label: 'Drop', numeric: true, width: 56 },
          ]}
          rows={disc.byType.map((r) => [
            r.itemType,
            String(r.sold),
            formatMoney0(r.avgFirstPrice),
            formatMoney0(r.avgSalePrice),
            fmtPct(r.avgDropPct),
          ])}
          empty="No sales with a first price yet."
        />
      </Card>
      <Card>
        <CardTitle title="Do higher ad rates sell faster?" />
        <Table
          columns={[
            { label: 'Ad rate' },
            { label: 'Sold', numeric: true, width: 52 },
            { label: 'Avg days to sell', numeric: true, width: 100 },
            { label: 'Avg ad cost', numeric: true },
          ]}
          rows={ads.map((r) => [r.label, String(r.sold), fmtDays(r.avgDaysToSell), formatMoney(r.avgAdFee)])}
          empty="No sales yet."
        />
        <Note>Small samples can mislead. With more sales this shows whether a higher ad rate is worth it.</Note>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shops & brands
// ---------------------------------------------------------------------------

export function ShopsBrandsTab({ data }: TabProps) {
  const v = useMemo(() => {
    const shops = shopStats(data);
    const shopName = (id: string | null) => data.shops.find((s) => s.id === id)?.name ?? 'Trip';
    const trips = data.trips
      .map((tr) => ({ trip: tr, stats: tripStats(data, tr.id) }))
      .filter((x): x is { trip: (typeof data.trips)[number]; stats: NonNullable<ReturnType<typeof tripStats>> } => x.stats != null)
      .sort((a, b) => b.stats.net - a.stats.net || b.trip.tripDate.localeCompare(a.trip.tripDate))
      .map(({ trip, stats }) => ({ label: `${shortShopName(shopName(trip.shopId))} · ${shortDate(formatDate(trip.tripDate))}`, stats }));
    return { shops, trips, brands: brandStats(data) };
  }, [data]);
  const lines = shopInsightLines(v.shops);
  const left = [...v.shops].filter((s) => s.leftCount > 0).sort((a, b) => b.leftCount - a.leftCount || b.leftCost - a.leftCost);
  return (
    <>
      {lines.length ? (
        <Callout>
          <View style={{ gap: 4 }}>
            {lines.map((l) => (
              <Text key={l} style={styles.calloutText}>
                {l}
              </Text>
            ))}
          </View>
        </Callout>
      ) : null}
      <Card>
        <CardTitle title="Is this shop worth going to?" sub="Sell-through = share of items bought there that have sold" />
        <Table
          columns={[
            { label: 'Shop', width: 110 },
            { label: 'Bought', numeric: true, width: 60 },
            { label: 'Sell-through', numeric: true, width: 84 },
            { label: 'Profit', numeric: true },
            { label: 'Per $1', numeric: true, width: 64 },
            { label: 'Days', numeric: true, width: 52 },
          ]}
          rows={v.shops
            .filter((s) => s.bought > 0)
            .map((s) => [
              s.name,
              String(s.bought),
              fmtPct(s.sellThroughPct),
              formatMoney0(s.profit),
              formatMoney(s.profitPerDollar),
              s.sold ? fmtDays(s.avgDays) : '—',
            ])}
          empty="No items bought from shops yet."
        />
      </Card>
      <Card>
        <CardTitle title="Unsold stock by shop" />
        {left.length ? (
          <SubBars
            items={left.map((s) => ({
              label: shortShopName(s.name),
              value: s.leftCount,
              display: `${s.leftCount} ${plural(s.leftCount, 'item')}`,
              sub: `${formatMoney0(s.leftCost)} tied up`,
            }))}
          />
        ) : (
          <Empty>No unsold stock.</Empty>
        )}
      </Card>
      <Card>
        <CardTitle title="Best shopping trips" />
        <Table
          columns={[
            { label: 'Trip', width: 120 },
            { label: 'Spent', numeric: true },
            { label: 'Earned', numeric: true },
            { label: 'Left', numeric: true, width: 52 },
          ]}
          rows={v.trips.map((r) => [r.label, formatMoney0(r.stats.spent), formatMoney0(r.stats.earned), String(r.stats.left)])}
          empty="No shopping trips yet."
        />
      </Card>
      <Card>
        <CardTitle title="Brands" />
        <Table
          columns={[
            { label: 'Brand', width: 110 },
            { label: 'Sold', numeric: true, width: 52 },
            { label: 'Avg profit', numeric: true },
            { label: 'Avg days', numeric: true, width: 64 },
            { label: 'Buyer paid', numeric: true },
          ]}
          rows={v.brands.map((b) => [b.brand, String(b.sold), formatMoney0(b.avgProfit), fmtDays(b.avgDays), formatMoney0(b.avgBuyerPaid)])}
          empty="No sales yet."
        />
        <Note>"Buyer paid" is the average all-in total, a guide to what buyers will pay.</Note>
      </Card>
    </>
  );
}

/** "14 Nov 2026" -> "14 Nov". */
function shortDate(formatted: string): string {
  return formatted.replace(/\s\d{4}$/, '');
}

// ---------------------------------------------------------------------------
// Price bands
// ---------------------------------------------------------------------------

export function PriceBandsTab({ data }: TabProps) {
  const bands = useMemo(() => priceBands(data), [data]);
  const sentence = priceBandSentence(bands);
  return (
    <>
      {sentence ? <Callout>{sentence}</Callout> : <Callout>Once you have sales, you will see which price range works hardest for you.</Callout>}
      <Card>
        <Table
          columns={[
            { label: 'Sale price' },
            { label: 'Sold', numeric: true, width: 52 },
            { label: 'Avg profit', numeric: true },
            { label: 'Avg days', numeric: true, width: 64 },
            { label: 'Profit / week listed', numeric: true, width: 104 },
          ]}
          rows={bands.map((b) => [
            b.label,
            String(b.sold),
            b.sold ? formatMoney0(b.avgProfit) : '—',
            b.sold ? fmtDays(b.avgDays) : '—',
            b.sold && b.avgDays != null ? formatMoney(b.profitPerWeekListed) : '—',
          ])}
        />
      </Card>
      <Note>
        Profit per week listed = average profit ÷ weeks it took to sell. It compares how hard each price range works for you.
      </Note>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export function StockTab({ data, today }: TabProps) {
  const v = useMemo(() => {
    const buckets = ageing(data, today);
    const listed = data.items
      .filter((i) => i.status === 'listed')
      .sort((a, b) => (a.listedDate ?? '9999').localeCompare(b.listedDate ?? '9999'))
      .slice(0, 5);
    return { buckets, listed };
  }, [data, today]);
  const total = v.buckets.reduce((a, b) => a + b.count, 0);
  return (
    <>
      <Card>
        <CardTitle title="Unsold stock by time listed" />
        {total ? (
          <SubBars
            items={v.buckets.map((b) => ({
              label: ageLabel(b),
              value: b.count,
              display: `${b.count} ${plural(b.count, 'item')}`,
              sub: `${formatMoney0(b.cost)} tied up`,
            }))}
          />
        ) : (
          <Empty>No unsold stock.</Empty>
        )}
      </Card>
      <SectionTitle>Listed longest</SectionTitle>
      {v.listed.length ? (
        <ListGroup>
          {v.listed.map((i) => (
            <Row
              key={i.id}
              thumb={<Thumb path={i.photos[0]?.path} label={i.brand || i.title} />}
              title={[i.brand, i.title].filter(Boolean).join(' ')}
              subtitle={`${i.sku} · ${i.department} ${i.size}`.trim()}
              right={i.firstListPrice != null ? formatMoney0(i.firstListPrice) : undefined}
              rightSub={i.listedDate ? `${Math.max(0, daysBetween(i.listedDate, today))} days` : 'not listed'}
              onPress={() => router.push(`/items/${i.id}`)}
            />
          ))}
        </ListGroup>
      ) : (
        <Empty>Nothing is listed yet.</Empty>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 13, color: colors.ink2, lineHeight: 18, marginTop: 8, marginHorizontal: 2 },
  empty: { fontSize: 14, color: colors.ink2, textAlign: 'center', paddingVertical: 10 },
  sub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  calloutText: { fontSize: 14, lineHeight: 20, color: colors.ink },
});
