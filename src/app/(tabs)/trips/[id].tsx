import { useLocalSearchParams } from 'expo-router';

import { TripDetail } from '@/features/trips';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TripDetail id={id} />;
}
