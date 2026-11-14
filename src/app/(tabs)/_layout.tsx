import { router, useSegments } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Icon, Sheet, SheetOption, TAB_BAR_HEIGHT, TabBar } from '@/components';
import { colors } from '@/theme';

const ADD_ACTIONS = [
  { label: 'New shopping trip', subtitle: 'Log a trip and its receipt', href: '/trips/new', icon: 'trips' },
  { label: 'New item', subtitle: 'Add something to sell', href: '/items/new', icon: 'items' },
  { label: 'New expense', subtitle: 'Packaging, labels, supplies', href: '/more/expenses/new', icon: 'calc' },
] as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const [addOpen, setAddOpen] = useState(false);
  // Only on the five tab roots, not on detail or form screens: ['(tabs)'] or ['(tabs)', 'trips']
  const showFab = segments.length <= 2;

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
        <Tabs.Screen name="items" options={{ title: 'Items' }} />
        <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
        <Tabs.Screen name="more" options={{ title: 'More' }} />
      </Tabs>

      {showFab ? (
        <Fab
          accessibilityLabel="Add new"
          onPress={() => setAddOpen(true)}
          style={{ position: 'absolute', right: 16, bottom: TAB_BAR_HEIGHT + insets.bottom + 20 }}
        />
      ) : null}

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add new">
        {ADD_ACTIONS.map((a) => (
          <SheetOption
            key={a.href}
            label={a.label}
            subtitle={a.subtitle}
            icon={<Icon name={a.icon} size={22} color={colors.accent} />}
            onPress={() => {
              setAddOpen(false);
              router.push(a.href);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
