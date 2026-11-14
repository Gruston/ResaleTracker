import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Screen, Segmented } from '@/components';
import { useBusinessData, useUpdateSettings } from '@/data';
import type { AdFeeBase } from '@/domain';
import { feeFormFrom, parseFeeForm, type FeeErrors, type FeeForm } from '@/features/more/forms';
import { ErrorText, Note } from '@/features/more/ui';
import { colors } from '@/theme';

export default function FeesScreen() {
  const { data, isLoading } = useBusinessData();
  const update = useUpdateSettings();
  const [form, setForm] = useState<FeeForm | null>(null);
  const [errors, setErrors] = useState<FeeErrors>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fill the form once the settings have loaded.
  if (!form && !isLoading) setForm(feeFormFrom(data.settings));
  const f = form ?? feeFormFrom(data.settings);

  const set = <K extends keyof FeeForm>(key: K, value: FeeForm[K]) => {
    setForm({ ...f, [key]: value });
    setSaved(false);
    setSaveError(null);
    if (key in errors) setErrors({ ...errors, [key]: undefined });
  };

  const save = async () => {
    const res = parseFeeForm(f);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    try {
      await update.mutateAsync(res.patch);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save');
    }
  };

  return (
    <Screen
      title="Fee settings"
      back
      backLabel="More"
      bottomInset
      footer={<Button label="Save" loading={update.isPending} onPress={save} />}
    >
      <Note>
        These are estimates to check against eBay. eBay's real fees differ for casual and business sellers and change over time, so they stay editable. They are used for "You get about" and "Buyer sees about" and to fill in sales you enter by hand.
      </Note>
      <Card>
        <Field
          label="Buyer protection: flat fee per item ($)"
          value={f.protectionFixed}
          onChangeText={(t) => set('protectionFixed', t)}
          keyboardType="decimal-pad"
          prefix="$"
          error={errors.protectionFixed}
        />
        <Note>
          Plus eBay's tiers on the item price (not postage): 8% of the first $20, 6% from $20 to $500, 4% from $500 to $5,000, nothing above. Paid by the buyer, GST included. Example: a $38 item has $2.98 buyer protection, so the buyer sees $40.98 + postage.
        </Note>
        <Field
          label="Default ad rate (%)"
          value={f.defaultAdRate}
          onChangeText={(t) => set('defaultAdRate', t)}
          keyboardType="decimal-pad"
          suffix="%"
          error={errors.defaultAdRate}
        />
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label}>Ad fee is charged on</Text>
          <Segmented<AdFeeBase>
            options={[
              { value: 'item', label: 'Item price' },
              { value: 'item_plus_postage', label: 'Item + postage' },
            ]}
            value={f.adFeeBase}
            onChange={(v) => set('adFeeBase', v)}
          />
        </View>
        <Field
          label="Typical postage label ($)"
          value={f.defaultLabelCost}
          onChangeText={(t) => set('defaultLabelCost', t)}
          keyboardType="decimal-pad"
          prefix="$"
          error={errors.defaultLabelCost}
          style={{ marginBottom: 0 }}
        />
      </Card>
      <ErrorText>{saveError}</ErrorText>
      {saved ? (
        <Text style={{ fontSize: 14, color: colors.accent, marginHorizontal: 4 }} accessibilityLiveRegion="polite">
          Saved. New prices and sales will use these rates.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: colors.ink2, marginBottom: 5, fontWeight: '500' },
});
