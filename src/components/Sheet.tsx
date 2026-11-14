import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Modal bottom sheet: dimmed backdrop (tap to close) and a panel that slides up. */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={styles.fill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: height * 0.85,
              paddingBottom: 20 + insets.bottom,
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.grab} />
          {title ? (
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A tappable option row for use inside a Sheet (52pt tall, bordered). */
export function SheetOption({
  label,
  subtitle,
  selected,
  onPress,
  icon,
}: {
  label: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.opt,
        selected && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={styles.optText}>{label}</Text>
        {subtitle ? <Text style={styles.optSub}>{subtitle}</Text> : null}
      </View>
      {selected ? <Text style={{ color: colors.accent, fontWeight: '700' }}>Selected</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  grab: { width: 40, height: 5, borderRadius: 99, backgroundColor: '#D5CFC7', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 8,
  },
  optText: { fontSize: 15, color: colors.ink },
  optSub: { fontSize: 12, color: colors.ink2, marginTop: 1 },
});
