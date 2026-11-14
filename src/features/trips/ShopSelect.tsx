import { useState } from 'react';

import { Button, Field, Select, Sheet } from '@/components';
import { useUpsertShop } from '@/data';
import type { Shop } from '@/domain/types';
import { ErrorText, errorMessage } from './ErrorText';

export interface ShopSelectProps {
  shops: Shop[];
  value: string | null;
  onChange: (shopId: string) => void;
  error?: string | null;
}

/** Shop picker (active shops, plus the current one if archived) with "+ Add new shop". */
export function ShopSelect({ shops, value, onChange, error }: ShopSelectProps) {
  const upsert = useUpsertShop();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const options = shops
    .filter((s) => !s.archived || s.id === value)
    .map((s) => ({ value: s.id, label: s.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr('Type the shop name.');
      return;
    }
    setErr(null);
    try {
      const shop = await upsert.mutateAsync({ name: trimmed });
      setAdding(false);
      setName('');
      onChange(shop.id);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  return (
    <>
      <Select
        label="Shop"
        value={value}
        options={options}
        onChange={onChange}
        placeholder="Choose a shop"
        // The picker sheet needs a moment to leave before another sheet can open.
        onAddNew={() => setTimeout(() => setAdding(true), 320)}
        addNewLabel="+ Add new shop"
        error={error}
      />
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a shop">
        <Field label="Shop name" value={name} onChangeText={setName} placeholder="e.g. Red Cross Paddington" autoFocus />
        <ErrorText message={err} />
        <Button label="Add shop" onPress={save} loading={upsert.isPending} />
        <Button label="Cancel" variant="secondary" onPress={() => setAdding(false)} />
      </Sheet>
    </>
  );
}
