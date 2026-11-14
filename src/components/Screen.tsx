import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isDemoMode } from '@/lib/demo';
import { colors } from '@/theme';
import { DemoBanner } from './DemoBanner';
import { Icon } from './Icon';
import { OfflineBanner } from './OfflineBanner';

export interface ScreenProps {
  /** Large left-aligned title (tab roots) or, with `back`, a centred small title. */
  title?: string;
  /** Show a back button. true = router.back(); a function = custom handler. */
  back?: boolean | (() => void);
  /** Label next to the back chevron (default "Back") */
  backLabel?: string;
  /** Right side of the header (icon buttons, etc.) */
  right?: ReactNode;
  /** false = no ScrollView (e.g. you render a FlatList yourself) */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned below the content (e.g. a Save button) */
  footer?: ReactNode;
  /** Add bottom safe-area padding (pass true on screens outside the tab bar) */
  bottomInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Page frame: safe area, demo banner, large title or back header, scrolling content. */
export function Screen({
  title,
  back,
  backLabel = 'Back',
  right,
  scroll = true,
  refreshing,
  onRefresh,
  footer,
  bottomInset,
  contentStyle,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const topForHeader = isDemoMode ? 0 : insets.top;
  const onBack = typeof back === 'function' ? back : () => router.back();

  const header = back ? (
    <View style={[styles.header, { paddingTop: 4 + topForHeader }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        hitSlop={8}
        style={styles.back}
      >
        <Icon name="back" size={22} color={colors.accent} />
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <Text style={styles.smallTitle} numberOfLines={1} accessibilityRole="header">
        {title ?? ''}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  ) : title || right ? (
    <View style={[styles.header, { paddingTop: 12 + topForHeader }]}>
      <Text style={styles.largeTitle} numberOfLines={1} accessibilityRole="header">
        {title ?? ''}
      </Text>
      {right}
    </View>
  ) : (
    <View style={{ height: 8 + topForHeader }} />
  );

  // Tab-root screens (no back button) leave room for the floating + button.
  const bodyPad = { paddingBottom: 24 + (bottomInset && !footer ? insets.bottom : 0) + (back || footer ? 0 : 72) };

  return (
    <View style={styles.root}>
      <DemoBanner topInset={insets.top} />
      {header}
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.content, bodyPad, contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, styles.content, contentStyle]}>{children}</View>
        )}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: 12 + (bottomInset ? insets.bottom : 0) }]}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
  },
  largeTitle: { flex: 1, fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: colors.ink },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, minWidth: 44, paddingRight: 4, zIndex: 1 },
  backText: { fontSize: 16, color: colors.accent },
  smallTitle: {
    position: 'absolute',
    left: 80,
    right: 80,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
  },
  headerRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', zIndex: 1 },
  content: { paddingHorizontal: 16 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
