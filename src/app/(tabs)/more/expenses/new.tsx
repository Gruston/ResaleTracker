import { router } from 'expo-router';
import { useState } from 'react';

import { Button, DateField, Field, Screen, Select } from '@/components';
import { uploadImage, useBusiness, useCreateExpense } from '@/data';
import { today } from '@/domain';
import type { ExpenseCategory } from '@/domain';
import { EXPENSE_CATEGORIES, parseAmount, validateExpense, type ExpenseErrors } from '@/features/more/forms';
import { ErrorText, ReceiptPhoto } from '@/features/more/ui';

export default function NewExpenseScreen() {
  const create = useCreateExpense();
  const { businessId } = useBusiness();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Packaging');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<ExpenseErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    const errs = validateExpense({ description, amount, date });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setFailure(null);
    try {
      let receiptPath: string | null = null;
      if (photo) {
        if (!businessId) throw new Error('No business yet');
        receiptPath = await uploadImage(photo, businessId, 'expenses');
      }
      await create.mutateAsync({
        description: description.trim(),
        category,
        amount: parseAmount(amount) as number,
        expenseDate: date,
        receiptPath,
      });
      router.back();
    } catch (e) {
      setFailure(`Could not save the expense. ${e instanceof Error ? e.message : ''}`.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="New expense" back backLabel="Cancel" bottomInset footer={<Button label="Save expense" loading={saving} onPress={save} />}>
      <Field
        label="What was it?"
        value={description}
        onChangeText={(t) => {
          setDescription(t);
          setErrors({ ...errors, description: undefined });
        }}
        placeholder="e.g. Satchels, tissue paper, tape"
        autoCapitalize="sentences"
        error={errors.description}
      />
      <Select<ExpenseCategory>
        label="Category"
        value={category}
        options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
        onChange={setCategory}
      />
      <Field
        label="Amount"
        value={amount}
        onChangeText={(t) => {
          setAmount(t);
          setErrors({ ...errors, amount: undefined });
        }}
        keyboardType="decimal-pad"
        prefix="$"
        placeholder="0.00"
        error={errors.amount}
      />
      <DateField value={date} onChange={setDate} />
      {errors.date ? <ErrorText>{errors.date}</ErrorText> : null}
      <ReceiptPhoto localUri={photo} onPick={setPhoto} />
      <ErrorText>{failure}</ErrorText>
    </Screen>
  );
}
