import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { EmptyState, Screen, TabStrip } from '@/components';
import { useBusinessData } from '@/data';
import { storageFor } from '@/domain';
import { colors } from '@/theme';
import { pageStyle } from './layout';
import { displayName } from './listing';
import { DetailsTab, ListingTab, PurchaseTab } from './ItemTabs';
import { PhotoCarousel } from './PhotoCarousel';
import { SaleTab, ShippingTab } from '@/features/sales';

type Tab = 'details' | 'purchase' | 'listing' | 'sale' | 'shipping';
const TABS: { value: Tab; label: string }[] = [
  { value: 'details', label: 'Details' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'listing', label: 'Listing' },
  { value: 'sale', label: 'Sale' },
  { value: 'shipping', label: 'Shipping' },
];

export function ItemDetail({ id }: { id: string }) {
  const { data, isLoading } = useBusinessData();
  const [tab, setTab] = useState<Tab>('details');
  const item = data.items.find((i) => i.id === id);

  if (!item) {
    return (
      <Screen title="Item" back backLabel="Items" bottomInset contentStyle={pageStyle}>
        <EmptyState title={isLoading ? 'Loading item' : 'Item not found'} message={isLoading ? undefined : 'It may have been deleted.'} />
      </Screen>
    );
  }

  const meta = [item.department, item.itemType, item.size ? `Size ${item.size}` : ''].filter(Boolean).join(' · ');
  return (
    <Screen
      title={item.sku}
      back
      backLabel="Items"
      bottomInset
      contentStyle={pageStyle}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit item"
          onPress={() => router.push({ pathname: '/items/[id]/edit', params: { id: item.id } })}
          style={styles.edit}
        >
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      }
    >
      <PhotoCarousel photos={item.photos} brand={item.brand || item.title} />
      <Text style={styles.name} accessibilityRole="header">
        {displayName(item)}
      </Text>
      <Text style={styles.meta}>
        {meta} · <Text style={styles.sku}>{item.sku}</Text> in {storageFor(item.sku, data.storage)}
      </Text>
      <TabStrip tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'details' ? <DetailsTab item={item} data={data} /> : null}
      {tab === 'purchase' ? <PurchaseTab item={item} data={data} /> : null}
      {tab === 'listing' ? <ListingTab item={item} data={data} /> : null}
      {tab === 'sale' ? <SaleTab itemId={item.id} /> : null}
      {tab === 'shipping' ? <ShippingTab itemId={item.id} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: '700', color: colors.ink, marginHorizontal: 2 },
  meta: { fontSize: 14, color: colors.ink2, marginHorizontal: 2, marginTop: 2, marginBottom: 12 },
  sku: { fontWeight: '700', color: colors.ink },
  edit: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  editText: { fontSize: 16, fontWeight: '600', color: colors.accent },
});
