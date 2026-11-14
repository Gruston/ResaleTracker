import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme';

export interface TabStripProps<T extends string> {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Underlined tab strip (e.g. Details / Purchase / Listing / Sale / Shipping). */
export function TabStrip<T extends string>({ tabs, value, onChange }: TabStripProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.value)}
            style={[styles.tab, on && styles.on]}
          >
            <Text style={[styles.text, on && { color: colors.accent, fontWeight: '600' }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 12 },
  tab: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  on: { borderBottomColor: colors.accent },
  text: { fontSize: 14, fontWeight: '500', color: colors.ink2 },
});
