import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Callout, Card, Icon, Pill } from '@/components';
import {
  buyerSeesAbout,
  daysBetween,
  formatDate,
  formatMoney,
  round2,
  saleForItem,
  storageFor,
  today,
  youGetAbout,
  type BusinessData,
  type Item,
} from '@/domain';
import { colors } from '@/theme';
import { AddCostSheet } from './AddCostSheet';

function Row({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.kv, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueWrap}>{typeof children === 'string' ? <Text style={styles.value}>{children}</Text> : children}</View>
    </View>
  );
}

function Warn({ children }: { children: string }) {
  return <Text style={[styles.value, { color: colors.warn }]}>{children}</Text>;
}

export function DetailsTab({ item, data }: { item: Item; data: BusinessData }) {
  return (
    <>
      <Card>
        <Row label="SKU">{item.sku}</Row>
        <Row label="Stored at">{storageFor(item.sku, data.storage)}</Row>
        <Row label="Brand">{item.brand || '—'}</Row>
        <Row label="Department">{item.department}</Row>
        <Row label="Item type">{item.itemType || '—'}</Row>
        <Row label="Size" last>
          {item.size || '—'}
        </Row>
      </Card>
      <Card>
        <Text style={styles.sectionLabel}>Listing description</Text>
        <Text style={styles.description}>{item.description || 'No description yet.'}</Text>
      </Card>
    </>
  );
}

export function PurchaseTab({ item, data }: { item: Item; data: BusinessData }) {
  const [costOpen, setCostOpen] = useState(false);
  const shop = data.shops.find((s) => s.id === item.shopId);
  const trip = item.tripId ? data.trips.find((t) => t.id === item.tripId) : undefined;
  const tripShop = trip ? data.shops.find((s) => s.id === trip.shopId)?.name : undefined;
  const date = item.purchaseDate ?? trip?.tripDate ?? null;
  return (
    <>
      <Card>
        <Row label="Bought from">{shop ? shop.name : <Warn>Not recorded</Warn>}</Row>
        <Row label="Date">{date ? formatDate(date) : '—'}</Row>
        <Row label="Cost">
          {item.cost != null ? (
            formatMoney(item.cost)
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Add cost" onPress={() => setCostOpen(true)} style={styles.link}>
              <Text style={[styles.value, { color: colors.warn }]}>Add cost</Text>
            </Pressable>
          )}
        </Row>
        <Row label="Online order no.">{item.onlineOrderNo || '—'}</Row>
        <Row label="Shopping trip" last>
          {trip ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open trip: ${tripShop ?? 'Trip'}, ${formatDate(trip.tripDate)}`}
              onPress={() => router.push(`/trips/${trip.id}`)}
              style={styles.link}
            >
              <Text style={[styles.value, { color: colors.accent }]}>
                {tripShop ? `${tripShop}, ` : ''}
                {formatDate(trip.tripDate)}
              </Text>
              <Icon name="chev" size={16} color={colors.accent} />
            </Pressable>
          ) : (
            '—'
          )}
        </Row>
      </Card>
      {item.cost == null ? <Button label="Add what you paid" onPress={() => setCostOpen(true)} /> : null}
      <AddCostSheet item={item} shops={data.shops} visible={costOpen} onClose={() => setCostOpen(false)} />
    </>
  );
}

export function ListingTab({ item, data }: { item: Item; data: BusinessData }) {
  const { settings } = data;
  const sale = saleForItem(data, item.id);
  const price = item.firstListPrice;
  const adRate = item.adRate ?? settings.defaultAdRate;
  const soldFor = sale && item.status !== 'returned' && item.status !== 'faulty' ? sale.orderItem.salePrice : null;
  const dropAmount = price != null && soldFor != null ? round2(price - soldFor) : null;
  const dropPct = price != null && price > 0 && dropAmount != null ? Math.round((dropAmount / price) * 100) : null;
  const daysListed = item.listedDate
    ? sale
      ? `${Math.max(0, daysBetween(item.listedDate, sale.order.soldDate))} (sold)`
      : String(Math.max(0, daysBetween(item.listedDate, today())))
    : '—';

  return (
    <>
      <Card>
        <Row label="Status">
          <Pill status={item.status} />
        </Row>
        <Row label="Date listed">{item.listedDate ? formatDate(item.listedDate) : '—'}</Row>
        <Row label="First listing price">{price != null ? formatMoney(price) : '—'}</Row>
        <Row label="Ad rate">{item.adRate != null ? `${item.adRate}%` : '—'}</Row>
        <Row label="You get about">{price != null ? formatMoney(youGetAbout(price, adRate, settings)) : '—'}</Row>
        <Row label="Buyer sees about">{price != null ? formatMoney(buyerSeesAbout(price, settings)) : '—'}</Row>
        {soldFor != null ? (
          <>
            <Row label="Sold for">{formatMoney(soldFor)}</Row>
            <Row label="Discount from first price">
              {dropAmount == null || dropPct == null ? '—' : dropAmount > 0 ? `${formatMoney(dropAmount)} (${dropPct}%)` : 'None'}
            </Row>
          </>
        ) : null}
        <Row label="Days listed" last>
          {daysListed}
        </Row>
        {price != null ? (
          <Text style={styles.note}>
            You get: your price minus the ad fee. Buyer sees: your price plus buyer protection and postage.
          </Text>
        ) : null}
      </Card>
      <Button label="Edit listing" variant="secondary" onPress={() => router.push({ pathname: '/items/[id]/edit', params: { id: item.id } })} />
      {price != null ? (
        <Button
          label="Try pricing options"
          variant="secondary"
          icon={<Icon name="calc" size={18} color={colors.accent} />}
          onPress={() => router.push({ pathname: '/what-if', params: { itemId: item.id } })}
        />
      ) : (
        <Callout>Add a listing price to see what you get and try pricing options.</Callout>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  label: { fontSize: 15, color: colors.ink2, flexShrink: 1 },
  valueWrap: { flexShrink: 1, alignItems: 'flex-end' },
  value: { fontSize: 15, fontWeight: '500', color: colors.ink, textAlign: 'right' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, justifyContent: 'center' },
  sectionLabel: { fontSize: 13, color: colors.ink2, marginBottom: 6 },
  description: { fontSize: 15, lineHeight: 22, color: colors.ink },
  note: { fontSize: 13, color: colors.ink2, marginTop: 10, lineHeight: 18 },
});
