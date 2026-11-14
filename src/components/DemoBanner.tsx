import { useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { demoStore } from '@/data/demo-store';
import { isDemoMode } from '@/lib/demo';

/** Dark strip shown in demo mode (like the prototype's banner). `topInset` pads it under the status bar. */
export function DemoBanner({ topInset = 0 }: { topInset?: number }) {
  const qc = useQueryClient();
  if (!isDemoMode) return null;
  return (
    <View style={[styles.banner, { paddingTop: 6 + topInset }]}>
      <Text style={styles.text}>
        <Text style={{ fontWeight: '600' }}>Demo data</Text> · nothing is saved to the cloud
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset demo data"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={() => {
          demoStore.reset();
          void qc.invalidateQueries({ queryKey: ['business'] });
        }}
        style={styles.reset}
      >
        <Text style={styles.resetText}>Reset</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#1E1C1A',
    paddingBottom: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  text: { color: '#fff', fontSize: 12 },
  reset: { borderWidth: 1, borderColor: '#555', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  resetText: { color: '#fff', fontSize: 12 },
});
