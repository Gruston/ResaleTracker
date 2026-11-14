import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Card, Chips, EmptyState, Screen, SearchField, Segmented, Select } from '@/components';
import { useBusinessData } from '@/data';
import { today } from '@/domain';
import { colors } from '@/theme';
import { ItemRow } from './ItemRow';
import { pageStyle } from './layout';
import {
  ALL_TYPES,
  SORT_OPTIONS,
  STATUS_FILTERS,
  buildEntries,
  filterEntries,
  itemTypesPresent,
  parseStatusFilter,
  sortEntries,
  type ListEntry,
  type SortKey,
  type StatusFilter,
} from './listing';

const CHIP_OPTIONS = STATUS_FILTERS.map((f) => ({ value: f, label: f }));

export function ItemsList() {
  const params = useLocalSearchParams<{ filter?: string; q?: string }>();
  const { data, isLoading, refetch, isRefetching } = useBusinessData();
  const [q, setQ] = useState(params.q ?? '');
  const [status, setStatus] = useState<StatusFilter>(parseStatusFilter(params.filter));
  const [itemType, setItemType] = useState(ALL_TYPES);
  const [sort, setSort] = useState<SortKey>('az');

  // Home links here with ?filter=To%20post
  useEffect(() => {
    if (params.filter !== undefined) setStatus(parseStatusFilter(params.filter));
  }, [params.filter]);
  useEffect(() => {
    if (params.q !== undefined) setQ(params.q);
  }, [params.q]);

  const entries = useMemo(() => buildEntries(data), [data]);
  const types = useMemo(() => itemTypesPresent(data.items), [data.items]);
  const typeOptions = useMemo(
    () => [ALL_TYPES, ...types].map((t) => ({ value: t, label: t })),
    [types],
  );
  const visible = useMemo(
    () => sortEntries(filterEntries(entries, { q, status, itemType }), sort),
    [entries, q, status, itemType, sort],
  );
  const todayStr = useMemo(() => today(), []);

  const open = useCallback((id: string) => router.push({ pathname: '/items/[id]', params: { id } }), []);
  const renderItem = useCallback(
    ({ item, index }: { item: ListEntry; index: number }) => (
      <ItemRow entry={item} today={todayStr} first={index === 0} last={index === visible.length - 1} onPress={open} />
    ),
    [todayStr, visible.length, open],
  );

  const header = (
    <View>
      <SearchField
        value={q}
        onChangeText={setQ}
        placeholder="Search: skirt, Gorman, WDR-012, size 10…"
        accessibilityLabel="Search items"
        autoCapitalize="none"
      />
      <Chips options={CHIP_OPTIONS} value={status} onChange={setStatus} />
      <Select label="Item type" title="Item type" value={itemType} options={typeOptions} onChange={setItemType} />
      <Segmented options={SORT_OPTIONS} value={sort} onChange={setSort} />
      <Text style={styles.count} accessibilityLiveRegion="polite">
        {visible.length} item{visible.length === 1 ? '' : 's'}
      </Text>
    </View>
  );

  const empty = isLoading ? (
    <EmptyState title="Loading items" />
  ) : data.items.length === 0 ? (
    <EmptyState
      title="No items yet"
      message="Add your first item, or create one from a receipt line on a trip."
      action={{ label: 'New item', onPress: () => router.push('/items/new') }}
    />
  ) : (
    <Card>
      <Text style={{ color: colors.ink2 }}>No items match.</Text>
    </Card>
  );

  return (
    <Screen title="Items" scroll={false} contentStyle={pageStyle}>
      <FlatList
        data={visible}
        keyExtractor={(e) => e.item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.listContent}
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        initialNumToRender={14}
        windowSize={9}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 13, color: colors.ink2, marginHorizontal: 4, marginBottom: 8 },
  listContent: { paddingBottom: 96 },
});
