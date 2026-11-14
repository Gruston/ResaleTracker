import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { monthLabel, type TypeByMonth } from '@/domain';
import { colors } from '@/theme';
import { heatColor, heatTextDark } from './helpers';

/** "What sells when": item types down, months across, cell opacity by count. */
export function HeatGrid({ data }: { data: TypeByMonth }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View accessibilityLabel="Items sold by type and month">
        <View style={styles.row}>
          <Text style={[styles.th, styles.typeCol, { textAlign: 'left' }]}>Type</Text>
          {data.months.map((m) => (
            <Text key={m} style={[styles.th, styles.cell]}>
              {monthLabel(m)}
            </Text>
          ))}
        </View>
        {data.rows.map((r) => (
          <View
            key={r.itemType}
            style={styles.row}
            accessible
            accessibilityLabel={`${r.itemType}: ${data.months.map((m, i) => `${monthLabel(m)} ${r.counts[i]}`).join(', ')}`}
          >
            <Text style={[styles.type, styles.typeCol]} numberOfLines={1}>
              {r.itemType}
            </Text>
            {r.counts.map((c, i) => (
              <View key={data.months[i]} style={[styles.cell, styles.heat, { backgroundColor: heatColor(c, data.max) }]}>
                <Text style={[styles.count, heatTextDark(c, data.max) && { color: '#fff' }]}>{c || ''}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  typeCol: { width: 92 },
  cell: { width: 40 },
  th: { fontSize: 12, fontWeight: '600', color: colors.ink2, paddingVertical: 6, textAlign: 'center' },
  type: { fontSize: 14, color: colors.ink },
  heat: { height: 34, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
