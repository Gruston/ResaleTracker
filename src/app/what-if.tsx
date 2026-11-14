import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Card, EmptyState, Field, Pill, Screen, Select } from '@/components';
import { useBusinessData } from '@/data';
import { formatMoney } from '@/domain';
import { defaultInputs, runWhatIf, type ScenarioInputs } from '@/features/insights/whatIfHelpers';
import { colors, radius } from '@/theme';

const WIDE = 700;

export default function WhatIfScreen() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { data } = useBusinessData();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;

  const listed = useMemo(() => data.items.filter((i) => i.status === 'listed'), [data.items]);
  // Allow a deep link to any item, even one that is not listed.
  const options = useMemo(() => {
    const list = [...listed];
    const linked = itemId ? data.items.find((i) => i.id === itemId) : undefined;
    if (linked && !list.some((i) => i.id === linked.id)) list.unshift(linked);
    return list;
  }, [listed, data.items, itemId]);

  const [picked, setPicked] = useState<string | null>(null);
  const item = options.find((i) => i.id === (picked ?? itemId)) ?? options[0];

  // Edited values are kept per item so switching items starts from sensible defaults.
  const [edits, setEdits] = useState<{ itemId: string | null; inputs: ScenarioInputs | null }>({ itemId: null, inputs: null });
  const inputs: ScenarioInputs = edits.itemId === item?.id && edits.inputs ? edits.inputs : defaultInputs(item);
  const set = (k: keyof ScenarioInputs) => (text: string) =>
    setEdits({ itemId: item?.id ?? null, inputs: { ...inputs, [k]: text } });

  const results = useMemo(() => runWhatIf(item, inputs, data.settings), [item, inputs, data.settings]);
  const keys: (keyof ScenarioInputs)[] = ['a', 'b', 'c'];

  return (
    <Screen title="Pricing what-if" back bottomInset>
      {!item ? (
        <EmptyState title="No items to compare" message="List an item first, then come back to compare prices and postage options." />
      ) : (
        <>
          <Select
            label="Item"
            value={item.id}
            options={options.map((i) => ({
              value: i.id,
              label: `${[i.brand, i.title].filter(Boolean).join(' ')} (cost ${i.cost != null ? formatMoney(i.cost) : '?'})`,
            }))}
            onChange={setPicked}
          />
          <Text style={styles.note}>
            Change the prices to compare. The postage label costs you {formatMoney(data.settings.defaultLabelCost)} either way.
          </Text>

          <View style={wide ? styles.rowWide : undefined}>
            {results.map((r, i) => (
              <Card
                key={keys[i]}
                style={[wide && styles.colWide, r.best && styles.best]}
              >
                <View style={styles.head}>
                  <Text style={styles.h5} accessibilityRole="header">
                    {r.label}
                  </Text>
                  {r.best ? <Pill status="posted" label="Best" /> : null}
                </View>
                <Field
                  label="Item price"
                  prefix="$"
                  keyboardType="decimal-pad"
                  value={inputs[keys[i]]}
                  onChangeText={set(keys[i])}
                  accessibilityLabel={`Item price for ${r.label}`}
                />
                {i === 2 ? (
                  <Field
                    label="Flat postage"
                    prefix="$"
                    keyboardType="decimal-pad"
                    value={inputs.flat}
                    onChangeText={set('flat')}
                    accessibilityLabel="Flat postage amount"
                  />
                ) : null}
                <Line label="Buyer pays all-in" value={formatMoney(r.buyerPays)} />
                <Line label="Postage charged" value={formatMoney(r.postageCharged)} />
                <Line label="Protection + ad" value={formatMoney(r.protection + r.adFee)} />
                <Line label="eBay earnings" value={formatMoney(r.earnings)} />
                <Text style={styles.keepLabel}>You keep</Text>
                <Text
                  style={[styles.keep, { color: r.keep >= 0 ? colors.accent : colors.warn }]}
                  accessibilityLabel={`You keep ${formatMoney(r.keep)}`}
                >
                  {formatMoney(r.keep)}
                </Text>
              </Card>
            ))}
          </View>

          <Card>
            <Text style={styles.h5}>Business seller (later)</Text>
            <Text style={styles.cardNote}>
              Enter eBay's monthly fee and flat postage rates to see how many sales a month make upgrading worth it. Rates are
              editable in More › Fee settings.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 13, color: colors.ink2, marginHorizontal: 2, marginBottom: 10 },
  rowWide: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  colWide: { flex: 1 },
  best: { borderColor: colors.accent, borderWidth: 2, borderRadius: radius.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  h5: { fontSize: 15, fontWeight: '600', color: colors.ink },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 8 },
  lineLabel: { fontSize: 14, color: colors.ink2, flexShrink: 1 },
  lineValue: { fontSize: 14, fontWeight: '600', color: colors.ink },
  keepLabel: { fontSize: 13, color: colors.ink2, marginTop: 8 },
  keep: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  cardNote: { fontSize: 13, color: colors.ink2, lineHeight: 18, marginTop: 4 },
});
