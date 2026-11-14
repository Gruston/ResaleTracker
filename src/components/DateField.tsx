import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addDays, formatDate, formatDateAU, parseDateAU, today } from '@/domain/dates';
import { Button } from './Button';
import { Field } from './Field';

export interface DateFieldProps {
  label?: string;
  /** ISO 'YYYY-MM-DD', or '' when empty / not a valid date */
  value: string;
  /** called with ISO when the text is a real date, or '' when it is empty or not a date */
  onChange: (iso: string) => void;
  hint?: string;
  error?: string | null;
  /** an empty box is fine (no message) */
  optional?: boolean;
  /** false while the box holds text that is not a real date (lets a form block saving) */
  onValidChange?: (ok: boolean) => void;
}

/** Australian date field: type DD/MM/YYYY, or use Today / Yesterday / day-step buttons. Stores ISO via onChange. */
export function DateField({ label = 'Date', value, onChange, hint, error, optional, onValidChange }: DateFieldProps) {
  const [text, setText] = useState(value ? formatDateAU(value) : '');

  // Follow outside changes (buttons, form reset) but never rewrite what is being typed.
  useEffect(() => {
    setText((t) => (parseDateAU(t) === (value || null) ? t : value ? formatDateAU(value) : ''));
  }, [value]);

  const typed = text.trim() !== '';
  const bad = typed && parseDateAU(text) === null;

  useEffect(() => {
    onValidChange?.(!bad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bad]);

  const type = (t: string) => {
    setText(t);
    onChange(parseDateAU(t) ?? '');
  };
  const set = (iso: string) => {
    setText(formatDateAU(iso));
    onChange(iso);
  };
  const step = (n: number) => set(addDays(value || today(), n));

  const message = bad ? 'Use DD/MM/YYYY, like 14/11/2026' : error ?? null;
  const shownHint = hint ?? (value ? formatDate(value) : undefined);

  return (
    <View style={{ marginBottom: 12 }}>
      <Field
        label={optional && label ? `${label} (optional)` : label}
        accessibilityLabel={label}
        value={text}
        onChangeText={type}
        placeholder="DD/MM/YYYY"
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={10}
        error={message}
        hint={shownHint}
        style={{ marginBottom: 6 }}
      />
      <View style={styles.row}>
        <Button label="Today" variant="secondary" size="small" onPress={() => set(today())} />
        <Button label="Yesterday" variant="secondary" size="small" onPress={() => set(addDays(today(), -1))} />
        <Button label="-1 day" accessibilityLabel="One day earlier" variant="secondary" size="small" onPress={() => step(-1)} />
        <Button label="+1 day" accessibilityLabel="One day later" variant="secondary" size="small" onPress={() => step(1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
