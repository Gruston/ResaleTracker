import { useLocalSearchParams } from 'expo-router';

import { TripForm } from '@/features/trips';

export default function NewTripScreen() {
  const { camera } = useLocalSearchParams<{ camera?: string }>();
  return <TripForm autoCamera={camera === '1'} />;
}
