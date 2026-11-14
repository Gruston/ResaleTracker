import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/theme';

export interface KpiTileProps {
  value: string;
  label: string;
  onPress?: () => void;
  /** Colour the number: 'good' (accent) or 'warn'. */
  tone?: 'default' | 'good' | 'warn';
}

/** Big number with a small label. Put several in a <KpiGrid>. */
export function KpiTile({ value, label, onPress, tone = 'default' }: KpiTileProps) {
  const toneColor = tone === 'good' ? colors.accent : tone === 'warn' ? colors.warn : undefined;
  const body = (
    <>
      <Text style={[styles.value, toneColor ? { color: toneColor } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={styles.tile}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
    >
      {body}
    </Pressable>
  );
}

/** Row of equal-width KpiTiles (wraps after `columns`, default 3). */
export function KpiGrid({ children, columns = 3 }: { children: ReactNode; columns?: number }) {
  const tiles = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.grid}>
      {tiles.map((c, i) => (
        <View key={i} style={{ width: `${(100 - (columns - 1) * 2.5) / columns}%`, flexGrow: 1 }}>
          {c}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: 12,
  },
  value: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: colors.ink },
  label: { fontSize: 12, color: colors.ink2, marginTop: 2 },
});
