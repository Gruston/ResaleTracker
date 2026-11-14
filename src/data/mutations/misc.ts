import type { Expense, ExpenseCategory, Settings, Shop, ShopKind, SkuCode, StorageLocation } from '@/domain/types';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { todayISO } from '@/lib/today';
import { uuid } from '@/lib/uuid';
import { expenseToRow, settingsToRow, shopToRow, skuCodeToRow, storageToRow } from '../mappers';
import { check, useBizMutation } from './helpers';

export interface CreateExpenseInput {
  expenseDate?: string; // default today
  description: string;
  category: ExpenseCategory;
  amount: number;
  receiptPath?: string | null;
}

export function useCreateExpense() {
  const build = (i: CreateExpenseInput): Expense => ({
    id: uuid(),
    expenseDate: i.expenseDate ?? todayISO(),
    description: i.description,
    category: i.category,
    amount: i.amount,
    receiptPath: i.receiptPath ?? null,
  });
  return useBizMutation<CreateExpenseInput, Expense>(
    async ({ businessId }, input) => {
      const e = build(input);
      check(await supabase.from('expenses').insert(expenseToRow(businessId, e)));
      return e;
    },
    (draft, input) => {
      const e = build(input);
      draft.expenses.unshift(e);
      return e;
    },
  );
}

export function useDeleteExpense() {
  return useBizMutation<string, void>(
    async (_ctx, id) => {
      check(await supabase.from('expenses').delete().eq('id', id));
    },
    (draft, id) => {
      draft.expenses = draft.expenses.filter((e) => e.id !== id);
    },
  );
}

export interface UpsertShopInput {
  /** Present = edit; absent = add. */
  id?: string;
  name: string;
  kind?: ShopKind; // default 'shop'
  archived?: boolean; // default false
}

/** Add or edit a shop. Resolves with the saved shop. */
export function useUpsertShop() {
  return useBizMutation<UpsertShopInput, Shop>(
    async ({ businessId, data }, input) => {
      const existing = input.id ? data.shops.find((s) => s.id === input.id) : undefined;
      const shop: Shop = {
        id: input.id ?? uuid(),
        name: input.name.trim(),
        kind: input.kind ?? existing?.kind ?? 'shop',
        archived: input.archived ?? existing?.archived ?? false,
      };
      check(await supabase.from('shops').upsert(shopToRow(businessId, shop)));
      return shop;
    },
    (draft, input) => {
      const idx = input.id ? draft.shops.findIndex((s) => s.id === input.id) : -1;
      const prev = idx >= 0 ? draft.shops[idx] : undefined;
      const shop: Shop = {
        id: input.id ?? uuid(),
        name: input.name.trim(),
        kind: input.kind ?? prev?.kind ?? 'shop',
        archived: input.archived ?? prev?.archived ?? false,
      };
      if (idx >= 0) draft.shops[idx] = shop;
      else draft.shops.push(shop);
      return shop;
    },
  );
}

export type SettingsPatch = Partial<Omit<Settings, 'businessId'>>;

export function useUpdateSettings() {
  return useBizMutation<SettingsPatch, void>(
    async ({ businessId }, patch) => {
      const row = settingsToRow(patch);
      if (Object.keys(row).length) check(await supabase.from('business_settings').update(row).eq('business_id', businessId));
    },
    (draft, patch) => {
      Object.assign(draft.settings, patch);
    },
  );
}

/** Add or change a SKU code (key = kind + label). */
export function useUpsertSkuCode() {
  return useBizMutation<SkuCode, void>(
    async ({ businessId }, code) => {
      check(
        await supabase.from('sku_codes').upsert(skuCodeToRow(businessId, code), { onConflict: 'business_id,kind,label' }),
      );
    },
    (draft, code) => {
      const i = draft.skuCodes.findIndex((c) => c.kind === code.kind && c.label === code.label);
      if (i >= 0) draft.skuCodes[i] = code;
      else draft.skuCodes.push(code);
    },
  );
}

/** Add or change where a SKU prefix ('WD') or department letter ('M') is stored. */
export function useUpsertStorage() {
  return useBizMutation<StorageLocation, void>(
    async ({ businessId }, loc) => {
      check(await supabase.from('storage_locations').upsert(storageToRow(businessId, loc), { onConflict: 'business_id,prefix' }));
    },
    (draft, loc) => {
      const i = draft.storage.findIndex((s) => s.prefix === loc.prefix);
      if (i >= 0) draft.storage[i] = loc;
      else draft.storage.push(loc);
    },
  );
}

export function useDeleteStorage() {
  return useBizMutation<string, void>(
    async ({ businessId }, prefix) => {
      check(await supabase.from('storage_locations').delete().eq('business_id', businessId).eq('prefix', prefix));
    },
    (draft, prefix) => {
      draft.storage = draft.storage.filter((s) => s.prefix !== prefix);
    },
  );
}

/** Adds someone (e.g. Damon) to the business by email; they must have signed in to the app once. Owner only. */
export function useAddMember() {
  return useBizMutation<{ email: string }, void>(
    async ({ businessId }, { email }) => {
      check(await supabase.rpc('add_member_by_email', { p_business_id: businessId, p_email: email.trim() }));
    },
    () => {
      if (!isDemoMode) throw new Error('unreachable');
    },
  );
}
