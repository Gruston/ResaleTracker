import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radius } from '@/theme';

export interface ChipsProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Horizontally scrolling filter chips; the selected chip is dark. */
export function Chips<T extends string | number>({ options, value, onChange }: ChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.chip, on && styles.on]}
          >
            <Text style={[styles.text, on && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 10 },
  content: { gap: 8, paddingBottom: 4 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.ink, borderColor: colors.ink },
  text: { fontSize: 14, color: colors.ink },
});
