import { router } from 'expo-router';

import { Progress, Row, Thumb } from '@/components';
import { Text, View } from 'react-native';
import { formatDate, formatMoney0, tripProgress } from '@/domain';
import type { Shop, Trip } from '@/domain/types';
import { colors } from '@/theme';
import { isTripDone, shopName, sortedLabel } from './helpers';

/** One trip in the list: shop, date, "X of Y sorted", progress bar, total and Done/Open. */
export function TripListRow({ trip, shops }: { trip: Trip; shops: Shop[] }) {
  const name = shopName(shops, trip.shopId);
  const { sorted, total } = tripProgress(trip);
  const done = isTripDone(trip);
  return (
    <Row
      thumb={<Thumb label={name} />}
      title={name}
      subtitle={`${formatDate(trip.tripDate)} · ${sortedLabel(trip)}`}
      badge={<Progress done={sorted} total={total} />}
      right={formatMoney0(trip.total)}
      rightSub={done ? 'Done' : 'Open'}
      onPress={() => router.push(`/trips/${trip.id}`)}
      accessibilityLabel={`${name}, ${formatDate(trip.tripDate)}, ${sortedLabel(trip)}, ${formatMoney0(trip.total)}, ${done ? 'done' : 'open'}`}
    />
  );
}

export function HelperText({ children }: { children: string }) {
  return (
    <View style={{ marginHorizontal: 4, marginBottom: 12 }}>
      <Text style={{ fontSize: 13, color: colors.ink2, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}
