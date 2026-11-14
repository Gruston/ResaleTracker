import { useLocalSearchParams } from 'expo-router';

import { ItemDetail } from '@/features/items/ItemDetail';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemDetail id={id} />;
}
