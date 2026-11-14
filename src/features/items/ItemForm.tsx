import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Callout,
  Card,
  DateField,
  EmptyState,
  Field,
  Icon,
  Screen,
  Segmented,
  Select,
  Sheet,
  Thumb,
} from '@/components';
import {
  uploadImage,
  useAddItemPhoto,
  useBusiness,
  useBusinessData,
  useCreateItem,
  useDeleteItem,
  useRemoveItemPhoto,
  useUpdateItem,
  useUpsertShop,
} from '@/data';
import { buyerSeesAbout, formatDate, formatMoney, storageFor, today, youGetAbout } from '@/domain';
import { skuPrefix } from '@/domain';
import { colors } from '@/theme';
import {
  DEPARTMENTS,
  TITLE_MAX,
  buildItemPatch,
  buildNewItemInput,
  emptyForm,
  formFromItem,
  formFromReceiptParams,
  hasErrors,
  isWardrobe,
  itemTypeOptions,
  parseMoney,
  pricing,
  skuPreview,
  validateForm,
  type ItemFormState,
  type PhotoDraft,
} from './form';
import { AiListingButton } from './AiListingButton';
import { applySuggestion } from './ai';
import { pageStyle } from './layout';

export interface ItemFormParams {
  tripId?: string;
  tripLineId?: string;
  shopId?: string;
  cost?: string;
  brand?: string;
}

const DEPT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: d }));
let tempKey = 0;

export function ItemForm({ itemId, params = {} }: { itemId?: string; params?: ItemFormParams }) {
  const { data, isLoading } = useBusinessData();
  const existing = itemId ? data.items.find((i) => i.id === itemId) : undefined;
  if (itemId && !existing) {
    return (
      <Screen title="Edit item" back backLabel="Back" bottomInset contentStyle={pageStyle}>
        <EmptyState title={isLoading ? 'Loading item' : 'Item not found'} />
      </Screen>
    );
  }
  return <FormBody existing={existing} params={params} />;
}

function FormBody({ existing, params }: { existing?: NonNullable<ReturnType<typeof useBusinessData>['data']['items'][number]>; params: ItemFormParams }) {
  const { data } = useBusinessData();
  const { businessId } = useBusiness();
  const create = useCreateItem();
  const update = useUpdateItem();
  const del = useDeleteItem();
  const addPhoto = useAddItemPhoto();
  const removePhoto = useRemoveItemPhoto();
  const upsertShop = useUpsertShop();
  const { settings, shops, skuCodes } = data;
  const types = useMemo(() => itemTypeOptions(skuCodes), [skuCodes]);
  const todayStr = useMemo(() => today(), []);
  const trip = params.tripId ? data.trips.find((t) => t.id === params.tripId) : undefined;

  const [f, setF] = useState<ItemFormState>(() =>
    existing ? formFromItem(existing, settings) : formFromReceiptParams(emptyForm(settings, types), params),
  );
  const [shake, setShake] = useState(false); // show errors after first failed save
  const [saving, setSaving] = useState(false);
  const uploadedByKey = useRef<Record<string, string>>({}); // photos already uploaded for the AI, so save does not repeat them
  const [photoSheet, setPhotoSheet] = useState(false);
  const [shopSheet, setShopSheet] = useState(false);
  const [newShop, setNewShop] = useState('');

  const set = <K extends keyof ItemFormState>(k: K, v: ItemFormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const [listedBad, setListedBad] = useState(false);
  const errors = { ...validateForm(f), ...(listedBad ? { listedDate: 'Use DD/MM/YYYY, like 14/11/2026' } : {}) };
  const shown = shake ? errors : {};
  const wardrobe = isWardrobe(shops, f.shopId);
  const prefix = skuPrefix(f.department, f.itemType, skuCodes);
  const storeAt = storageFor(existing ? existing.sku : prefix, data.storage);
  const p = pricing(f, settings, todayStr);
  const shopOptions = shops.filter((s) => !s.archived || s.id === f.shopId).map((s) => ({ value: s.id, label: s.name }));
  const receiptShop = params.shopId ? shops.find((s) => s.id === params.shopId)?.name : undefined;
  const receiptCost = params.cost != null && params.cost !== '' ? parseMoney(params.cost) : null;

  const pick = async (source: 'camera' | 'library') => {
    setPhotoSheet(false);
    try {
      let res: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera access needed', 'Allow camera access in Settings to take photos.');
          return;
        }
        res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 12, quality: 1 });
      }
      if (res.canceled) return;
      const added: PhotoDraft[] = res.assets.map((a) => ({ key: `new-${++tempKey}`, path: a.uri, existing: false }));
      setF((prev) => ({ ...prev, photos: [...prev.photos, ...added] }));
    } catch (e) {
      Alert.alert('Could not add photo', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const removeAt = (key: string) => setF((prev) => ({ ...prev, photos: prev.photos.filter((x) => x.key !== key) }));

  const onShop = (id: string) => {
    setF((prev) => ({ ...prev, shopId: id, costText: isWardrobe(shops, id) ? '0' : prev.costText }));
  };

  const saveShop = async () => {
    const name = newShop.trim();
    if (!name) return;
    try {
      const shop = await upsertShop.mutateAsync({ name });
      onShop(shop.id);
      setNewShop('');
      setShopSheet(false);
    } catch (e) {
      Alert.alert('Could not add shop', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const save = async () => {
    if (hasErrors(errors)) {
      setShake(true);
      return;
    }
    if (!businessId) return;
    setSaving(true);
    try {
      const newOnes = f.photos.filter((x) => !x.existing);
      const uploaded: string[] = [];
      for (const ph of newOnes) uploaded.push(uploadedByKey.current[ph.key] ?? (await uploadImage(ph.path, businessId, 'items')));
      if (existing) {
        await update.mutateAsync({ id: existing.id, patch: buildItemPatch(f, existing, shops, settings, todayStr) });
        const keep = new Set(f.photos.filter((x) => x.existing).map((x) => x.key));
        for (const old of existing.photos) if (!keep.has(old.id)) await removePhoto.mutateAsync({ itemId: existing.id, photoId: old.id });
        for (const path of uploaded) await addPhoto.mutateAsync({ itemId: existing.id, path });
        router.back();
      } else {
        const keptPaths = f.photos.filter((x) => x.existing).map((x) => x.path);
        const created = await create.mutateAsync({
          item: buildNewItemInput(f, {
            shops,
            settings,
            today: todayStr,
            tripId: params.tripId || null,
            tripLineId: params.tripLineId || null,
            purchaseDate: trip?.tripDate ?? null,
          }),
          photoPaths: [...keptPaths, ...uploaded],
        });
        router.replace({ pathname: '/items/[id]', params: { id: created.id } });
      }
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(
      'Delete this item?',
      `${existing.sku} and its photos${existing.status === 'sold' || existing.status === 'posted' ? ' and sale details' : ''} will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete item',
          style: 'destructive',
          onPress: async () => {
            try {
              await del.mutateAsync(existing.id);
              router.dismissTo('/items');
            } catch (e) {
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <Screen
      title={existing ? 'Edit item' : 'New item'}
      back
      backLabel="Cancel"
      bottomInset
      contentStyle={pageStyle}
      footer={
        <View style={pageStyle}>
          <Button label={existing ? 'Save changes' : 'Save item'} onPress={save} loading={saving} style={{ marginBottom: 0 }} />
        </View>
      }
    >
      <View style={styles.photos} accessibilityLabel={`${f.photos.length} photos`}>
        {f.photos.map((ph, i) => (
          <View key={ph.key} style={styles.photoWrap}>
            <Thumb path={ph.path} label={f.brand || 'Photo'} size={88} radius={12} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              onPress={() => removeAt(ph.key)}
              hitSlop={10}
              style={styles.remove}
            >
              <Icon name="close" size={14} color="#fff" strokeWidth={2.4} />
            </Pressable>
          </View>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Add photos" onPress={() => setPhotoSheet(true)} style={styles.addPhoto}>
          <Icon name="camera" size={26} color={colors.ink2} />
          <Text style={styles.addPhotoText}>Add photos</Text>
        </Pressable>
      </View>

      <Card tone="accent">
        <View style={styles.skuRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.skuLine}>
              <Text style={{ fontWeight: '700' }}>SKU </Text>
              {existing ? existing.sku : skuPreview(f.department, f.itemType, skuCodes)}
            </Text>
            {!existing ? <Text style={styles.muted}>Next number assigned on save</Text> : null}
            <Text style={styles.muted}>Store in: {storeAt}</Text>
          </View>
          {receiptCost != null || receiptShop ? (
            <Text style={[styles.muted, { textAlign: 'right', flexShrink: 1 }]}>
              From receipt: {receiptShop ?? 'Unknown shop'}
              {receiptCost != null ? ` · ${formatMoney(receiptCost)}` : ''}
            </Text>
          ) : null}
        </View>
      </Card>

      <Field label="Brand" value={f.brand} onChangeText={(v) => set('brand', v)} placeholder="e.g. Country Road" autoCapitalize="words" />
      <Text style={styles.label}>Department</Text>
      <Segmented options={DEPT_OPTIONS} value={f.department} onChange={(v) => set('department', v)} />
      <Select
        label="Item type"
        value={f.itemType}
        options={types.map((t) => ({ value: t, label: t }))}
        onChange={(v) => set('itemType', v)}
        placeholder="Choose type"
      />
      <Field label="Size" value={f.size} onChangeText={(v) => set('size', v)} placeholder="e.g. 10, M, US 8" autoCapitalize="characters" />

      <Select
        label="Bought from"
        value={f.shopId}
        options={shopOptions}
        onChange={onShop}
        placeholder="Choose shop"
        onClear={() => set('shopId', null)}
        clearLabel="Not recorded"
        onAddNew={() => setTimeout(() => setShopSheet(true), 320)}
        addNewLabel="+ Add new shop"
      />
      <Field
        label="What you paid ($)"
        value={wardrobe ? '0' : f.costText}
        onChangeText={(v) => set('costText', v)}
        editable={!wardrobe}
        keyboardType="decimal-pad"
        prefix="$"
        error={shown.cost}
        hint={wardrobe ? 'From My wardrobe: cost is set to $0.' : 'Leave blank if you do not know yet.'}
      />
      {wardrobe ? <Callout>This item came from your own wardrobe, so its cost is $0 and all of the sale is profit.</Callout> : null}

      <AiListingButton form={f} uploaded={uploadedByKey} onUse={(listing, price, mode) => setF((prev) => applySuggestion(prev, listing, price, mode))} />
      <Field
        label="Title"
        value={f.title}
        onChangeText={(v) => set('title', v.slice(0, TITLE_MAX))}
        maxLength={TITLE_MAX}
        hint={`${f.title.length}/${TITLE_MAX}`}
        placeholder="eBay listing title"
      />
      <Field label="Description" value={f.description} onChangeText={(v) => set('description', v)} multiline placeholder="Condition, measurements, details" />

      <View style={styles.pair}>
        <Field style={{ flex: 1 }} label="Your listing price ($)" value={f.priceText} onChangeText={(v) => set('priceText', v)} keyboardType="decimal-pad" prefix="$" error={shown.price} />
        <Field style={{ flex: 1 }} label="Ad rate (%)" value={f.adText} onChangeText={(v) => set('adText', v)} keyboardType="decimal-pad" suffix="%" error={shown.ad} />
      </View>
      {p.hasPrice && p.firstListPrice != null ? (
        <Card tone="accent">
          <View style={styles.pair}>
            <View style={{ flex: 1 }} accessible accessibilityLabel={`You get about ${formatMoney(youGetAbout(p.firstListPrice, p.adRate, settings))}`}>
              <Text style={styles.muted}>You get about</Text>
              <Text style={styles.big}>{formatMoney(youGetAbout(p.firstListPrice, p.adRate, settings))}</Text>
            </View>
            <View style={{ flex: 1 }} accessible accessibilityLabel={`Buyer sees about ${formatMoney(buyerSeesAbout(p.firstListPrice, settings))}`}>
              <Text style={styles.muted}>Buyer sees about</Text>
              <Text style={styles.big}>{formatMoney(buyerSeesAbout(p.firstListPrice, settings))}</Text>
            </View>
          </View>
          <Text style={[styles.muted, { marginTop: 6 }]}>
            You get: your price minus the ad fee. Buyer sees: your price plus buyer protection and postage.
          </Text>
        </Card>
      ) : null}
      <DateField
        label="Date listed"
        value={f.listedDate}
        onChange={(v) => set('listedDate', v)}
        optional
        onValidChange={(ok) => setListedBad(!ok)}
        error={shown.listedDate}
        hint={p.hasPrice ? `Defaults to today (${formatDate(todayStr)}).` : 'Without a price this is saved as a draft.'}
      />

      {existing ? <Button label="Delete item" variant="danger" onPress={confirmDelete} loading={del.isPending} style={{ marginTop: 12 }} /> : null}

      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Add photos">
        <PhotoOption label="Take a photo" onPress={() => pick('camera')} />
        <PhotoOption label="Choose from library" onPress={() => pick('library')} />
      </Sheet>
      <Sheet visible={shopSheet} onClose={() => setShopSheet(false)} title="New shop">
        <Field label="Shop name" value={newShop} onChangeText={setNewShop} placeholder="e.g. Salvos Marrickville" autoCapitalize="words" />
        <Button label="Add shop" onPress={saveShop} loading={upsertShop.isPending} disabled={!newShop.trim()} />
      </Sheet>
    </Screen>
  );
}

function PhotoOption({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.opt}>
      <Text style={styles.optText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  photoWrap: { width: 88, height: 88 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#EFEBE5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: { fontSize: 12, fontWeight: '500', color: colors.ink2 },
  skuRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  skuLine: { fontSize: 15, color: colors.ink },
  muted: { fontSize: 13, color: colors.ink2 },
  label: { fontSize: 13, color: colors.ink2, marginBottom: 5, fontWeight: '500' },
  pair: { flexDirection: 'row', gap: 12 },
  big: { fontSize: 20, fontWeight: '700', color: colors.ink },
  opt: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 8,
  },
  optText: { fontSize: 15, color: colors.ink },
});
