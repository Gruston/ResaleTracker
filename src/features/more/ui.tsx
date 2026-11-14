// Small shared pieces for the More screens.
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Icon, Sheet } from '@/components';
import { useSignedUrl } from '@/data';
import { addDays, formatDate, today } from '@/domain/dates';
import { colors, radius } from '@/theme';
import { isValidDate } from './forms';

/** Red/orange error line under a form. Announced to screen readers. */
export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

/** Muted explanatory paragraph. */
export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

/** Card heading text. */
export function CardTitle({ children }: { children: string }) {
  return (
    <Text style={styles.cardTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** Bottom-sheet confirmation: message, a red confirm button and a cancel button. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onCancel} title={title}>
      <Text style={styles.sheetMessage}>{message}</Text>
      <ErrorText>{error}</ErrorText>
      <Button label={confirmLabel} variant="danger" loading={busy} onPress={onConfirm} />
      <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
    </Sheet>
  );
}

/** Date typed as YYYY-MM-DD with day-step and Today buttons (no native date picker needed). */
export function DateField({ label = 'Date', value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
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
      <View style={styles.wrapRow}>
        <Button label="Earlier" accessibilityLabel="One day earlier" variant="secondary" size="small" onPress={() => step(-1)} />
        <Button label="Later" accessibilityLabel="One day later" variant="secondary" size="small" onPress={() => step(1)} />
        <Button label="Today" variant="secondary" size="small" onPress={() => onChange(today())} />
      </View>
    </View>
  );
}

const PICK: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };

/** Optional receipt photo: camera or library, with preview. `savedPath` is shown when there is no new local photo. */
export function ReceiptPhoto({
  localUri,
  savedPath,
  onPick,
}: {
  localUri: string | null;
  savedPath?: string | null;
  onPick: (uri: string | null) => void;
}) {
  const saved = useSignedUrl(localUri ? null : savedPath);
  const shown = localUri ?? saved;
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<ImagePicker.ImagePickerResult>, failTitle: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.canceled && res.assets[0]) onPick(res.assets[0].uri);
    } catch {
      Alert.alert(failTitle, 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera is off', 'Allow camera access in Settings to photograph a receipt, or choose a photo instead.');
      return;
    }
    await run(() => ImagePicker.launchCameraAsync(PICK), 'Could not open the camera');
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>Receipt photo (optional)</Text>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
        <View style={styles.preview} accessibilityLabel={shown ? 'Receipt photo' : 'No receipt photo yet'}>
          {shown ? <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="camera" size={24} color={colors.ink2} />}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Button label={shown ? 'Retake photo' : 'Take photo'} variant="secondary" size="small" disabled={busy} onPress={camera} />
          <Button
            label="Choose from photos"
            variant="secondary"
            size="small"
            disabled={busy}
            onPress={() => run(() => ImagePicker.launchImageLibraryAsync(PICK), 'Could not open your photos')}
          />
          {shown ? <Button label="Remove photo" variant="secondary" size="small" onPress={() => onPick(null)} /> : null}
        </View>
      </View>
    </View>
  );
}

/** A card-style pressable row used where Row's fixed layout is not enough. */
export function PressableCard({ onPress, label, children }: { onPress: () => void; label: string; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.pcard, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 13, color: colors.warn, marginBottom: 10, lineHeight: 18 },
  note: { fontSize: 13, color: colors.ink2, lineHeight: 19, marginHorizontal: 4, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  sheetMessage: { fontSize: 15, color: colors.ink, lineHeight: 21, marginBottom: 14 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldLabel: { fontSize: 13, color: colors.ink2, marginBottom: 5, fontWeight: '500' },
  preview: {
    width: 72,
    height: 96,
    borderRadius: radius.control,
    backgroundColor: '#EFEBE5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pcard: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 12 },
});
