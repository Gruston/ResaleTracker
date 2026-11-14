import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { addDays, formatDateAU, parseDateAU, today } from '@/domain/dates';
import { colors, minTouch } from '@/theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export interface DateFieldProps {
  label?: string;
  /** ISO 'YYYY-MM-DD', or '' when empty */
  value: string;
  /** called with the chosen date as ISO ('' when cleared) */
  onChange: (iso: string) => void;
  hint?: string;
  error?: string | null;
  /** an empty date is fine; shows a Clear button */
  optional?: boolean;
  /** kept for compatibility: a calendar can't hold an invalid date, so this always reports true */
  onValidChange?: (ok: boolean) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** ISO -> local Date at midday (avoids time-zone edge cases around midnight). */
function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** "Sat 14/11/2026" */
function display(iso: string): string {
  return `${WEEKDAYS[toDate(iso).getDay()]} ${formatDateAU(iso)}`;
}

/**
 * Australian date field: shows "Sat 14/11/2026"; tap to pick from a calendar (iOS inline calendar in a
 * bottom sheet, Android's date dialog). Quick buttons for Today and Yesterday. Stores ISO via onChange.
 */
export function DateField({ label = 'Date', value, onChange, hint, error, optional, onValidChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || today());

  useEffect(() => {
    onValidChange?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shownLabel = optional && label ? `${label} (optional)` : label;

  // Web (demo/preview only): no native calendar, so type DD/MM/YYYY.
  if (Platform.OS === 'web') {
    return <WebDateField label={shownLabel} value={value} onChange={onChange} hint={hint} error={error} />;
  }

  const openPicker = () => {
    setDraft(value || today());
    setOpen(true);
  };

  const onAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    setOpen(false);
    if (e.type === 'set' && d) onChange(toIso(d));
  };

  return (
    <View style={styles.wrap}>
      {shownLabel ? <Text style={styles.label}>{shownLabel}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? display(value) : 'not set'}. Tap to choose a date`}
        onPress={openPicker}
        style={({ pressed }) => [styles.box, !!error && styles.boxError, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? display(value) : 'Choose a date'}</Text>
        <Icon name="calendar" size={20} color={colors.accent} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.row}>
        <Button label="Today" variant="secondary" size="small" onPress={() => onChange(today())} />
        <Button label="Yesterday" variant="secondary" size="small" onPress={() => onChange(addDays(today(), -1))} />
        {optional && value ? <Button label="Clear" variant="secondary" size="small" onPress={() => onChange('')} /> : null}
      </View>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker value={toDate(value || today())} mode="date" onChange={onAndroidChange} />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
          <DateTimePicker
            value={toDate(draft)}
            mode="date"
            display="inline"
            locale="en-AU"
            themeVariant="light"
            accentColor={colors.accent}
            onChange={(_e, d) => d && setDraft(toIso(d))}
            style={{ alignSelf: 'stretch' }}
          />
          <Button
            label={`Use ${display(draft)}`}
            onPress={() => {
              onChange(draft);
              setOpen(false);
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

function WebDateField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  hint?: string;
  error?: string | null;
}) {
  const [text, setText] = useState(value ? formatDateAU(value) : '');
  useEffect(() => {
    setText((t) => (parseDateAU(t) === (value || null) ? t : value ? formatDateAU(value) : ''));
  }, [value]);
  const bad = text.trim() !== '' && parseDateAU(text) === null;
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        value={text}
        onChangeText={(t) => {
          setText(t);
          onChange(parseDateAU(t) ?? '');
        }}
        placeholder="DD/MM/YYYY"
        style={[styles.box, styles.value]}
      />
      {bad ? <Text style={styles.error}>Use DD/MM/YYYY, like 14/11/2026</Text> : error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.row}>
        <Button label="Today" variant="secondary" size="small" onPress={() => onChange(today())} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: colors.ink2, marginBottom: 5 },
  box: {
    minHeight: minTouch,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  boxError: { borderColor: colors.warn },
  value: { fontSize: 16, color: colors.ink },
  placeholder: { color: colors.ink2 },
  hint: { fontSize: 12, color: colors.ink2, marginBottom: 6 },
  error: { fontSize: 12, color: colors.warn, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
