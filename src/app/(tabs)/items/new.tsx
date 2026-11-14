import { useLocalSearchParams } from 'expo-router';

import { ItemForm, type ItemFormParams } from '@/features/items/ItemForm';

export default function NewItemScreen() {
  const params = useLocalSearchParams<Record<keyof ItemFormParams, string>>();
  return <ItemForm params={params} />;
}
