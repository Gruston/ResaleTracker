import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field } from '@/components';
import { uuid } from '@/lib/uuid';
import { colors } from '@/theme';
import type { DraftLine } from './helpers';

export function newDraftLine(): DraftLine {
  return { key: uuid(), description: '', qty: '1', price: '' };
}

/** Quick "add lines" list on the new-trip form: description, qty, price per row. */
export function DraftLinesEditor({
  lines,
  onChange,
  invalid,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  invalid: string[];
}) {
  const update = (key: string, patch: Partial<DraftLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));

  return (
    <View>
      {lines.map((l, i) => (
        <Card key={l.key} style={invalid.includes(l.key) ? { borderColor: colors.warn } : undefined}>
          <View style={styles.head}>
            <Text style={styles.num}>Line {i + 1}</Text>
            {lines.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove line ${i + 1}`} onPress={() => remove(l.key)} style={styles.remove}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <Field
            label="Description"
            value={l.description}
            onChangeText={(description) => update(l.key, { description })}
            placeholder="e.g. Cotton On tops"
            accessibilityLabel={`Line ${i + 1} description`}
          />
          <View style={styles.row}>
            <Field
              label="Qty"
              value={l.qty}
              onChangeText={(q) => update(l.key, { qty: q.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              accessibilityLabel={`Line ${i + 1} quantity`}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <Field
              label="Line price"
              prefix="$"
              value={l.price}
              onChangeText={(price) => update(l.key, { price })}
              keyboardType="decimal-pad"
              placeholder="0.00"
              accessibilityLabel={`Line ${i + 1} price`}
              style={{ flex: 1.4, marginBottom: 0 }}
            />
          </View>
        </Card>
      ))}
      <Button label="+ Add another line" variant="secondary" onPress={() => onChange([...lines, newDraftLine()])} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  num: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  remove: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  removeText: { fontSize: 14, color: colors.warn, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
});
