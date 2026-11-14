import { StyleSheet, View } from 'react-native';

import { Button, Field } from '@/components';
import { addDays, formatDate, today } from '@/domain';
import { isValidDate } from './helpers';

export interface DateFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

/** Date typed as YYYY-MM-DD, with Today / Yesterday and day-step buttons (no native date picker needed). */
export function DateField({ label = 'Date', value, onChange }: DateFieldProps) {
  const valid = isValidDate(value);
  const step = (n: number) => onChange(addDays(valid ? value : today(), n));
  return (
    <View style={{ marginBottom: 12 }}>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        maxLength={10}
        error={value && !valid ? 'Use the form YYYY-MM-DD, like 2026-11-14' : null}
        hint={valid ? formatDate(value) : undefined}
        style={{ marginBottom: 6 }}
      />
      <View style={styles.row}>
        <Button label="Earlier" accessibilityLabel="One day earlier" variant="secondary" size="small" onPress={() => step(-1)} />
        <Button label="Later" accessibilityLabel="One day later" variant="secondary" size="small" onPress={() => step(1)} />
        <Button label="Today" variant="secondary" size="small" onPress={() => onChange(today())} />
        <Button label="Yesterday" variant="secondary" size="small" onPress={() => onChange(addDays(today(), -1))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
