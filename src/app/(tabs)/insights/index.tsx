import { router } from 'expo-router';
import { useState } from 'react';

import { Button, EmptyState, Icon, Screen, TabStrip } from '@/components';
import { useBusinessData } from '@/data';
import { today as todayFn } from '@/domain';
import {
  DiscountsTab,
  OverviewTab,
  PriceBandsTab,
  ShopsBrandsTab,
  StockTab,
  WhatSellsTab,
} from '@/features/insights';
import { colors } from '@/theme';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'sells', label: 'What sells' },
  { value: 'discounts', label: 'Discounts' },
  { value: 'shops', label: 'Shops & brands' },
  { value: 'bands', label: 'Price bands' },
  { value: 'stock', label: 'Stock' },
] as const;

type TabKey = (typeof TABS)[number]['value'];

export default function InsightsScreen() {
  const { data, isLoading, isRefetching, refetch } = useBusinessData();
  const [tab, setTab] = useState<TabKey>('overview');
  const today = todayFn();
  const empty = !isLoading && data.items.length === 0 && data.trips.length === 0 && data.orders.length === 0;

  return (
    <Screen
      title="Insights"
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
      right={
        <Button
          label="What-if"
          size="small"
          variant="secondary"
          accessibilityLabel="Pricing what-if"
          icon={<Icon name="calc" size={18} color={colors.accent} />}
          onPress={() => router.push('/what-if')}
        />
      }
    >
      <TabStrip tabs={[...TABS]} value={tab} onChange={setTab} />
      {empty ? (
        <EmptyState
          title="Nothing to analyse yet"
          message="Add a shopping trip and record your first sale. Your insights will build up here."
        />
      ) : tab === 'overview' ? (
        <OverviewTab data={data} today={today} />
      ) : tab === 'sells' ? (
        <WhatSellsTab data={data} today={today} />
      ) : tab === 'discounts' ? (
        <DiscountsTab data={data} today={today} />
      ) : tab === 'shops' ? (
        <ShopsBrandsTab data={data} today={today} />
      ) : tab === 'bands' ? (
        <PriceBandsTab data={data} today={today} />
      ) : (
        <StockTab data={data} today={today} />
      )}
    </Screen>
  );
}
