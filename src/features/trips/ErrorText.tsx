import { StyleSheet, Text } from 'react-native';

import { colors } from '@/theme';

/** Small warm-coloured message for a failed save. Announced to screen readers. */
export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.text} accessibilityRole="alert">
      {message}
    </Text>
  );
}

export function errorMessage(e: unknown, fallback = 'That did not save. Please try again.'): string {
  return e instanceof Error && e.message ? `${fallback} (${e.message})` : fallback;
}

const styles = StyleSheet.create({
  text: { fontSize: 13, color: colors.warn, marginBottom: 10, lineHeight: 18 },
});
