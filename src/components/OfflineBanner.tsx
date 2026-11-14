import { useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dismissFailedChanges, useQueueStatus } from '@/data/offline';
import { describeQueue } from '@/data/offlineLogic';
import { isDemoMode } from '@/lib/demo';
import { colors } from '@/theme';

/** Small strip under the header: "Offline – 3 changes waiting", "Saving 2 changes…", or "1 change could not be saved". */
export function OfflineBanner() {
  const qc = useQueryClient();
  const status = useQueueStatus();
  if (isDemoMode) return null;
  const info = describeQueue(status);
  if (!info) return null;
  const problem = info.tone === 'problem';
  return (
    <View
      style={[styles.banner, problem ? styles.problem : styles.notice]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, problem ? styles.problemText : styles.noticeText]}>{info.text}</Text>
      {problem ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => dismissFailedChanges(qc)}
          style={styles.dismiss}
        >
          <Text style={styles.problemText}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notice: { backgroundColor: colors.accentSoft },
  problem: { backgroundColor: colors.warnSoft },
  text: { flex: 1, fontSize: 13, fontWeight: '600' },
  noticeText: { color: colors.accent },
  problemText: { color: colors.warn, fontSize: 13, fontWeight: '600' },
  dismiss: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
});
