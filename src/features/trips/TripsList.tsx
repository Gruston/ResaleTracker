import { router } from 'expo-router';
import { useState } from 'react';

import { Button, EmptyState, Icon, ListGroup, Screen } from '@/components';
import { useBusinessData } from '@/data';
import { sortTripsNewest } from './helpers';
import { HelperText, TripListRow } from './TripListRow';

const openNew = () => router.push({ pathname: '/trips/new', params: { camera: '1' } });

/** Trips tab: every shopping trip (a receipt), newest first, with sorting progress. */
export function TripsList() {
  const { data, refetch } = useBusinessData();
  const [refreshing, setRefreshing] = useState(false);
  const trips = sortTripsNewest(data.trips);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen
      title="Trips"
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={
        <Button
          label="New trip"
          size="small"
          icon={<Icon name="camera" size={18} color="#fff" />}
          accessibilityLabel="New trip: photograph a receipt"
          onPress={openNew}
        />
      }
    >
      <HelperText>Each shopping trip is a receipt. Every line needs an outcome so nothing is missed.</HelperText>
      {trips.length ? (
        <ListGroup>
          {trips.map((t) => (
            <TripListRow key={t.id} trip={t} shops={data.shops} />
          ))}
        </ListGroup>
      ) : (
        <EmptyState
          title="No trips yet"
          message="Add a trip when you buy stock. Photograph the receipt and note each line."
          action={{ label: 'New trip', onPress: openNew }}
        />
      )}
    </Screen>
  );
}
