import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, KpiGrid, KpiTile, ListGroup, Pill, Row, Screen, SectionTitle, Thumb } from '@/components';
import { useBusinessData } from '@/data';
import {
  formatDate,
  formatMoney0,
  kpisForMonth,
  monthLabel,
  monthOf,
  seasonTip,
  soldItems,
  today as todayFn,
} from '@/domain';
import { AlertRow } from '@/features/home/AlertRow';
import { fmtDays, homeAlerts, plural, seasonTipText, stockSummary } from '@/features/insights/helpers';
import { colors } from '@/theme';

export default function HomeScreen() {
  const { data, isLoading, isRefetching, refetch } = useBusinessData();
  const today = todayFn();
  const month = monthOf(today);

  const v = useMemo(() => {
    const sold = soldItems(data);
    const days = sold.map((s) => s.daysToSell).filter((d): d is number => d != null);
    return {
      kpis: kpisForMonth(data, month),
      avgDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
      tip: seasonTip(data, today),
      alerts: homeAlerts(data),
      stock: stockSummary(data),
      recent: [...sold].sort((a, b) => b.order.soldDate.localeCompare(a.order.soldDate)).slice(0, 4),
    };
  }, [data, month, today]);

  const tipText = v.tip ? seasonTipText(v.tip) : null;
  const { tripsToList, toPost, missingCost } = v.alerts;
  const nothingToDo = !tripsToList.length && !toPost.count && !missingCost.count;
  const brandNew = !isLoading && data.items.length === 0 && data.trips.length === 0;

  return (
    <Screen title="Home" refreshing={isRefetching} onRefresh={() => void refetch()}>
      <KpiGrid>
        <KpiTile value={formatMoney0(v.kpis.profit)} label={`Profit in ${monthLabel(month)}`} />
        <KpiTile value={String(v.kpis.itemsSold)} label={`Sold in ${monthLabel(month)}`} />
        <KpiTile value={v.avgDays == null ? '—' : `${fmtDays(v.avgDays)}d`} label="Avg days to sell" />
      </KpiGrid>

      {tipText ? (
        <Card tone="accent">
          <Text style={styles.tipHead} accessibilityRole="header">
            {tipText.heading}
          </Text>
          <Text style={styles.tipBody}>{tipText.body}</Text>
          <Text style={styles.tipNote}>{tipText.footnote}</Text>
        </Card>
      ) : null}

      {brandNew ? (
        <EmptyState
          title="Welcome"
          message="Log your first shopping trip from the + button. Items, sales and insights build up from there."
          action={{ label: 'New shopping trip', onPress: () => router.push('/trips/new') }}
        />
      ) : (
        <>
          <SectionTitle>Needs attention</SectionTitle>
          {tripsToList.map((t) => (
            <AlertRow
              key={t.tripId}
              count={t.count}
              title={`${t.count} receipt ${plural(t.count, 'line')} still to list`}
              subtitle={`${t.shopName} · ${formatDate(t.date)}`}
              onPress={() => router.push(`/trips/${t.tripId}`)}
            />
          ))}
          {toPost.count ? (
            <AlertRow
              count={toPost.count}
              title="Sold, waiting to post"
              subtitle={toPost.names.join(', ')}
              onPress={() => router.push('/items?filter=To%20post')}
            />
          ) : null}
          {missingCost.count && missingCost.firstId ? (
            <AlertRow
              count={missingCost.count}
              title={`${plural(missingCost.count, 'Item')} missing a cost`}
              subtitle="Add what you paid so profit is right"
              onPress={() => router.push(`/items/${missingCost.firstId}`)}
            />
          ) : null}
          {nothingToDo ? <Text style={styles.allClear}>All clear. Nothing needs your attention.</Text> : null}

          <SectionTitle>Stock</SectionTitle>
          <AlertRow
            tone="ok"
            count={v.stock.count}
            title="Listed on eBay"
            subtitle={`${formatMoney0(v.stock.cost)} spent · ${formatMoney0(v.stock.asking)} asking`}
            onPress={() => router.push('/items?filter=Listed')}
          />

          <SectionTitle>Recent sales</SectionTitle>
          {v.recent.length ? (
            <ListGroup>
              {v.recent.map((s) => (
                <Row
                  key={s.item.id}
                  thumb={<Thumb path={s.item.photos[0]?.path} label={s.item.brand || s.item.title} />}
                  title={[s.item.brand, s.item.title].filter(Boolean).join(' ')}
                  subtitle={`${s.item.sku} · ${s.item.department} ${s.item.size}`.trim()}
                  badge={<Pill status={s.item.status} />}
                  right={formatMoney0(s.profit)}
                  rightSub="profit"
                  onPress={() => router.push(`/items/${s.item.id}`)}
                />
              ))}
            </ListGroup>
          ) : (
            <View>
              <Text style={styles.allClear}>No sales yet. Your latest sales will show here.</Text>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tipHead: { fontSize: 13, fontWeight: '600', color: colors.accent },
  tipBody: { fontSize: 15, lineHeight: 22, color: colors.ink, marginTop: 4 },
  tipNote: { fontSize: 13, color: colors.ink2, marginTop: 6 },
  allClear: { fontSize: 14, color: colors.ink2, marginHorizontal: 4, marginBottom: 8 },
});
