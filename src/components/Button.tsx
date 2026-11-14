import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  /** 'small' = 40pt tall, content width */
  size?: 'normal' | 'small';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'normal',
  loading,
  disabled,
  icon,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const off = disabled || loading;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? '#9B2C2C' : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'small' ? styles.small : styles.normal,
        variant === 'primary' && { backgroundColor: colors.accent },
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        pressed && { opacity: 0.8 },
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <View>{icon}</View> : null}
      <Text style={[styles.text, { color: fg }, size === 'small' && { fontSize: 14 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12 },
  normal: { minHeight: 48, alignSelf: 'stretch', marginBottom: 10 },
  small: { minHeight: 44, paddingHorizontal: 14, alignSelf: 'flex-start' },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.card, borderWidth: 1, borderColor: '#E9C9C9' },
  text: { fontSize: 16, fontWeight: '600' },
});
