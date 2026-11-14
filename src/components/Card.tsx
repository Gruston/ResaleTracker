import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

export interface CardProps {
  children: ReactNode;
  /** 'accent' = soft green callout card without a border */
  tone?: 'default' | 'accent';
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, tone = 'default', style }: CardProps) {
  return <View style={[styles.card, tone === 'accent' && styles.accent, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  accent: { backgroundColor: colors.accentSoft, borderColor: 'transparent' },
});
