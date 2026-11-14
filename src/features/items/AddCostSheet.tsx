import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';

import { Button, Field, Select, Sheet } from '@/components';
import { useUpdateItem } from '@/data';
import type { Item, Shop } from '@/domain';
import { colors } from '@/theme';
import { isWardrobe, parseMoney } from './form';

/** "What did you pay?" sheet: cost and bought-from for an item that has no cost yet. */
export function AddCostSheet({ item, shops, visible, onClose }: { item: Item; shops: Shop[]; visible: boolean; onClose: () => void }) {
  const update = useUpdateItem();
  const [cost, setCost] = useState('');
  const [shopId, setShopId] = useState<string | null>(item.shopId);
  const wardrobe = isWardrobe(shops, shopId);

  useEffect(() => {
    if (visible) {
      setCost(item.cost != null ? String(item.cost) : '');
      setShopId(item.shopId);
    }
  }, [visible, item.cost, item.shopId]);

  const value = wardrobe ? 0 : parseMoney(cost);
  const invalid = cost.trim() !== '' && value == null;

  const save = async () => {
    if (value == null) return;
    try {
      await update.mutateAsync({ id: item.id, patch: { cost: value, shopId } });
      onClose();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="What did you pay?">
      <Field
        label="Cost ($)"
        value={wardrobe ? '0' : cost}
        onChangeText={setCost}
        editable={!wardrobe}
        keyboardType="decimal-pad"
        prefix="$"
        error={invalid ? 'Enter an amount like 12.50' : null}
        hint={wardrobe ? 'My wardrobe items count as $0.' : undefined}
      />
      <Select
        label="Bought from"
        value={shopId}
        options={shops.filter((s) => !s.archived || s.id === shopId).map((s) => ({ value: s.id, label: s.name }))}
        onChange={setShopId}
        placeholder="Choose shop"
      />
      <Button label="Save" onPress={save} loading={update.isPending} disabled={value == null} />
      {value == null && !invalid ? <Text style={{ color: colors.ink2, fontSize: 12, marginTop: -4, marginBottom: 8 }}>Enter the amount to save.</Text> : null}
    </Sheet>
  );
}
