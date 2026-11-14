import { useLocalSearchParams } from 'expo-router';

import { RecordSaleScreen } from '@/features/sales';

export default function NewSaleRoute() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  return <RecordSaleScreen itemId={itemId ?? ''} />;
}
