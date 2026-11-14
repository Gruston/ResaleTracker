import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, Callout, Card, Field, KV, MoneyBar, Sheet } from '@/components';
import { useBusinessData, useRecordReturn, useResolveReturn } from '@/data';
import { daysBetween, ebayEarnings, formatDate, formatMoney, saleForItem } from '@/domain';
import { colors } from '@/theme';
import { amountText, breakdownValues, parseAmount } from './helpers';
import { AccentKV, CardTitle, ItemGate } from './ui';

/** The Sale tab of the item detail page. */
export function SaleTab({ itemId }: { itemId: string }) {
  const { data, isLoading } = useBusinessData();
  const recordReturn = useRecordReturn();
  const resolveReturn = useResolveReturn();
  const [returnOpen, setReturnOpen] = useState(false);
  const [refund, setRefund] = useState('');
  const [reason, setReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);

  const item = data.items.find((i) => i.id === itemId);
  if (!item) return <ItemGate loading={isLoading} missing={!isLoading} />;

  const sale = saleForItem(data, itemId);

  if (!sale) {
    return (
      <View>
        <Card>
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink2 }}>
            Not sold yet. In a later update, sale details arrive from eBay automatically.
          </Text>
        </Card>
        {item.status === 'listed' ? (
          <Button label="Record sale" onPress={() => router.push({ pathname: '/sale/new', params: { itemId } })} />
        ) : null}
      </View>
    );
  }

  const { order, orderItem } = sale;
  const combined = order.items.length > 1;
  const mates = order.items
    .filter((oi) => oi.itemId !== itemId)
    .map((oi) => data.items.find((i) => i.id === oi.itemId))
    .filter((i): i is NonNullable<typeof i> => !!i);
  const v = breakdownValues(orderItem, item.cost);
  const earnings = ebayEarnings(orderItem);
  const days = item.listedDate ? daysBetween(item.listedDate, order.soldDate) : null;
  const money = (n: number) => formatMoney(n);
  const pendingReturn =
    item.status === 'returned'
      ? [...data.returns]
          .filter((r) => r.itemId === itemId && r.outcome === 'pending')
          .sort((a, b) => (a.returnDate < b.returnDate ? 1 : -1))[0] ?? null
      : null;
  const canRecordReturn = item.status === 'sold' || item.status === 'posted';

  const openReturn = () => {
    setRefund(amountText(orderItem.allocTotal));
    setReason('');
    setRefundError(null);
    setReturnOpen(true);
  };

  const saveReturn = () => {
    const amount = parseAmount(refund);
    if (amount == null || amount < 0) {
      setRefundError('Enter the refund amount, or 0');
      return;
    }
    recordReturn.mutate(
      { itemId, orderId: order.id, refundAmount: amount, reason: reason.trim() || null },
      {
        onSuccess: () => setReturnOpen(false),
        onError: (e) => Alert.alert('Could not record the return', e.message),
      },
    );
  };

  const resolve = (outcome: 'relisted' | 'thrown_out') => {
    if (!pendingReturn) return;
    resolveReturn.mutate(
      { returnId: pendingReturn.id, outcome },
      { onError: (e) => Alert.alert('Could not update the return', e.message) },
    );
  };

  return (
    <View>
      {combined ? (
        <Callout>
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink }}>
            <Text style={{ fontWeight: '700' }}>Combined order</Text>
            {' with '}
            {mates.map((m, i) => (
              <Text key={m.id}>
                {i > 0 ? ', ' : ''}
                <Text
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${m.sku} ${m.brand} ${m.title}`}
                  style={{ color: colors.accent, textDecorationLine: 'underline' }}
                  onPress={() => router.push(`/items/${m.id}`)}
                >
                  {`${m.sku} ${m.brand} ${m.title}`}
                </Text>
              </Text>
            ))}
            {`. The buyer paid ${money(order.orderTotal)} for the whole order; postage and buyer protection are split by item price so each item's profit is right.`}
          </Text>
        </Callout>
      ) : null}

      <Card>
        <CardTitle>{`Where the buyer's ${money(orderItem.allocTotal)} went`}</CardTitle>
        <MoneyBar
          segments={[
            { label: 'Your cost', value: v.cost, color: colors.cost, display: `Your cost ${money(v.cost)}` },
            { label: 'Your profit', value: v.barProfit, color: colors.profit, display: `Your profit ${money(v.profit)}` },
            { label: 'Postage', value: v.postage, color: colors.postage, display: `Postage ${money(v.postage)}` },
            { label: 'Buyer protection', value: v.protection, color: colors.protection, display: `Buyer protection ${money(v.protection)}` },
            { label: 'Ad fee', value: v.ad, color: colors.ad, display: `Ad fee ${money(v.ad)}` },
          ]}
        />
      </Card>

      <Card>
        <KV label="Date sold" value={`${formatDate(order.soldDate)}${days != null ? ` · ${days} days` : ''}`} />
        <KV label="eBay order no." value={order.orderNo ?? 'Not entered'} />
        <KV
          label={combined ? "This item's share of order" : 'Order total (buyer paid)'}
          value={money(orderItem.allocTotal)}
          total
        />
        <KV label="− Buyer protection fee" value={money(orderItem.allocProtection)} muted />
        <KV label="− Postage" value={money(orderItem.allocPostage)} muted />
        <KV label="− Ad fee" value={money(orderItem.adFee)} muted />
        <KV label="eBay earnings" value={money(earnings)} total />
        <KV label="− What you paid" value={money(v.cost)} muted />
        <AccentKV label="Your profit" value={money(v.profit)} color={v.profit < 0 ? colors.warn : colors.accent} last />
      </Card>

      {item.status === 'returned' ? (
        <Card style={{ borderColor: '#E5C7DD' }}>
          <CardTitle>Returned</CardTitle>
          {pendingReturn?.reason ? (
            <Text style={{ fontSize: 14, color: colors.ink2, marginBottom: 6 }}>{pendingReturn.reason}</Text>
          ) : null}
          <KV label="Refund to buyer" value={money(pendingReturn?.refundAmount ?? 0)} />
          <KV label="Came back" value={pendingReturn ? 'Awaiting decision' : 'Decided'} last />
          {pendingReturn ? (
            <View style={{ marginTop: 10 }}>
              <Button
                label="Relist it"
                variant="secondary"
                loading={resolveReturn.isPending}
                onPress={() => resolve('relisted')}
              />
              <Button
                label="Damaged, throw out"
                variant="danger"
                disabled={resolveReturn.isPending}
                onPress={() => resolve('thrown_out')}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {canRecordReturn ? <Button label="Record a return" variant="secondary" size="small" onPress={openReturn} /> : null}

      <Sheet visible={returnOpen} onClose={() => setReturnOpen(false)} title="Record a return">
        <Field
          label="Refund to buyer"
          prefix="$"
          value={refund}
          onChangeText={(t) => {
            setRefund(t);
            setRefundError(null);
          }}
          keyboardType="decimal-pad"
          error={refundError}
          hint="Starts as this item's share of the order."
        />
        <Field label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Did not fit" returnKeyType="done" />
        <Button label="Save return" loading={recordReturn.isPending} onPress={saveReturn} />
        <Button label="Cancel" variant="secondary" onPress={() => setReturnOpen(false)} />
      </Sheet>
    </View>
  );
}

