import { StyleSheet, View } from 'react-native';

import { Field } from '@/components';
import { formatMoney } from '@/domain';
import { parseMoney, parseQty } from './helpers';

export interface LineFieldValues {
  description: string;
  qty: string;
  price: string;
}

export function readLineFields(v: LineFieldValues): { description: string; qty: number; price: number } | { error: string } {
  const description = v.description.trim();
  if (!description) return { error: 'Add a short description, like "Cotton On tops".' };
  const qty = parseQty(v.qty);
  if (qty === null) return { error: 'Quantity should be a whole number, 1 or more.' };
  const price = parseMoney(v.price);
  if (price === null) return { error: 'Add the price for the whole line, like 15.00.' };
  return { description, qty, price };
}

/** Description, quantity and line price (the price is for the whole line, not each). */
export function LineFields({ values, onChange, autoFocus }: { values: LineFieldValues; onChange: (v: LineFieldValues) => void; autoFocus?: boolean }) {
  const qty = parseQty(values.qty) ?? 1;
  const price = parseMoney(values.price);
  return (
    <View>
      <Field
        label="Description"
        value={values.description}
        onChangeText={(description) => onChange({ ...values, description })}
        placeholder="e.g. Cotton On tops"
        autoFocus={autoFocus}
        autoCapitalize="sentences"
      />
      <View style={styles.row}>
        <Field
          label="Quantity"
          value={values.qty}
          onChangeText={(q) => onChange({ ...values, qty: q.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
          style={{ flex: 1 }}
        />
        <Field
          label="Line price"
          prefix="$"
          value={values.price}
          onChangeText={(p) => onChange({ ...values, price: p })}
          keyboardType="decimal-pad"
          placeholder="0.00"
          hint={price !== null && qty > 1 ? `${formatMoney(price / qty)} each` : 'Total for this line'}
          style={{ flex: 1.4 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
});
