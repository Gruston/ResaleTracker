import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/** Thin progress bar. Give either `value` (0 to 1) or `done` and `total`. */
export function Progress({ value, done, total }: { value?: number; done?: number; total?: number }) {
  const ratio = value ?? (total ? (done ?? 0) / total : 0);
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, backgroundColor: '#EFEBE5', borderRadius: 99, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', backgroundColor: colors.accent },
});
