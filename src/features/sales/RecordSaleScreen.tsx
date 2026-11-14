import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, DateField, EmptyState, Field, Icon, KV, Screen, SearchField, Sheet, SheetOption, Thumb } from '@/components';
import { useBusinessData, useRecordSale } from '@/data';
import type { BusinessData, Item } from '@/domain';
import { formatMoney, protectionFor, round2, saleForItem, sumMoney, today } from '@/domain';
import { colors } from '@/theme';
import { addableItems, amountText, parseAmount, previewSale, validateSaleForm } from './helpers';
import { AccentKV, CardTitle } from './ui';

/** Record sale screen (route /sale/new?itemId=...). Handles loading and missing items. */
export function RecordSaleScreen({ itemId }: { itemId: string }) {
  const { data, isLoading } = useBusinessData();
  const [saved, setSaved] = useState(false);
  const item = data.items.find((i) => i.id === itemId);

  if (saved) return <Screen back title="Record sale">{null}</Screen>;
  if (!item) {
    return (
      <Screen back title="Record sale">
        {isLoading ? (
          <EmptyState title="Loading" />
        ) : (
          <EmptyState title="Item not found" message="It may have been deleted." action={{ label: 'Go back', onPress: () => router.back() }} />
        )}
      </Screen>
    );
  }
  if (saleForItem(data, itemId) && item.status !== 'listed' && item.status !== 'draft') {
    return (
      <Screen back title="Record sale">
        <EmptyState
          title="Already sold"
          message="This item already has a sale. Open its Sale tab to see the details or record a return."
          action={{ label: 'Go back', onPress: () => router.back() }}
        />
      </Screen>
    );
  }
  return <RecordSaleForm item={item} data={data} onSaved={() => setSaved(true)} />;
}

interface Line {
  itemId: string;
  price: string;
}

function RecordSaleForm({ item, data, onSaved }: { item: Item; data: BusinessData; onSaved: () => void }) {
  const { settings } = data;
  const recordSale = useRecordSale();
  const [lines, setLines] = useState<Line[]>([
    { itemId: item.id, price: item.firstListPrice != null ? amountText(item.firstListPrice) : '' },
  ]);
  const [orderNo, setOrderNo] = useState('');
  const [soldDate, setSoldDate] = useState(today());
  const [postageText, setPostageText] = useState(amountText(settings.defaultLabelCost));
  const [protEdited, setProtEdited] = useState<string | null>(null);
  const [totalEdited, setTotalEdited] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const itemById = (id: string) => data.items.find((i) => i.id === id);
  const combined = lines.length > 1;

  // Suggested protection and total follow the prices and postage until she types her own figure.
  const prices = lines.map((l) => parseAmount(l.price) ?? 0);
  const priceSum = sumMoney(prices);
  const postageNum = parseAmount(postageText) ?? 0;
  const suggestedProt = round2(protectionFor(priceSum, postageNum, settings));
  const protText = protEdited ?? (priceSum > 0 ? amountText(suggestedProt) : '');
  const protNum = parseAmount(protText) ?? 0;
  const totalText = totalEdited ?? (priceSum > 0 ? amountText(sumMoney([priceSum, postageNum, protNum])) : '');

  const result = validateSaleForm({
    orderNo,
    soldDate,
    orderTotal: totalText,
    buyerProtection: protText,
    postage: postageText,
    prices: lines.map((l) => l.price),
  });
  const err = submitted ? result.errors : { prices: {} as Record<number, string> };

  const preview = result.values
    ? previewSale(
        {
          orderTotal: result.values.orderTotal,
          buyerProtection: result.values.buyerProtection,
          postage: result.values.postage,
          items: lines.flatMap((l, i) => {
            const it = itemById(l.itemId);
            return it ? [{ item: it, salePrice: result.values?.prices[i] ?? 0 }] : [];
          }),
        },
        settings,
      )
    : null;

  const setPrice = (i: number, price: string) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, price } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, k) => k !== i));
  const addLine = (it: Item) => {
    setPickerOpen(false);
    setQuery('');
    setLines((ls) => [...ls, { itemId: it.id, price: it.firstListPrice != null ? amountText(it.firstListPrice) : '' }]);
  };

  const save = () => {
    setSubmitted(true);
    if (!result.ok || !result.values) return;
    const v = result.values;
    recordSale.mutate(
      {
        orderNo: orderNo.trim() || null,
        soldDate: soldDate.trim(),
        orderTotal: v.orderTotal,
        buyerProtection: v.buyerProtection,
        postage: v.postage,
        items: lines.map((l, i) => ({ itemId: l.itemId, salePrice: v.prices[i] })),
      },
      {
        onSuccess: () => {
          onSaved();
          router.back();
        },
        onError: (e) => Alert.alert('Could not record the sale', e.message),
      },
    );
  };

  const mismatch = !!preview && !preview.matches;
  const candidates = addableItems(data.items, lines.map((l) => l.itemId), query).slice(0, 40);

  return (
    <Screen
      back
      title="Record sale"
      bottomInset
      footer={
        <Button
          label={mismatch ? 'Save anyway' : 'Save sale'}
          loading={recordSale.isPending}
          onPress={save}
          style={{ marginBottom: 0 }}
        />
      }
    >
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {combined ? 'Items in this order' : 'Item'}
      </Text>
      {lines.map((l, i) => {
        const it = itemById(l.itemId);
        if (!it) return null;
        return (
          <Card key={l.itemId}>
            <View style={styles.itemHead}>
              <Thumb path={it.photos[0]?.path} label={it.brand || it.title} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {it.title}
                </Text>
                <Text style={styles.itemSub} numberOfLines={1}>
                  {[it.sku, it.brand, it.size ? `Size ${it.size}` : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {i > 0 ? (
                <Button
                  label="Remove"
                  variant="secondary"
                  size="small"
                  accessibilityLabel={`Remove ${it.title} from this order`}
                  onPress={() => removeLine(i)}
                />
              ) : null}
            </View>
            <Field
              label="Sale price"
              prefix="$"
              value={l.price}
              onChangeText={(t) => setPrice(i, t)}
              keyboardType="decimal-pad"
              error={err.prices[i]}
              hint={it.firstListPrice != null ? `Listed at ${formatMoney(it.firstListPrice)}` : undefined}
              style={{ marginTop: 10, marginBottom: 0 }}
            />
          </Card>
        );
      })}
      <Button
        label="+ Add another item from this order"
        variant="secondary"
        onPress={() => setPickerOpen(true)}
        accessibilityLabel="Add another item from this order"
      />

      <Text style={styles.sectionLabel} accessibilityRole="header">
        Order
      </Text>
      <Card>
        <Field label="eBay order no. (optional)" value={orderNo} onChangeText={setOrderNo} autoCapitalize="none" autoCorrect={false} />
        <DateField label="Date sold" value={soldDate} onChange={setSoldDate} error={err.soldDate} />
        <Field
          label="Postage label cost"
          prefix="$"
          value={postageText}
          onChangeText={setPostageText}
          keyboardType="decimal-pad"
          error={err.postage}
        />
        <Field
          label="Buyer protection fee"
          prefix="$"
          value={protText}
          onChangeText={setProtEdited}
          keyboardType="decimal-pad"
          error={err.buyerProtection}
          hint={protEdited == null ? 'Worked out from your fee settings. Change it to match eBay.' : undefined}
        />
        <Field
          label="Order total (buyer paid, all in)"
          prefix="$"
          value={totalText}
          onChangeText={setTotalEdited}
          keyboardType="decimal-pad"
          error={err.orderTotal}
          hint={totalEdited == null ? 'Filled in from the parts. Change it to what the buyer paid.' : undefined}
          style={{ marginBottom: 0 }}
        />
      </Card>

      {preview ? (
        <>
          <Text style={styles.sectionLabel} accessibilityRole="header">
            Preview
          </Text>
          {preview.rows.map((r) => {
            const it = itemById(r.itemId);
            return (
              <Card key={r.itemId}>
                <CardTitle>{it?.title ?? 'Item'}</CardTitle>
                <KV label="Sale price" value={formatMoney(r.orderItem.salePrice)} />
                <KV label="− Postage" value={formatMoney(r.orderItem.allocPostage)} muted />
                <KV label="− Buyer protection fee" value={formatMoney(r.orderItem.allocProtection)} muted />
                <KV label="− Ad fee" value={formatMoney(r.orderItem.adFee)} muted />
                <KV label="eBay earnings" value={formatMoney(r.earnings)} total />
                <AccentKV
                  label="Your profit"
                  value={formatMoney(r.profit)}
                  color={r.profit < 0 ? colors.warn : colors.accent}
                  last
                />
              </Card>
            );
          })}
          {combined ? (
            <Card>
              <KV label="Total eBay earnings" value={formatMoney(preview.totalEarnings)} total />
              <AccentKV label="Total profit" value={formatMoney(preview.totalProfit)} last />
            </Card>
          ) : null}
          {preview.matches ? (
            <View style={styles.ok} accessible accessibilityLabel="Parts add up to the order total">
              <Icon name="check" size={18} color={colors.accent} />
              <Text style={styles.okText}>Parts add up to the order total</Text>
            </View>
          ) : (
            <View style={styles.warn} accessible accessibilityRole="alert">
              <Text style={styles.warnText}>
                {`Parts do not add up. Sale prices + postage + buyer protection come to ${formatMoney(preview.partsTotal)}, but the order total is ${formatMoney(preview.partsTotal + preview.difference)} (${preview.difference > 0 ? 'over' : 'under'} by ${formatMoney(Math.abs(preview.difference))}). Check the figures, or save anyway if eBay's numbers are right.`}
              </Text>
            </View>
          )}
        </>
      ) : null}

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add an item to this order">
        <SearchField value={query} onChangeText={setQuery} placeholder="Search listed items" />
        {candidates.length === 0 ? (
          <Text style={styles.itemSub}>No other listed items match.</Text>
        ) : (
          candidates.map((c) => (
            <SheetOption
              key={c.id}
              label={c.title}
              subtitle={[c.sku, c.brand, c.firstListPrice != null ? formatMoney(c.firstListPrice) : null].filter(Boolean).join(' · ')}
              onPress={() => addLine(c)}
            />
          ))
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.ink2, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6, marginHorizontal: 4, marginBottom: 8 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  itemSub: { fontSize: 13, color: colors.ink2 },
  ok: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.accentSoft, marginBottom: 12 },
  okText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  warn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.warnSoft, marginBottom: 12 },
  warnText: { fontSize: 14, lineHeight: 20, color: colors.warn },
});
