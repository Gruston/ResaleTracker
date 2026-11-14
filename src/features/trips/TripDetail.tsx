import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Icon, KpiGrid, KpiTile, ListGroup, OUTCOME_LABELS, Pill, Progress, Row, Screen, SectionTitle } from '@/components';
import { tripStats, formatDate, formatMoney, formatMoney0, tripProgress } from '@/domain';
import { useBusinessData, useDeleteTrip, useSignedUrl } from '@/data';
import type { Trip, TripLine } from '@/domain/types';
import { colors, radius } from '@/theme';
import { lineHeading, perEach, pillTone, shopName, totalMismatchNote } from './helpers';
import { TripSheets, type SheetState } from './LineSheets';

/** Trip detail: receipt card, KPIs, receipt lines with outcomes, add/edit/delete. */
export function TripDetail({ id }: { id: string }) {
  const { data, isLoading, refetch } = useBusinessData();
  const del = useDeleteTrip();
  const [active, setActive] = useState<SheetState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const trip = data.trips.find((t) => t.id === id);
  const receiptUrl = useSignedUrl(trip?.receiptPath);

  if (!trip) {
    return (
      <Screen title="Trip" back backLabel="Trips">
        {isLoading ? null : <EmptyState title="Trip not found" message="It may have been deleted." action={{ label: 'Back to trips', onPress: () => router.replace('/trips') }} />}
      </Screen>
    );
  }

  const name = shopName(data.shops, trip.shopId);
  const note = totalMismatchNote(trip);
  const stats = tripStats(data, trip.id);
  const skuFor = (l: TripLine) => (l.itemId ? data.items.find((i) => i.id === l.itemId)?.sku : undefined);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const remove = async () => {
    await del.mutateAsync(trip.id);
    setActive(null);
    router.back();
  };

  return (
    <Screen
      title={name}
      back
      backLabel="Trips"
      bottomInset
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit trip"
          onPress={() => router.push({ pathname: '/trips/edit', params: { id: trip.id } })}
          style={styles.edit}
        >
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      }
    >
      <SummaryCard trip={trip} receiptUrl={receiptUrl} onReceipt={() => setActive({ kind: 'receipt' })} />
      {note ? <Text style={styles.note}>{note}</Text> : null}

      {stats ? (
        <KpiGrid>
          <KpiTile value={`${stats.itemsSold}/${stats.itemsTotal}`} label="Items sold" />
          <KpiTile value={formatMoney0(stats.earned)} label="Earned so far" />
          <KpiTile value={formatMoney0(Math.abs(stats.net))} label={stats.net >= 0 ? 'Trip paid off' : 'To earn back'} tone={stats.net >= 0 ? 'good' : 'warn'} />
        </KpiGrid>
      ) : null}

      <SectionTitle>Receipt lines · tap to set an outcome</SectionTitle>
      {trip.lines.length ? (
        <ListGroup>
          {trip.lines.map((l) => (
            <LineRow key={l.id} line={l} sku={skuFor(l)} onPress={() => setActive({ kind: 'outcome', lineId: l.id })} />
          ))}
        </ListGroup>
      ) : (
        <Card>
          <Text style={styles.muted}>No lines yet. Add what is on the receipt so each piece gets an outcome.</Text>
        </Card>
      )}
      <Button label="+ Add a line" variant="secondary" onPress={() => setActive({ kind: 'addLine' })} />
      <Button label="Delete trip" variant="danger" onPress={() => setActive({ kind: 'deleteTrip' })} style={{ marginTop: 14 }} />

      <TripSheets trip={trip} active={active} setActive={setActive} onDeleteTrip={remove} receiptUrl={receiptUrl} />
    </Screen>
  );
}

function SummaryCard({ trip, receiptUrl, onReceipt }: { trip: Trip; receiptUrl: string | null; onReceipt: () => void }) {
  const { sorted, total } = tripProgress(trip);
  return (
    <Card style={styles.summary}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={receiptUrl ? 'View receipt photo' : 'No receipt photo'}
        disabled={!receiptUrl}
        onPress={onReceipt}
        style={styles.receipt}
      >
        {receiptUrl ? (
          <Image source={{ uri: receiptUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
        ) : (
          <>
            <Icon name="trips" size={22} color={colors.ink2} />
            <Text style={styles.receiptText}>Receipt</Text>
          </>
        )}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.date}>{formatDate(trip.tripDate)}</Text>
        <Text style={styles.muted}>
          Total paid {formatMoney(trip.total)} · {trip.lines.length} {trip.lines.length === 1 ? 'line' : 'lines'}
        </Text>
        <Progress done={sorted} total={total} />
        <Text style={[styles.muted, { marginTop: 4 }]}>
          {sorted} of {total} sorted
        </Text>
      </View>
    </Card>
  );
}

function LineRow({ line, sku, onPress }: { line: TripLine; sku?: string; onPress: () => void }) {
  const tone = pillTone(line.outcome);
  const extra = [line.qty > 1 ? `${formatMoney(perEach(line))} each` : null, sku ?? null].filter(Boolean).join(' · ');
  return (
    <Row
      title={lineHeading(line)}
      badge={
        <View style={styles.badge}>
          <Pill status={tone} label={OUTCOME_LABELS[line.outcome]} />
          {extra ? <Text style={styles.extra}>{extra}</Text> : null}
        </View>
      }
      right={formatMoney(line.price)}
      onPress={onPress}
      accessibilityLabel={`${lineHeading(line)}, ${OUTCOME_LABELS[line.outcome]}${extra ? `, ${extra}` : ''}, ${formatMoney(line.price)}. Set an outcome`}
    />
  );
}

const styles = StyleSheet.create({
  edit: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  editText: { fontSize: 16, color: colors.accent, fontWeight: '600' },
  summary: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  receipt: {
    width: 64,
    height: 84,
    borderRadius: radius.control,
    backgroundColor: '#EFEBE5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  receiptText: { fontSize: 11, color: colors.ink2, fontWeight: '500' },
  date: { fontSize: 16, fontWeight: '600', color: colors.ink },
  muted: { fontSize: 13, color: colors.ink2, lineHeight: 18 },
  note: { fontSize: 13, color: colors.ink2, marginHorizontal: 4, marginTop: -4, marginBottom: 12, lineHeight: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  extra: { fontSize: 13, color: colors.ink2 },
});
