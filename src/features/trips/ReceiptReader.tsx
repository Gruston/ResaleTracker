import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Icon } from '@/components';
import { uploadImage, useUpsertShop } from '@/data';
import { aiReceipt } from '@/data/ai';
import { today } from '@/domain/dates';
import type { AiReceiptResult } from '@/domain/ai';
import type { Shop } from '@/domain/types';
import { colors } from '@/theme';
import { ErrorText, errorMessage } from './ErrorText';
import {
  checkReceipt,
  friendlyReceiptError,
  matchShop,
  mismatchText,
  resultHasContent,
  sanitiseReceiptDate,
  summaryText,
  type FriendlyReceiptError,
  type ReceiptCheck,
} from './receipt';

export interface ReceiptReaderProps {
  businessId: string | null;
  /** The receipt photo chosen in this form (local uri). */
  photoUri: string;
  /** Storage path already uploaded for this photo, if any. */
  uploadedPath: string | null;
  onUploaded: (path: string) => void;
  shops: Shop[];
  /** Fill the form. Only the fields that were read are present. */
  onFill: (fill: { shopId?: string; date?: string; total?: string; result: AiReceiptResult }) => void;
  onShopAdded: (shopId: string) => void;
}

type Phase = { name: 'idle' } | { name: 'reading' } | { name: 'error'; error: FriendlyReceiptError } | { name: 'done'; check: ReceiptCheck; newShop: string | null; note: string | null };

/** "Read this receipt with AI" on the New trip form: uploads the photo, reads it, prefills the form for Kat to check. */
export function ReceiptReader({ businessId, photoUri, uploadedPath, onUploaded, shops, onFill, onShopAdded }: ReceiptReaderProps) {
  const qc = useQueryClient();
  const upsertShop = useUpsertShop();
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [shopError, setShopError] = useState<string | null>(null);

  const read = async () => {
    if (!businessId) {
      setPhase({ name: 'error', error: { message: 'Your business is still loading. Try again in a moment.', retry: true } });
      return;
    }
    setPhase({ name: 'reading' });
    setShopError(null);
    try {
      let path = uploadedPath;
      if (!path) {
        path = await uploadImage(photoUri, businessId, 'receipts');
        onUploaded(path);
      }
      const result = await aiReceipt({ businessId, receiptPath: path });
      if (!resultHasContent(result)) {
        setPhase({ name: 'error', error: { message: 'Could not find anything on that receipt. Try a clearer, flatter photo, or type it in yourself.', retry: true } });
        return;
      }
      const matched = matchShop(result.shop, shops);
      const date = sanitiseReceiptDate(result.date, today());
      const check = checkReceipt(result.lines, result.total);
      onFill({
        shopId: matched?.id,
        date: date ?? undefined,
        total: result.total !== undefined ? result.total.toFixed(2) : undefined,
        result,
      });
      const note = result.date && !date ? 'The date on the receipt looked wrong, so it was left as it is.' : null;
      setPhase({ name: 'done', check, newShop: !matched && result.shop ? result.shop : null, note });
    } catch (e) {
      setPhase({ name: 'error', error: friendlyReceiptError(e) });
    } finally {
      void qc.invalidateQueries({ queryKey: ['ai-usage'] });
    }
  };

  const addShop = async (name: string) => {
    setShopError(null);
    try {
      const shop = await upsertShop.mutateAsync({ name });
      onShopAdded(shop.id);
      setPhase((p) => (p.name === 'done' ? { ...p, newShop: null } : p));
    } catch (e) {
      setShopError(errorMessage(e, 'Could not add the shop.'));
    }
  };

  if (phase.name === 'reading') {
    return (
      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.reading} accessibilityLiveRegion="polite">
          Reading your receipt… about 10 seconds
        </Text>
      </Card>
    );
  }

  if (phase.name === 'done') {
    const warning = mismatchText(phase.check);
    return (
      <Card style={[{ marginBottom: 12 }, warning ? { borderColor: colors.warn } : null]}>
        <Text style={styles.summary} accessibilityRole="summary">
          {summaryText(phase.check)}
        </Text>
        {warning ? (
          <View style={styles.warnBox} accessibilityRole="alert">
            <Text style={styles.warnText}>{warning}</Text>
          </View>
        ) : null}
        {phase.note ? <Text style={styles.small}>{phase.note}</Text> : null}
        {phase.newShop ? (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.small}>Add {phase.newShop} as a new shop?</Text>
            <ErrorText message={shopError} />
            <Button
              label={`Add ${phase.newShop}`}
              variant="secondary"
              size="small"
              loading={upsertShop.isPending}
              onPress={() => void addShop(phase.newShop as string)}
              style={{ marginTop: 6 }}
            />
          </View>
        ) : null}
        <Button label="Read it again" variant="secondary" size="small" onPress={() => void read()} style={{ marginTop: 10 }} />
      </Card>
    );
  }

  return (
    <View style={{ marginBottom: 12 }}>
      {phase.name === 'error' ? (
        <>
          <ErrorText message={phase.error.message} />
        </>
      ) : null}
      <Button
        label={phase.name === 'error' ? (phase.error.retry ? 'Try again' : 'Read this receipt with AI') : 'Read this receipt with AI'}
        variant="secondary"
        icon={<Icon name="camera" size={18} color={colors.accent} />}
        disabled={phase.name === 'error' && !phase.error.retry}
        onPress={() => void read()}
        style={{ marginBottom: 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  reading: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  summary: { fontSize: 15, fontWeight: '600', color: colors.ink, lineHeight: 21 },
  small: { fontSize: 13, color: colors.ink2, lineHeight: 18, marginTop: 6 },
  warnBox: { backgroundColor: colors.warnSoft, borderRadius: 8, padding: 10, marginTop: 8 },
  warnText: { fontSize: 13, color: colors.warn, lineHeight: 18, fontWeight: '500' },
});
