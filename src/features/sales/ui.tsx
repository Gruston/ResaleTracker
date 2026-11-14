import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components';
import { colors } from '@/theme';

/** A breakdown row whose value is coloured (used for "Your profit"). */
export function AccentKV({ label, value, color = colors.accent, last }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
}

/** Shown while the business data has not loaded, or when the item cannot be found. */
export function ItemGate({ loading, missing }: { loading: boolean; missing: boolean }) {
  if (loading) {
    return (
      <View style={styles.loading} accessibilityLabel="Loading">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (missing) return <EmptyState title="Item not found" message="It may have been deleted. Go back and pick it again." />;
  return null;
}

/** Bold title line used inside cards. */
export function CardTitle({ children }: { children: string }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  label: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  value: { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  loading: { paddingVertical: 40, alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
