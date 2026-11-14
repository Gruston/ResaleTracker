import { forwardRef, type ElementRef, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** small text under the input */
  hint?: string;
  error?: string | null;
  /** text shown inside the box before the value, e.g. "$" */
  prefix?: string;
  suffix?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Labelled text input (16pt text so iOS does not zoom). */
export const Field = forwardRef<ElementRef<typeof TextInput>, FieldProps>(function Field(
  { label, hint, error, prefix, suffix, right, style, multiline, ...input },
  ref,
) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.box, multiline && styles.multiline, error ? { borderColor: colors.warn } : null]}>
        {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          multiline={multiline}
          placeholderTextColor="#A39E96"
          accessibilityLabel={input.accessibilityLabel ?? label}
          style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]}
          {...input}
        />
        {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: colors.ink2, marginBottom: 5, fontWeight: '500' },
  box: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    gap: 4,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: 4 },
  input: { flex: 1, fontSize: 16, color: colors.ink, minHeight: 44, paddingVertical: 8 },
  affix: { fontSize: 16, color: colors.ink2 },
  hint: { fontSize: 12, color: colors.ink2, marginTop: 4 },
  error: { fontSize: 12, color: colors.warn, marginTop: 4 },
});
