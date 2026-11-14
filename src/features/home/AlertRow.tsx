import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { colors, radius } from '@/theme';

export interface AlertRowProps {
  count: number;
  title: string;
  subtitle: string;
  tone?: 'warn' | 'ok';
  onPress: () => void;
}

/** Tappable card with a round count badge ("Needs attention" and "Stock" on Home). */
export function AlertRow({ count, title, subtitle, tone = 'warn', onPress }: AlertRowProps) {
  const ok = tone === 'ok';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.dot, { backgroundColor: ok ? colors.accentSoft : colors.warnSoft }]}>
        <Text style={[styles.dotText, { color: ok ? colors.accent : colors.warn }]}>{count}</Text>
      </View>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chev" size={18} color="#B5AFA7" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  dot: { minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontSize: 14, fontWeight: '700' },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 13, color: colors.ink2 },
});
