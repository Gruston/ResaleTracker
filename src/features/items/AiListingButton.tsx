import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState, type MutableRefObject } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View } from 'react-native';

import { Button, Callout, Icon, Sheet } from '@/components';
import { uploadImage, useBusiness, useBusinessData } from '@/data';
import { aiListing, aiPrice } from '@/data/ai';
import { MAX_TITLE_LENGTH, type AiListingResult, type AiPriceResult } from '@/domain/ai';
import { formatMoney } from '@/domain';
import { colors } from '@/theme';
import { aiErrorText, keywordsLine, photosForAi, pickComparables, type UseMode } from './ai';
import type { ItemFormState } from './form';

type Phase = 'idle' | 'working' | 'done' | 'error';

export interface AiListingButtonProps {
  form: ItemFormState;
  /** newly picked photo key -> storage path, filled here when photos are uploaded early so save does not upload twice */
  uploaded: MutableRefObject<Record<string, string>>;
  onUse: (listing: AiListingResult, price: AiPriceResult | null, mode: UseMode) => void;
}

export function AiListingButton({ form, uploaded, onUse }: AiListingButtonProps) {
  const { businessId } = useBusiness();
  const { data } = useBusinessData();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('idle');
  const [listing, setListing] = useState<AiListingResult | null>(null);
  const [price, setPrice] = useState<AiPriceResult | null>(null);
  const [priceNote, setPriceNote] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const refreshUsage = () => qc.invalidateQueries({ queryKey: ['ai-usage'] });

  const run = async () => {
    if (!businessId) return;
    if (form.photos.length === 0) {
      Alert.alert('Add a photo first', 'The AI reads your photos to write the listing. Add at least one photo, then try again.');
      return;
    }
    setError('');
    setListing(null);
    setPrice(null);
    setPriceNote(null);
    setPhase('working');
    setOpen(true);
    try {
      const paths: string[] = [];
      for (const ph of photosForAi(form.photos)) {
        if (ph.existing) {
          paths.push(ph.path);
          continue;
        }
        let p = uploaded.current[ph.key];
        if (!p) {
          p = await uploadImage(ph.path, businessId, 'items');
          uploaded.current[ph.key] = p;
        }
        paths.push(p);
      }
      let written: AiListingResult;
      try {
        written = await aiListing({
          businessId,
          photoPaths: paths,
          brand: form.brand || undefined,
          itemType: form.itemType || undefined,
          department: form.department,
          size: form.size || undefined,
        });
      } finally {
        refreshUsage();
      }
      setListing(written);
      setPhase('done');
      // Price is a second call; if it fails the listing is still useful.
      try {
        const suggested = await aiPrice({
          businessId,
          item: { brand: form.brand, itemType: form.itemType, department: form.department, size: form.size, title: written.title },
          comparables: pickComparables(data, form),
        });
        setPrice(suggested);
      } catch (e) {
        setPriceNote(aiErrorText(e instanceof Error ? e.message : ''));
      } finally {
        refreshUsage();
      }
    } catch (e) {
      setError(aiErrorText(e instanceof Error ? e.message : ''));
      setPhase('error');
    }
  };

  const copy = async (label: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', `${label} copied. Paste it into eBay.`);
    } catch {
      await Share.share({ message: text }).catch(() => undefined);
    }
  };

  const use = (mode: UseMode) => {
    if (!listing) return;
    onUse(listing, price, mode);
    setOpen(false);
  };

  return (
    <>
      <Button
        label="Write listing with AI"
        variant="secondary"
        onPress={run}
        loading={phase === 'working' && !open}
        icon={<Icon name="spark" size={18} color={colors.accent} />}
        accessibilityLabel="Write listing with AI"
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Listing suggestion">
        {phase === 'working' ? (
          <View style={styles.center} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.body}>Writing your listing… about 10 seconds</Text>
          </View>
        ) : null}
        {phase === 'error' ? (
          <>
            <Callout>{error}</Callout>
            <Button label="Try again" onPress={run} />
            <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          </>
        ) : null}
        {listing ? (
          <>
            <Text style={styles.label}>Title</Text>
            <Text style={styles.body} selectable>{listing.title}</Text>
            <Text style={styles.muted}>{listing.title.length}/{MAX_TITLE_LENGTH}</Text>

            <Text style={styles.label}>Description</Text>
            <Text style={styles.body} selectable>{listing.description}</Text>

            <Text style={styles.label}>Keywords</Text>
            <Text style={styles.body} selectable>{keywordsLine(listing.keywords)}</Text>

            <Text style={styles.label}>Price</Text>
            {price ? (
              <>
                <Text style={styles.price}>Suggested {formatMoney(price.suggested)} (range {formatMoney(price.low)}–{formatMoney(price.high)})</Text>
                <Text style={styles.muted}>{price.reasoning}</Text>
              </>
            ) : priceNote ? (
              <Text style={styles.muted}>No price suggestion: {priceNote}</Text>
            ) : (
              <View style={styles.inline}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={styles.muted}>Working out a price…</Text>
              </View>
            )}

            <Text style={[styles.muted, { marginVertical: 10 }]}>Paste these into eBay yourself — the app never posts to eBay.</Text>
            <Button label="Use all" onPress={() => use('all')} disabled={!price} />
            <Button label="Use title and description" variant="secondary" onPress={() => use('text')} />
            <Button label="Copy title" variant="secondary" onPress={() => copy('Title', listing.title)} />
            <Button label="Copy description" variant="secondary" onPress={() => copy('Description', listing.description)} />
            <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink2, marginTop: 10, marginBottom: 3 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  muted: { fontSize: 13, color: colors.ink2 },
  price: { fontSize: 16, fontWeight: '700', color: colors.ink },
});
