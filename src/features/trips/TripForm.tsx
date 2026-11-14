import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, DateField, Field, Screen, SectionTitle } from '@/components';
import { uploadImage, useBusiness, useBusinessData, useCreateTrip, useUpdateTrip } from '@/data';
import { formatMoney, sumMoney, today } from '@/domain';
import type { Trip } from '@/domain/types';
import { colors } from '@/theme';
import { DraftLinesEditor, newDraftLine } from './DraftLinesEditor';
import { ErrorText, errorMessage } from './ErrorText';
import { isValidDate, parseMoney, readDraftLines, type DraftLine } from './helpers';
import { ReceiptPicker } from './ReceiptPicker';
import { ReceiptReader } from './ReceiptReader';
import { mergeDraftLines } from './receipt';
import { uuid } from '@/lib/uuid';
import { ShopSelect } from './ShopSelect';

export interface TripFormProps {
  /** Present = edit this trip; absent = new trip. */
  trip?: Trip;
  /** New trip: open the camera straight away. */
  autoCamera?: boolean;
}

/** New trip (with quick receipt lines) or edit trip (shop, date, total, receipt). */
export function TripForm({ trip, autoCamera }: TripFormProps) {
  const editing = !!trip;
  const { data } = useBusinessData();
  const { businessId } = useBusiness();
  const create = useCreateTrip();
  const update = useUpdateTrip();

  const [shopId, setShopId] = useState<string | null>(trip?.shopId ?? null);
  const [date, setDate] = useState(trip?.tripDate ?? today());
  const [total, setTotal] = useState(trip ? String(trip.total) : '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [removedSaved, setRemovedSaved] = useState(false);
  // Receipt already uploaded for AI reading; reused on save so it is not uploaded twice.
  const [uploaded, setUploaded] = useState<{ uri: string; path: string } | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([newDraftLine()]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ shop?: string; date?: string; total?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const read = readDraftLines(lines);
  const linesSum = sumMoney(read.lines.map((l) => l.price));
  const totalNum = parseMoney(total);
  const showMismatch = !editing && read.lines.length > 0 && totalNum !== null && Math.abs(linesSum - totalNum) > 0.05;

  const save = async () => {
    const next: typeof errors = {};
    if (!shopId) next.shop = 'Choose the shop.';
    if (!isValidDate(date)) next.date = 'Use DD/MM/YYYY, like 14/11/2026.';
    if (totalNum === null) next.total = 'Enter the total on the receipt.';
    setErrors(next);
    setInvalid(read.invalid);
    if (Object.keys(next).length || read.invalid.length || !shopId || totalNum === null) return;

    setSaving(true);
    setSaveError(null);
    try {
      let receiptPath: string | null | undefined;
      if (photo) {
        if (!businessId) throw new Error('No business yet');
        receiptPath = uploaded && uploaded.uri === photo ? uploaded.path : await uploadImage(photo, businessId, 'receipts');
      } else if (removedSaved) {
        receiptPath = null;
      }
      if (trip) {
        await update.mutateAsync({ id: trip.id, shopId, tripDate: date.trim(), total: totalNum, ...(receiptPath !== undefined ? { receiptPath } : {}) });
        router.back();
      } else {
        const created = await create.mutateAsync({
          shopId,
          tripDate: date.trim(),
          total: totalNum,
          receiptPath: receiptPath ?? null,
          lines: read.lines,
        });
        router.replace(`/trips/${created.id}`);
      }
    } catch (e) {
      setSaveError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Screen
      title={editing ? 'Edit trip' : 'New trip'}
      back
      backLabel={editing ? 'Cancel' : 'Trips'}
      bottomInset
      footer={
        <>
          <ErrorText message={saveError} />
          <Button label={editing ? 'Save changes' : 'Save trip'} onPress={save} loading={saving} style={{ marginBottom: 0 }} />
        </>
      }
    >
      <Card>
        <ShopSelect shops={data.shops} value={shopId} onChange={setShopId} error={errors.shop} />
        <DateField value={date} onChange={setDate} />
        {errors.date ? <ErrorText message={errors.date} /> : null}
        <Field
          label="Total paid"
          prefix="$"
          value={total}
          onChangeText={setTotal}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={errors.total}
          hint={!editing && read.lines.length > 0 ? `Lines so far add up to ${formatMoney(linesSum)}` : undefined}
        />
        <ReceiptPicker
          localUri={photo}
          savedPath={removedSaved ? null : trip?.receiptPath}
          autoCamera={autoCamera && !editing}
          onPick={(uri) => {
            setPhoto(uri);
            setRemovedSaved(uri === null);
          }}
        />
      </Card>

      {!editing && photo ? (
        <ReceiptReader
          key={photo}
          businessId={businessId}
          photoUri={photo}
          uploadedPath={uploaded && uploaded.uri === photo ? uploaded.path : null}
          onUploaded={(path) => setUploaded({ uri: photo, path })}
          shops={data.shops}
          onShopAdded={setShopId}
          onFill={({ shopId: sid, date: d, total: t, result }) => {
            if (sid) setShopId(sid);
            if (d) setDate(d);
            if (t) setTotal(t);
            if (result.lines.length) setLines((cur) => mergeDraftLines(cur, result.lines, uuid));
            setErrors({});
            setInvalid([]);
          }}
        />
      ) : null}

      {!editing ? (
        <>
          <SectionTitle>Receipt lines</SectionTitle>
          <Text style={{ fontSize: 13, color: colors.ink2, marginHorizontal: 4, marginBottom: 10, lineHeight: 18 }}>
            Optional. Add what is on the receipt now, or add lines later from the trip. Price is for the whole line.
          </Text>
          <DraftLinesEditor lines={lines} onChange={setLines} invalid={invalid} />
          {showMismatch ? (
            <Text style={{ fontSize: 13, color: colors.ink2, marginHorizontal: 4, marginBottom: 12 }}>
              Lines add up to {formatMoney(linesSum)}; receipt says {formatMoney(totalNum ?? 0)}. You can still save and fix it later.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
