import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, QueryProvider, useBusiness, useSession } from '@/data';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Gate />
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}

/**
 * Route guarding:
 *  - not signed in            -> /sign-in
 *  - signed in, no business   -> /setup
 *  - otherwise                -> tabs
 * Demo mode (no Supabase, or EXPO_PUBLIC_DEMO=1) counts as signed in with a business.
 */
function Gate() {
  const { session, loading, demo } = useSession();
  const { businessId, isLoading } = useBusiness();

  if (loading || isLoading) {
    return (
      <View style={styles.splash} accessibilityLabel="Loading">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const signedIn = demo || !!session;
  const hasBusiness = !!businessId;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasBusiness}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasBusiness}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sale" />
        <Stack.Screen name="what-if" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
