import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

export interface SubBarItem {
  label: string;
  value: number;
  /** right-hand text, e.g. "4 sold" */
  display: string;
  /** small grey line under the bar, e.g. "$120 · 12d" */
  sub?: string;
}

/** Horizontal bars like <Bars> with an optional sub-label under each bar. */
export function SubBars({ items }: { items: SubBarItem[] }) {
  const top = Math.max(0, ...items.map((i) => i.value));
  return (
    <View>
      {items.map((it) => {
        const pct = top > 0 ? Math.max(0, Math.min(100, (it.value / top) * 100)) : 0;
        return (
          <View
            key={it.label}
            style={styles.item}
            accessible
            accessibilityLabel={`${it.label}: ${it.display}${it.sub ? `, ${it.sub}` : ''}`}
          >
            <View style={styles.row}>
              <Text style={styles.label} numberOfLines={1}>
                {it.label}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.value} numberOfLines={1}>
                {it.display}
              </Text>
            </View>
            {it.sub ? <Text style={styles.sub}>{it.sub}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 96, fontSize: 13, color: colors.ink },
  track: { flex: 1, height: 16, borderRadius: 6, backgroundColor: '#EFEBE5', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: colors.accent },
  value: { width: 64, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 12, color: colors.ink2, marginLeft: 104, marginTop: 2 },
});
