import { useLocalSearchParams } from 'expo-router';

import { EmptyState, Screen } from '@/components';
import { useBusinessData } from '@/data';
import { TripForm } from '@/features/trips';

export default function EditTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useBusinessData();
  const trip = data.trips.find((t) => t.id === id);
  if (!trip) {
    return (
      <Screen title="Edit trip" back backLabel="Back">
        <EmptyState title="Trip not found" />
      </Screen>
    );
  }
  return <TripForm trip={trip} />;
}
