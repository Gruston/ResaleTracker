import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Callout, Card, Field, Screen, Sheet } from '@/components';
import { useBusinessData, useDeleteStorage, useUpsertSkuCode, useUpsertStorage } from '@/data';
import type { SkuCode, StorageLocation } from '@/domain';
import {
  cleanCode,
  nextItemTypeSort,
  sortStorage,
  validateCode,
  validateNewItemType,
  validateStoragePrefix,
} from '@/features/more/forms';
import { CardTitle, ErrorText, Note } from '@/features/more/ui';
import { colors } from '@/theme';

type CodeEdit = { mode: 'edit'; code: SkuCode } | { mode: 'add' } | null;
type StorageEdit = { mode: 'edit'; loc: StorageLocation } | { mode: 'add' } | null;

export default function SkuCodesScreen() {
  const { data } = useBusinessData();
  const [codeEdit, setCodeEdit] = useState<CodeEdit>(null);
  const [storageEdit, setStorageEdit] = useState<StorageEdit>(null);

  const departments = data.skuCodes.filter((c) => c.kind === 'department').sort((a, b) => a.sort - b.sort);
  const types = data.skuCodes.filter((c) => c.kind === 'item_type').sort((a, b) => a.sort - b.sort);
  const storage = sortStorage(data.storage);

  return (
    <Screen title="SKU codes" back backLabel="More" bottomInset>
      <Callout>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink }}>
          A SKU is <Text style={{ fontWeight: '700' }}>department + item type + number</Text>. <Text style={{ fontWeight: '700' }}>WD-014</Text> is the 14th women's dress. The prefix tells you which shelf or box to go to.
        </Text>
      </Callout>

      <Card>
        <CardTitle>Department</CardTitle>
        {departments.map((c) => (
          <CodeRow key={`d-${c.label}`} code={c.code} label={c.label} onPress={() => setCodeEdit({ mode: 'edit', code: c })} />
        ))}
      </Card>

      <Card>
        <CardTitle>Item type</CardTitle>
        {types.map((c) => (
          <CodeRow key={`t-${c.label}`} code={c.code} label={c.label} onPress={() => setCodeEdit({ mode: 'edit', code: c })} />
        ))}
        <Button label="Add an item type" variant="secondary" size="small" style={{ marginTop: 10 }} onPress={() => setCodeEdit({ mode: 'add' })} />
      </Card>

      <Card>
        <CardTitle>Where each prefix is stored</CardTitle>
        {storage.length === 0 ? <Text style={styles.muted}>No storage locations yet.</Text> : null}
        {storage.map((s) => (
          <CodeRow
            key={s.prefix}
            code={s.prefix.length === 1 ? `${s.prefix}…` : s.prefix}
            wide
            label={s.location}
            onPress={() => setStorageEdit({ mode: 'edit', loc: s })}
            hint={s.prefix.length === 1 ? 'Whole department' : undefined}
          />
        ))}
        <Button label="Add a location" variant="secondary" size="small" style={{ marginTop: 10 }} onPress={() => setStorageEdit({ mode: 'add' })} />
        <Note>
          A two-letter prefix like WD is used first. If there is none, the department letter (like W) is used.
        </Note>
      </Card>

      <CodeSheet edit={codeEdit} codes={data.skuCodes} onClose={() => setCodeEdit(null)} />
      <StorageSheet edit={storageEdit} storage={data.storage} onClose={() => setStorageEdit(null)} />
    </Screen>
  );
}

function CodeRow({ code, label, onPress, wide, hint }: { code: string; label: string; onPress: () => void; wide?: boolean; hint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, code ${code}. Edit`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F3F0EB' }]}
    >
      <Text style={[styles.code, wide && { width: 56 }]}>{code}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.muted}>{hint}</Text> : null}
      </View>
      <Text style={styles.edit}>Edit</Text>
    </Pressable>
  );
}

function CodeSheet({ edit, codes, onClose }: { edit: CodeEdit; codes: SkuCode[]; onClose: () => void }) {
  const upsert = useUpsertSkuCode();
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warned, setWarned] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  const sig = edit ? (edit.mode === 'edit' ? `e:${edit.code.kind}:${edit.code.label}` : 'add') : null;
  if (sig !== key) {
    setKey(sig);
    setError(null);
    setWarned(false);
    setLabel('');
    setCode(edit?.mode === 'edit' ? edit.code.code : '');
  }

  const editing = edit?.mode === 'edit' ? edit.code : null;
  const changed = editing ? code !== editing.code : true;

  const save = async () => {
    if (!edit) return;
    const clean = cleanCode(code);
    const kind = editing?.kind ?? 'item_type';
    let err = validateCode(kind, clean, codes, editing?.label);
    if (!err && !editing) err = validateNewItemType(label, codes);
    if (err) {
      setError(err);
      return;
    }
    if (editing && !changed) {
      onClose();
      return;
    }
    // Changing an existing code needs a second tap on the warning.
    if (editing && !warned) {
      setWarned(true);
      return;
    }
    try {
      await upsert.mutateAsync(
        editing
          ? { ...editing, code: clean }
          : { kind: 'item_type', label: label.trim(), code: clean, sort: nextItemTypeSort(codes) },
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  };

  const title = editing ? `${editing.label} code` : 'Add an item type';
  const max = editing?.kind === 'department' ? 1 : 2;

  return (
    <Sheet visible={!!edit} onClose={onClose} title={title}>
      {!editing ? (
        <Field label="Item type" value={label} onChangeText={(t) => { setLabel(t); setError(null); }} placeholder="e.g. Swimwear" autoCapitalize="words" />
      ) : null}
      <Field
        label={editing ? 'Code' : 'Code (1 or 2 letters)'}
        value={code}
        onChangeText={(t) => {
          setCode(cleanCode(t).slice(0, max));
          setError(null);
          setWarned(false);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={max}
        hint={editing?.kind === 'department' ? 'One letter' : 'The item type letters come after the department letter, like W + D = WD'}
      />
      {warned && editing ? (
        <View style={styles.warn} accessibilityLiveRegion="polite">
          <Text style={styles.warnText}>
            Items you already added keep their old SKUs (for example {oldExample(editing)} stays as it is). Only new items will use {cleanCode(code)}. Tap Change code to continue.
          </Text>
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button label={editing ? (warned ? 'Change code' : 'Save') : 'Add item type'} loading={upsert.isPending} onPress={save} />
      <Button label="Cancel" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

function oldExample(c: SkuCode): string {
  return c.kind === 'department' ? `${c.code}D-014` : `W${c.code}-014`;
}

function StorageSheet({ edit, storage, onClose }: { edit: StorageEdit; storage: StorageLocation[]; onClose: () => void }) {
  const upsert = useUpsertStorage();
  const del = useDeleteStorage();
  const [prefix, setPrefix] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  const sig = edit ? (edit.mode === 'edit' ? `e:${edit.loc.prefix}` : 'add') : null;
  if (sig !== key) {
    setKey(sig);
    setError(null);
    setConfirmDelete(false);
    setPrefix(edit?.mode === 'edit' ? edit.loc.prefix : '');
    setLocation(edit?.mode === 'edit' ? edit.loc.location : '');
  }
  const editing = edit?.mode === 'edit' ? edit.loc : null;

  const save = async () => {
    const p = editing ? editing.prefix : cleanCode(prefix);
    if (!editing) {
      const err = validateStoragePrefix(p, storage);
      if (err) {
        setError(err);
        return;
      }
    }
    if (!location.trim()) {
      setError('Enter where these are kept, like Rack A or Blue box 2');
      return;
    }
    try {
      await upsert.mutateAsync({ prefix: p, location: location.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  };

  const remove = async () => {
    if (!editing) return;
    try {
      await del.mutateAsync(editing.prefix);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
      setConfirmDelete(false);
    }
  };

  return (
    <Sheet
      visible={!!edit}
      onClose={onClose}
      title={confirmDelete ? 'Delete this location?' : editing ? `Location for ${editing.prefix}` : 'Add a location'}
    >
      {confirmDelete && editing ? (
        <>
          <Text style={styles.sheetMessage}>
            {editing.prefix} will show "Not set" for storage until you add it again. Your items are not changed.
          </Text>
          <ErrorText>{error}</ErrorText>
          <Button label="Delete location" variant="danger" loading={del.isPending} onPress={remove} />
          <Button label="Keep it" variant="secondary" onPress={() => setConfirmDelete(false)} />
        </>
      ) : (
        <>
          {!editing ? (
            <Field
              label="Prefix"
              value={prefix}
              onChangeText={(t) => {
                setPrefix(cleanCode(t).slice(0, 3));
                setError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={3}
              hint="Two letters like WD (women's dress), or one letter like M for everything in a department"
            />
          ) : null}
          <Field label="Location" value={location} onChangeText={(t) => { setLocation(t); setError(null); }} placeholder="e.g. Rack A" autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button label="Save" loading={upsert.isPending} onPress={save} />
          {editing ? <Button label="Delete this location" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  code: { width: 40, fontSize: 15, fontWeight: '700', color: colors.ink },
  label: { fontSize: 15, color: colors.ink },
  edit: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.ink2 },
  warn: { backgroundColor: colors.warnSoft, borderRadius: 10, padding: 12, marginBottom: 12 },
  sheetMessage: { fontSize: 15, color: colors.ink, lineHeight: 21, marginBottom: 14 },
  warnText: { fontSize: 14, color: colors.ink, lineHeight: 20 },
});
