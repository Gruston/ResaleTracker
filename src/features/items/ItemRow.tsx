import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, Pill, STATUS_LABELS, Thumb } from '@/components';
import { formatMoney0 } from '@/domain';
import { colors, radius } from '@/theme';
import { displayName, rowRight, rowSubtitle, type ListEntry } from './listing';

export interface ItemRowProps {
  entry: ListEntry;
  today: string;
  first: boolean;
  last: boolean;
  onPress: (id: string) => void;
}

/** One line in the items list: thumb, "Brand Title", "SKU · Dept Size · pill", profit or price. */
export const ItemRow = memo(function ItemRow({ entry, today, first, last, onPress }: ItemRowProps) {
  const { item } = entry;
  const right = rowRight(entry, today, formatMoney0);
  const name = displayName(item);
  const sub = rowSubtitle(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, sub, STATUS_LABELS[item.status] ?? item.status, right ? `${right.value} ${right.sub}` : '']
        .filter(Boolean)
        .join(', ')}
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [
        styles.row,
        first && styles.first,
        last && styles.last,
        !first && styles.divider,
        pressed && { backgroundColor: '#F3F0EB' },
      ]}
    >
      <Thumb path={item.photos[0]?.path} label={item.brand || item.title} />
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.subRow}>
          <Text style={styles.sub} numberOfLines={1}>
            {sub} ·{' '}
          </Text>
          <Pill status={item.status} />
        </View>
      </View>
      {right ? (
        <View style={styles.right}>
          <Text style={[styles.value, right.profit && right.value.startsWith('−') && { color: colors.warn }]}>{right.value}</Text>
          <Text style={styles.rightSub}>{right.sub}</Text>
        </View>
      ) : null}
      <Icon name="chev" size={18} color="#B5AFA7" />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 64,
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.line,
  },
  first: { borderTopWidth: 1, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  sub: { fontSize: 13, color: colors.ink2, flexShrink: 1 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  value: { fontSize: 14, fontWeight: '600', color: colors.ink },
  rightSub: { fontSize: 12, color: colors.ink2 },
});
