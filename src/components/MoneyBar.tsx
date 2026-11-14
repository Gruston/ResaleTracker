import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

export interface MoneySegment {
  label: string;
  value: number;
  color: string;
  /** legend text, e.g. "Postage $12.50" (default: label) */
  display?: string;
}

/** Stacked bar showing where a sale's money went, with a legend. */
export function MoneyBar({ segments }: { segments: MoneySegment[] }) {
  const shown = segments.filter((s) => s.value > 0);
  return (
    <View>
      <View style={styles.bar} accessible accessibilityLabel={segments.map((s) => s.display ?? s.label).join(', ')}>
        {shown.map((s) => (
          <View key={s.label} style={{ flex: s.value, backgroundColor: s.color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.display ?? s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 28, borderRadius: 8, overflow: 'hidden', marginTop: 10, marginBottom: 8, backgroundColor: '#EFEBE5' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 10, height: 10, borderRadius: 3, marginRight: 5 },
  legendText: { fontSize: 12, color: colors.ink2 },
});
