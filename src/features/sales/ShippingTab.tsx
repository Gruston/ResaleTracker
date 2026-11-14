import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, KV, Sheet, SheetOption } from '@/components';
import { removeImage, uploadImage, useBusiness, useBusinessData, useMarkPosted, useSignedUrl, useUpdateOrder } from '@/data';
import { formatDate, formatMoney, saleForItem } from '@/domain';
import { colors } from '@/theme';
import { ItemGate } from './ui';

type SheetKind = null | 'tracking' | 'post' | 'photo';

/** The Shipping tab of the item detail page. */
export function ShippingTab({ itemId }: { itemId: string }) {
  const { data, isLoading } = useBusinessData();
  const { businessId } = useBusiness();
  const updateOrder = useUpdateOrder();
  const markPosted = useMarkPosted();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [tracking, setTracking] = useState('');
  const [uploading, setUploading] = useState(false);

  const item = data.items.find((i) => i.id === itemId);
  const sale = item ? saleForItem(data, itemId) : null;
  const receiptUrl = useSignedUrl(sale?.order.postageReceiptPath);

  if (!item) return <ItemGate loading={isLoading} missing={!isLoading} />;
  if (!sale) {
    return (
      <Card>
        <Text style={styles.muted}>Shipping details appear once the item sells.</Text>
      </Card>
    );
  }

  const { order } = sale;
  const combined = order.items.length > 1;
  const posted = !!order.postedDate;
  const fail = (title: string) => (e: Error) => Alert.alert(title, e.message);

  const openTracking = () => {
    setTracking(order.trackingNo ?? '');
    setSheet('tracking');
  };
  const openPost = () => {
    setTracking(order.trackingNo ?? '');
    setSheet('post');
  };

  const saveTracking = () => {
    updateOrder.mutate(
      { orderId: order.id, patch: { trackingNo: tracking.trim() || null } },
      { onSuccess: () => setSheet(null), onError: fail('Could not save the tracking number') },
    );
  };

  const post = () => {
    markPosted.mutate(
      { orderId: order.id, trackingNo: tracking.trim() || order.trackingNo },
      { onSuccess: () => setSheet(null), onError: fail('Could not mark as posted') },
    );
  };

  const pick = async (source: 'camera' | 'library') => {
    setSheet(null);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera is off', 'Allow camera access in Settings to photograph the receipt.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      }
      if (result.canceled || !result.assets[0]) return;
      if (!businessId) throw new Error('No business yet');
      setUploading(true);
      const path = await uploadImage(result.assets[0].uri, businessId, 'postage');
      const previous = order.postageReceiptPath;
      await updateOrder.mutateAsync({ orderId: order.id, patch: { postageReceiptPath: path } });
      if (previous) void removeImage(previous);
    } catch (e) {
      Alert.alert('Could not save the photo', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      <Card>
        <KV
          label="Postage label"
          value={`${formatMoney(order.postage)} via eBay${combined ? ` (${order.items.length} items)` : ''}`}
        />
        <KV label="Tracking no." value={order.trackingNo ?? (posted ? 'Not entered' : 'Not posted yet')} />
        <KV label="Posted" value={order.postedDate ? formatDate(order.postedDate) : 'Not posted yet'} last />
      </Card>

      <View style={styles.actions}>
        <Button
          label={order.trackingNo ? 'Edit tracking no.' : 'Add tracking no.'}
          variant="secondary"
          size="small"
          onPress={openTracking}
        />
      </View>

      <Card>
        <Text style={styles.heading} accessibilityRole="header">
          Postage receipt
        </Text>
        {order.postageReceiptPath ? (
          receiptUrl ? (
            <Image
              source={{ uri: receiptUrl }}
              style={styles.receipt}
              contentFit="cover"
              accessibilityLabel="Postage receipt photo"
            />
          ) : (
            <Text style={styles.muted}>Photo saved. It will show when you are back online.</Text>
          )
        ) : (
          <Text style={styles.muted}>No photo yet.</Text>
        )}
        <View style={{ marginTop: 10 }}>
          <Button
            label={order.postageReceiptPath ? 'Replace photo' : 'Add receipt photo'}
            variant="secondary"
            size="small"
            loading={uploading}
            onPress={() => setSheet('photo')}
          />
        </View>
      </Card>

      {!posted ? <Button label="Mark as posted" onPress={openPost} /> : null}

      <Sheet visible={sheet === 'tracking'} onClose={() => setSheet(null)} title="Tracking number">
        <Field
          label="Tracking no."
          value={tracking}
          onChangeText={setTracking}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
        />
        <Button label="Save" loading={updateOrder.isPending} onPress={saveTracking} />
        <Button label="Cancel" variant="secondary" onPress={() => setSheet(null)} />
      </Sheet>

      <Sheet visible={sheet === 'post'} onClose={() => setSheet(null)} title="Mark as posted">
        <Text style={[styles.muted, { marginBottom: 12 }]}>
          {combined ? 'This marks every item in the order as posted. ' : ''}You can add the tracking number now or later.
        </Text>
        <Field
          label="Tracking no. (optional)"
          value={tracking}
          onChangeText={setTracking}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
        />
        <Button label="Mark as posted" loading={markPosted.isPending} onPress={post} />
        <Button label="Cancel" variant="secondary" onPress={() => setSheet(null)} />
      </Sheet>

      <Sheet visible={sheet === 'photo'} onClose={() => setSheet(null)} title="Postage receipt photo">
        <SheetOption label="Take a photo" onPress={() => void pick('camera')} />
        <SheetOption label="Choose from library" onPress={() => void pick('library')} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
  heading: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  actions: { marginTop: -4, marginBottom: 12 },
  receipt: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#EFEBE5' },
});
