import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { Icon, type IconName } from './Icon';

export const TAB_BAR_HEIGHT = 56;

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  trips: { label: 'Trips', icon: 'trips' },
  items: { label: 'Items', icon: 'items' },
  insights: { label: 'Insights', icon: 'insights' },
  more: { label: 'More', icon: 'more' },
};

/** Bottom tab bar in the prototype's style: stroke icons, small labels, accent colour when selected. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const color = focused ? colors.accent : '#8A847C';
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.tab}
          >
            <Icon name={tab.icon} size={22} color={color} />
            <Text style={[styles.label, { color }, focused && { fontWeight: '600' }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: TAB_BAR_HEIGHT },
  label: { fontSize: 11 },
});
