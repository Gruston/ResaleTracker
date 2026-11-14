import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, EmptyState, Field, ListGroup, Row, Screen, SectionTitle, Sheet, Thumb } from '@/components';
import { useBusinessData, useUpsertShop } from '@/data';
import type { Shop } from '@/domain';
import { canArchive, validateShopName } from '@/features/more/forms';
import { ErrorText, Note } from '@/features/more/ui';
import { colors } from '@/theme';

export default function ShopsScreen() {
  const { data } = useBusinessData();
  const upsert = useUpsertShop();
  const [name, setName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Shop | null>(null);

  const counts = new Map<string, number>();
  for (const i of data.items) if (i.shopId) counts.set(i.shopId, (counts.get(i.shopId) ?? 0) + 1);

  const active = data.shops.filter((s) => !s.archived);
  const archived = data.shops.filter((s) => s.archived);

  const add = async () => {
    const err = validateShopName(name, data.shops);
    if (err) {
      setAddError(err);
      return;
    }
    setAddError(null);
    try {
      await upsert.mutateAsync({ name, kind: 'shop' });
      setName('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Could not add the shop');
    }
  };

  const rowFor = (s: Shop) => {
    const n = counts.get(s.id) ?? 0;
    return (
      <Row
        key={s.id}
        thumb={<Thumb label={s.name} />}
        title={s.name}
        subtitle={`${n} ${n === 1 ? 'item' : 'items'}${s.kind === 'wardrobe' ? ' · your own clothes' : ''}`}
        onPress={() => setEditing(s)}
        accessibilityLabel={`${s.name}, ${n} items. Rename or archive`}
      />
    );
  };

  return (
    <Screen title="Shops" back backLabel="More" bottomInset>
      {active.length ? <ListGroup>{active.map(rowFor)}</ListGroup> : <EmptyState title="No shops yet" message="Add the shops you buy from regularly." />}

      <View style={{ marginTop: 8 }}>
        <Field
          label="Add a shop"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setAddError(null);
          }}
          placeholder="Name"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={add}
          error={addError}
        />
        <Button label="Add" loading={upsert.isPending && !editing} onPress={add} />
      </View>

      {archived.length ? (
        <>
          <SectionTitle>Archived</SectionTitle>
          <ListGroup>{archived.map(rowFor)}</ListGroup>
          <Note>Archived shops are hidden when you pick a shop, but their items and trips stay as they were.</Note>
        </>
      ) : null}

      <EditShopSheet shop={editing} shops={data.shops} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function EditShopSheet({ shop, shops, onClose }: { shop: Shop | null; shops: Shop[]; onClose: () => void }) {
  const upsert = useUpsertShop();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Reset the field whenever a different shop is opened.
  if (shop && shop.id !== loadedId) {
    setLoadedId(shop.id);
    setName(shop.name);
    setError(null);
  }
  if (!shop && loadedId) setLoadedId(null);

  const save = async (patch: { name?: string; archived?: boolean }) => {
    if (!shop) return;
    if (patch.name !== undefined) {
      const err = validateShopName(patch.name, shops, shop.id);
      if (err) {
        setError(err);
        return;
      }
    }
    try {
      await upsert.mutateAsync({ id: shop.id, name: patch.name ?? shop.name, archived: patch.archived });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  };

  return (
    <Sheet visible={!!shop} onClose={onClose} title={shop?.name ?? ''}>
      <Field label="Name" value={name} onChangeText={(t) => { setName(t); setError(null); }} autoCapitalize="words" error={error} />
      <Button label="Save name" loading={upsert.isPending} disabled={!name.trim() || name.trim() === shop?.name} onPress={() => save({ name })} />
      {shop && canArchive(shop) ? (
        <Button
          label={shop.archived ? 'Bring back from archive' : 'Archive this shop'}
          variant="secondary"
          onPress={() => save({ archived: !shop.archived })}
        />
      ) : (
        <Text style={{ fontSize: 13, color: colors.ink2, marginBottom: 10 }}>My wardrobe is always available, so it cannot be archived.</Text>
      )}
      <Button label="Close" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}
