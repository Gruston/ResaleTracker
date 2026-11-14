import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Icon } from '@/components';
import { useSignedUrl } from '@/data';
import { colors, radius } from '@/theme';

export interface ReceiptPickerProps {
  /** A local file uri picked in this form (not yet uploaded). */
  localUri: string | null;
  /** The already saved receipt path (shown until a new photo is picked). */
  savedPath?: string | null;
  onPick: (uri: string | null) => void;
  /** Open the camera as soon as the form appears (the "scan receipt" shortcut). */
  autoCamera?: boolean;
}

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };

/** Receipt photo: take one with the camera or choose from the library, with a preview. */
export function ReceiptPicker({ localUri, savedPath, onPick, autoCamera }: ReceiptPickerProps) {
  const savedUrl = useSignedUrl(localUri ? null : savedPath);
  const shown = localUri ?? savedUrl;
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const camera = async () => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera is off', 'Allow camera access in Settings to photograph a receipt, or choose a photo instead.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync(OPTIONS);
      if (!res.canceled && res.assets[0]) onPick(res.assets[0].uri);
    } catch {
      Alert.alert('Could not open the camera', 'Try choosing a photo instead.');
    } finally {
      setBusy(false);
    }
  };

  const library = async () => {
    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync(OPTIONS);
      if (!res.canceled && res.assets[0]) onPick(res.assets[0].uri);
    } catch {
      Alert.alert('Could not open your photos', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (autoCamera && !started.current) {
      started.current = true;
      void camera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCamera]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Receipt photo (optional)</Text>
      <View style={styles.row}>
        <View style={styles.preview} accessibilityLabel={shown ? 'Receipt photo' : 'No receipt photo yet'}>
          {shown ? (
            <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Icon name="trips" size={24} color={colors.ink2} />
          )}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Button
            label={shown ? 'Retake photo' : 'Take photo'}
            variant="secondary"
            size="small"
            icon={<Icon name="camera" size={18} color={colors.accent} />}
            onPress={camera}
            disabled={busy}
          />
          <Button label="Choose from photos" variant="secondary" size="small" onPress={library} disabled={busy} />
          {shown ? <Button label="Remove photo" variant="secondary" size="small" onPress={() => onPick(null)} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, color: colors.ink2, marginBottom: 5, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  preview: {
    width: 72,
    height: 96,
    borderRadius: radius.control,
    backgroundColor: '#EFEBE5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
