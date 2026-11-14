import type { Expense, ExpenseCategory, Settings, Shop, ShopKind, SkuCode, StorageLocation } from '@/domain/types';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { todayISO } from '@/lib/today';
import { uuid } from '@/lib/uuid';
import { expenseToRow, settingsToRow, shopToRow, skuCodeToRow, storageToRow } from '../mappers';
import { check, defineBizMutation } from './helpers';

export interface CreateExpenseInput {
  expenseDate?: string; // default today
  description: string;
  category: ExpenseCategory;
  amount: number;
  receiptPath?: string | null;
}

function buildExpense(i: CreateExpenseInput): Expense {
  return {
    id: uuid(),
    expenseDate: i.expenseDate ?? todayISO(),
    description: i.description,
    category: i.category,
    amount: i.amount,
    receiptPath: i.receiptPath ?? null,
  };
}

export const useCreateExpense = defineBizMutation<CreateExpenseInput, Expense, Expense>({
  key: 'createExpense',
  prepare: (_data, input) => buildExpense(input),
  remote: async ({ businessId }, _input, e) => {
    check(await supabase.from('expenses').upsert(expenseToRow(businessId, e)));
    return e;
  },
  apply: (draft, _input, e) => {
    draft.expenses.unshift(e);
    return e;
  },
});

export const useDeleteExpense = defineBizMutation<string, void>({
  key: 'deleteExpense',
  remote: async (_ctx, id) => {
    check(await supabase.from('expenses').delete().eq('id', id));
  },
  apply: (draft, id) => {
    draft.expenses = draft.expenses.filter((e) => e.id !== id);
  },
});

export interface UpsertShopInput {
  /** Present = edit; absent = add. */
  id?: string;
  name: string;
  kind?: ShopKind; // default 'shop'
  archived?: boolean; // default false
}

/** Add or edit a shop. Resolves with the saved shop. */
export const useUpsertShop = defineBizMutation<UpsertShopInput, Shop, Shop>({
  key: 'upsertShop',
  prepare: (data, input) => {
    const existing = input.id ? data.shops.find((s) => s.id === input.id) : undefined;
    return {
      id: input.id ?? uuid(),
      name: input.name.trim(),
      kind: input.kind ?? existing?.kind ?? 'shop',
      archived: input.archived ?? existing?.archived ?? false,
    };
  },
  remote: async ({ businessId }, _input, shop) => {
    check(await supabase.from('shops').upsert(shopToRow(businessId, shop)));
    return shop;
  },
  apply: (draft, _input, shop) => {
    const idx = draft.shops.findIndex((s) => s.id === shop.id);
    if (idx >= 0) draft.shops[idx] = shop;
    else draft.shops.push(shop);
    return shop;
  },
});

export type SettingsPatch = Partial<Omit<Settings, 'businessId'>>;

export const useUpdateSettings = defineBizMutation<SettingsPatch, void>({
  key: 'updateSettings',
  remote: async ({ businessId }, patch) => {
    const row = settingsToRow(patch);
    if (Object.keys(row).length) check(await supabase.from('business_settings').update(row).eq('business_id', businessId));
  },
  apply: (draft, patch) => {
    Object.assign(draft.settings, patch);
  },
});

/** Add or change a SKU code (key = kind + label). */
export const useUpsertSkuCode = defineBizMutation<SkuCode, void>({
  key: 'upsertSkuCode',
  remote: async ({ businessId }, code) => {
    check(await supabase.from('sku_codes').upsert(skuCodeToRow(businessId, code), { onConflict: 'business_id,kind,label' }));
  },
  apply: (draft, code) => {
    const i = draft.skuCodes.findIndex((c) => c.kind === code.kind && c.label === code.label);
    if (i >= 0) draft.skuCodes[i] = code;
    else draft.skuCodes.push(code);
  },
});

/** Add or change where a SKU prefix ('WD') or department letter ('M') is stored. */
export const useUpsertStorage = defineBizMutation<StorageLocation, void>({
  key: 'upsertStorage',
  remote: async ({ businessId }, loc) => {
    check(await supabase.from('storage_locations').upsert(storageToRow(businessId, loc), { onConflict: 'business_id,prefix' }));
  },
  apply: (draft, loc) => {
    const i = draft.storage.findIndex((s) => s.prefix === loc.prefix);
    if (i >= 0) draft.storage[i] = loc;
    else draft.storage.push(loc);
  },
});

export const useDeleteStorage = defineBizMutation<string, void>({
  key: 'deleteStorage',
  remote: async ({ businessId }, prefix) => {
    check(await supabase.from('storage_locations').delete().eq('business_id', businessId).eq('prefix', prefix));
  },
  apply: (draft, prefix) => {
    draft.storage = draft.storage.filter((s) => s.prefix !== prefix);
  },
});

/** Adds someone (e.g. Damon) to the business by email; they must have signed in to the app once. Owner only. Needs signal. */
export const useAddMember = defineBizMutation<{ email: string }, void>({
  key: 'addMember',
  onlineOnly: 'You need signal to add someone. Try again when you are back online.',
  remote: async ({ businessId }, { email }) => {
    check(await supabase.rpc('add_member_by_email', { p_business_id: businessId, p_email: email.trim() }));
  },
  apply: () => {
    if (!isDemoMode) throw new Error('unreachable');
  },
});
