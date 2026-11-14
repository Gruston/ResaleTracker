import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Sheet, SheetOption } from '@/components';
import { useDeleteTripLine, useSplitTripLine, useUpsertTripLine } from '@/data';
import { formatMoney, round2 } from '@/domain';
import type { LineOutcome, Trip, TripLine } from '@/domain/types';
import { colors } from '@/theme';
import { ErrorText, errorMessage } from './ErrorText';
import { brandGuess, lineHeading, perEach } from './helpers';
import { LineFields, readLineFields, type LineFieldValues } from './LineFields';

/** What the trip screen's single bottom sheet is showing. */
export type SheetState =
  | { kind: 'outcome'; lineId: string }
  | { kind: 'editLine'; lineId: string }
  | { kind: 'addLine' }
  | { kind: 'deleteLine'; lineId: string }
  | { kind: 'deleteTrip' }
  | { kind: 'receipt' };

const OUTCOMES: { outcome: LineOutcome; label: string }[] = [
  { outcome: 'family', label: 'For family' },
  { outcome: 'keeping', label: 'Keeping for myself' },
  { outcome: 'faulty', label: 'Faulty / thrown out' },
  { outcome: 'to_list', label: 'Not sorted yet' },
];

export interface TripSheetsProps {
  trip: Trip;
  active: SheetState | null;
  setActive: (s: SheetState | null) => void;
  onDeleteTrip: () => Promise<void>;
  receiptUrl: string | null;
}

/** One Sheet whose content changes with `active`, so moving between steps never stacks two modals. */
export function TripSheets({ trip, active, setActive, onDeleteTrip, receiptUrl }: TripSheetsProps) {
  const line = active && 'lineId' in active ? trip.lines.find((l) => l.id === active.lineId) : undefined;
  const close = () => setActive(null);
  // Let the sheet slide away before pushing a new screen over it.
  const closeThen = (fn: () => void) => {
    setActive(null);
    setTimeout(fn, 260);
  };

  let title: string | undefined;
  let body: ReactNode = null;
  if (active?.kind === 'outcome' && line) {
    title = `${lineHeading(line)} · ${formatMoney(line.price)}`;
    body = <OutcomeBody trip={trip} line={line} setActive={setActive} close={close} closeThen={closeThen} />;
  } else if (active?.kind === 'editLine' && line) {
    title = 'Edit line';
    body = <EditLineBody key={line.id} tripId={trip.id} line={line} close={close} />;
  } else if (active?.kind === 'addLine') {
    title = 'Add a line';
    body = <EditLineBody tripId={trip.id} close={close} />;
  } else if (active?.kind === 'deleteLine' && line) {
    title = 'Delete this line?';
    body = <DeleteLineBody line={line} close={close} />;
  } else if (active?.kind === 'deleteTrip') {
    title = 'Delete this trip?';
    body = <DeleteTripBody trip={trip} onDelete={onDeleteTrip} close={close} />;
  } else if (active?.kind === 'receipt') {
    title = 'Receipt';
    body = <ReceiptBody url={receiptUrl} />;
  }

  return (
    <Sheet visible={!!active && body !== null} onClose={close} title={title}>
      {body}
    </Sheet>
  );
}

function OutcomeBody({
  trip,
  line,
  setActive,
  close,
  closeThen,
}: {
  trip: Trip;
  line: TripLine;
  setActive: (s: SheetState | null) => void;
  close: () => void;
  closeThen: (fn: () => void) => void;
}) {
  const upsert = useUpsertTripLine();
  const split = useSplitTripLine();
  const [error, setError] = useState<string | null>(null);

  const setOutcome = async (outcome: LineOutcome) => {
    setError(null);
    try {
      await upsert.mutateAsync({
        id: line.id,
        tripId: trip.id,
        description: line.description,
        qty: line.qty,
        price: line.price,
        outcome,
      });
      close();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const doSplit = async () => {
    setError(null);
    try {
      await split.mutateAsync({ lineId: line.id, tripId: trip.id });
      close();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const createItem = () =>
    closeThen(() =>
      router.push({
        pathname: '/items/new',
        params: {
          tripId: trip.id,
          tripLineId: line.id,
          cost: String(round2(perEach(line))),
          ...(trip.shopId ? { shopId: trip.shopId } : {}),
          brand: brandGuess(line.description),
        },
      }),
    );

  return (
    <View>
      {line.qty > 1 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Split into ${line.qty} lines at ${formatMoney(line.price / line.qty)} each`}
            onPress={doSplit}
            disabled={split.isPending}
            style={({ pressed }) => [styles.split, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.splitText}>
              Split into {line.qty} lines at {formatMoney(line.price / line.qty)} each
            </Text>
          </Pressable>
          <Text style={styles.helper}>Split first so each piece can be listed, given or kept on its own.</Text>
        </>
      ) : null}
      {line.itemId ? (
        <SheetOption
          label="Open listed item"
          icon={<Icon name="items" size={20} />}
          onPress={() => closeThen(() => router.push(`/items/${line.itemId}`))}
        />
      ) : (
        <SheetOption label="Create item to list" icon={<Icon name="items" size={20} />} onPress={createItem} />
      )}
      {OUTCOMES.map((o) => (
        <SheetOption key={o.outcome} label={o.label} selected={line.outcome === o.outcome} onPress={() => setOutcome(o.outcome)} />
      ))}
      <ErrorText message={error} />
      <View style={styles.footer}>
        <Button label="Edit line" variant="secondary" size="small" onPress={() => setActive({ kind: 'editLine', lineId: line.id })} />
        <Button label="Delete line" variant="danger" size="small" onPress={() => setActive({ kind: 'deleteLine', lineId: line.id })} />
      </View>
    </View>
  );
}

function EditLineBody({ tripId, line, close }: { tripId: string; line?: TripLine; close: () => void }) {
  const upsert = useUpsertTripLine();
  const [values, setValues] = useState<LineFieldValues>({
    description: line?.description ?? '',
    qty: String(line?.qty ?? 1),
    price: line ? String(line.price) : '',
  });
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const r = readLineFields(values);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    setError(null);
    try {
      await upsert.mutateAsync({ id: line?.id, tripId, ...r });
      close();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <View>
      <LineFields values={values} onChange={setValues} autoFocus={!line} />
      <ErrorText message={error} />
      <Button label={line ? 'Save line' : 'Add line'} onPress={save} loading={upsert.isPending} />
      <Button label="Cancel" variant="secondary" onPress={close} />
    </View>
  );
}

function DeleteLineBody({ line, close }: { line: TripLine; close: () => void }) {
  const del = useDeleteTripLine();
  const [error, setError] = useState<string | null>(null);
  return (
    <View>
      <Text style={styles.helper}>
        {lineHeading(line)} will be removed from this receipt.
        {line.itemId ? ' The item you created from it stays in Items.' : ''}
      </Text>
      <ErrorText message={error} />
      <Button
        label="Delete line"
        variant="danger"
        loading={del.isPending}
        onPress={async () => {
          try {
            await del.mutateAsync(line.id);
            close();
          } catch (e) {
            setError(errorMessage(e));
          }
        }}
      />
      <Button label="Keep it" variant="secondary" onPress={close} />
    </View>
  );
}

function DeleteTripBody({ trip, onDelete, close }: { trip: Trip; onDelete: () => Promise<void>; close: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <View>
      <Text style={styles.helper}>
        This removes the trip and its {trip.lines.length} receipt {trip.lines.length === 1 ? 'line' : 'lines'}. Items you bought on it stay in Items. This cannot be undone.
      </Text>
      <ErrorText message={error} />
      <Button
        label="Delete trip"
        variant="danger"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onDelete();
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        }}
      />
      <Button label="Keep trip" variant="secondary" onPress={close} />
    </View>
  );
}

function ReceiptBody({ url }: { url: string | null }) {
  return url ? (
    <Image source={{ uri: url }} style={styles.receipt} contentFit="contain" accessibilityLabel="Receipt photo" />
  ) : (
    <Text style={styles.helper}>The receipt photo is not available right now.</Text>
  );
}

const styles = StyleSheet.create({
  split: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 8,
  },
  splitText: { fontSize: 15, color: colors.ink },
  helper: { fontSize: 13, color: colors.ink2, lineHeight: 18, marginHorizontal: 2, marginBottom: 12 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 6 },
  receipt: { width: '100%', height: 420, borderRadius: 12, backgroundColor: '#EFEBE5' },
});
