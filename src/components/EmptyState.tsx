import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action ? <Button label={action.label} onPress={action.onPress} size="small" style={{ marginTop: 14, alignSelf: 'center' }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  message: { fontSize: 14, color: colors.ink2, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
