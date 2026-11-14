import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, type as t } from '@/theme';
import { Icon } from './Icon';

/** Small uppercase heading above a group ("Needs attention"). */
export function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={styles.section} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** Label on the left, value on the right (breakdown tables, detail pages). */
export function KV({
  label,
  value,
  total,
  muted,
  last,
}: {
  label: string;
  value: string;
  /** bold row (e.g. "eBay earnings") */
  total?: boolean;
  /** greyed value (deductions) */
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.kv, last && { borderBottomWidth: 0 }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.kvLabel, total && { fontWeight: '700', color: colors.ink }]}>{label}</Text>
      <Text style={[styles.kvValue, total && { fontWeight: '700' }, muted && { color: colors.ink2 }]}>{value}</Text>
    </View>
  );
}

/** Green callout box for insights and tips. */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <View style={styles.callout}>
      {typeof children === 'string' ? <Text style={styles.calloutText}>{children}</Text> : children}
    </View>
  );
}

/** Grey rounded search box. */
export function SearchField(props: Omit<TextInputProps, 'style'>) {
  return (
    <View style={styles.search}>
      <Icon name="search" size={18} color={colors.ink2} />
      <TextInput
        placeholderTextColor="#8A847C"
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel={props.accessibilityLabel ?? props.placeholder ?? 'Search'}
        style={styles.searchInput}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { ...t.section, marginTop: 18, marginHorizontal: 4, marginBottom: 8 },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  kvLabel: { fontSize: 15, color: colors.ink2, flexShrink: 1 },
  kvValue: { fontSize: 15, fontWeight: '500', color: colors.ink, textAlign: 'right' },
  callout: { backgroundColor: colors.accentSoft, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 },
  calloutText: { fontSize: 14, lineHeight: 20, color: colors.ink },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECE8E2',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, minHeight: 44 },
});
