import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';
import { Icon } from './Icon';
import { Sheet, SheetOption } from './Sheet';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  subtitle?: string;
}

export interface SelectProps<T extends string | number> {
  label?: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  /** Sheet heading (defaults to label) */
  title?: string;
  /** Shows a "+ Add new" row at the end of the sheet; called after the sheet closes. */
  onAddNew?: () => void;
  addNewLabel?: string;
  /** Adds a "None" row at the top; called when chosen (use it to clear the value). */
  onClear?: () => void;
  clearLabel?: string;
  error?: string | null;
}

/** A field that opens a bottom sheet of options. */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  title,
  onAddNew,
  addNewLabel = '+ Add new',
  onClear,
  clearLabel = 'None',
  error,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Select'}: ${current?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.box, error ? { borderColor: colors.warn } : null, pressed && { opacity: 0.8 }]}
      >
        <Text style={[styles.value, !current && { color: '#A39E96' }]} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <Icon name="chev" size={18} color={colors.ink2} />
        </View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={title ?? label}>
        {onClear ? (
          <SheetOption
            label={clearLabel}
            selected={value == null}
            onPress={() => {
              setOpen(false);
              onClear();
            }}
          />
        ) : null}
        {options.map((o) => (
          <SheetOption
            key={String(o.value)}
            label={o.label}
            subtitle={o.subtitle}
            selected={o.value === value}
            onPress={() => {
              setOpen(false);
              onChange(o.value);
            }}
          />
        ))}
        {onAddNew ? (
          <SheetOption
            label={addNewLabel}
            onPress={() => {
              setOpen(false);
              onAddNew();
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: colors.ink2, marginBottom: 5, fontWeight: '500' },
  box: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  value: { flex: 1, fontSize: 16, color: colors.ink },
  error: { fontSize: 12, color: colors.warn, marginTop: 4 },
});
