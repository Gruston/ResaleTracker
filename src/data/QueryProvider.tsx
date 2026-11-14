import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';

export const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;
export const PERSIST_KEY = 'resaletracker-query-cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: SEVEN_DAYS,
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  throttleTime: 1000,
});

/** Only the business data and membership are worth keeping for offline reading (not demo data, not signed URLs). */
function shouldPersist(key: readonly unknown[]): boolean {
  if (key[0] === 'membership') return true;
  return key[0] === 'business' && key[1] !== 'demo';
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: SEVEN_DAYS,
        buster: 'v1',
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === 'success' && shouldPersist(q.queryKey),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
