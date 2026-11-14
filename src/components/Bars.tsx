import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

export interface BarItem {
  label: string;
  value: number;
  /** text shown at the right/top (default: the value) */
  display?: string;
  color?: string;
}

/** Horizontal bars: label, track, value. Scaled to the largest value (or `max`). */
export function Bars({ items, max, color = colors.accent }: { items: BarItem[]; max?: number; color?: string }) {
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  return (
    <View>
      {items.map((it) => {
        const pct = top > 0 ? Math.max(0, Math.min(100, (it.value / top) * 100)) : 0;
        return (
          <View key={it.label} style={styles.row} accessible accessibilityLabel={`${it.label}: ${it.display ?? it.value}`}>
            <Text style={styles.label} numberOfLines={1}>
              {it.label}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: it.color ?? color }]} />
            </View>
            <Text style={styles.value} numberOfLines={1}>
              {it.display ?? String(it.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export interface VBarItem {
  label: string;
  value: number;
  display?: string;
}

/** Vertical columns (e.g. profit by month). Negative values render as zero-height. */
export function VBars({ items, height = 140, color = colors.accent }: { items: VBarItem[]; height?: number; color?: string }) {
  const top = Math.max(0, ...items.map((i) => i.value));
  const plot = height - 38; // room for value + label text
  return (
    <View style={[styles.vwrap, { height }]}>
      {items.map((it) => {
        const h = top > 0 ? Math.max(it.value > 0 ? 2 : 0, (Math.max(0, it.value) / top) * plot) : 0;
        return (
          <View key={it.label} style={styles.col} accessible accessibilityLabel={`${it.label}: ${it.display ?? it.value}`}>
            <Text style={styles.vval} numberOfLines={1}>
              {it.display ?? String(it.value)}
            </Text>
            <View style={[styles.bar, { height: h, backgroundColor: color }]} />
            <Text style={styles.vlab}>{it.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 7 },
  label: { width: 96, fontSize: 13, color: colors.ink },
  track: { flex: 1, height: 16, borderRadius: 6, backgroundColor: '#EFEBE5', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  value: { width: 64, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.ink },
  vwrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 10 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', maxWidth: 44, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  vval: { fontSize: 11, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  vlab: { fontSize: 11, color: colors.ink2, marginTop: 6 },
});
