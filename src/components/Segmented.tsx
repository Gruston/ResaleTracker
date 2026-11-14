import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme';

export interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** iOS-style segmented control (grey track, white selected segment). */
export function Segmented<T extends string | number>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.track}
      contentContainerStyle={styles.content}
      accessibilityRole="tablist"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.seg, on && styles.on]}
          >
            <Text style={[styles.text, on && { fontWeight: '600' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: '#ECE8E2', borderRadius: 10, marginBottom: 12, flexGrow: 0 },
  content: { padding: 3, gap: 2, flexGrow: 1 },
  seg: { flex: 1, minHeight: 38, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  on: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  text: { fontSize: 13, fontWeight: '500', color: colors.ink },
});
