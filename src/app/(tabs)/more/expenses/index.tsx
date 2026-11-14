import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Bars, Button, Card, EmptyState, KpiGrid, KpiTile, ListGroup, Screen, Sheet, Thumb } from '@/components';
import { useBusinessData, useDeleteExpense } from '@/data';
import { formatDate, formatMoney, formatMoney0, monthOf, sumMoney, today } from '@/domain';
import type { Expense } from '@/domain';
import { EXPENSE_CATEGORIES } from '@/features/more/forms';
import { CardTitle, ConfirmSheet } from '@/features/more/ui';
import { colors } from '@/theme';

export default function ExpensesScreen() {
  const { data } = useBusinessData();
  const del = useDeleteExpense();
  const [picked, setPicked] = useState<Expense | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = [...data.expenses].sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : a.expenseDate > b.expenseDate ? -1 : 0));
  const month = monthOf(today());
  const total = sumMoney(data.expenses.map((e) => e.amount));
  const thisMonth = sumMoney(data.expenses.filter((e) => monthOf(e.expenseDate) === month).map((e) => e.amount));

  const byCat = [...EXPENSE_CATEGORIES, ...new Set(data.expenses.map((e) => e.category).filter((c) => !(EXPENSE_CATEGORIES as readonly string[]).includes(c)))]
    .map((c) => ({ label: c, value: sumMoney(data.expenses.filter((e) => e.category === c).map((e) => e.amount)) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const close = () => {
    setPicked(null);
    setConfirming(false);
    setError(null);
  };

  const remove = async () => {
    if (!picked) return;
    try {
      await del.mutateAsync(picked.id);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    }
  };

  return (
    <Screen
      title="Expenses"
      back
      backLabel="More"
      bottomInset
      footer={<Button label="Add expense" onPress={() => router.push('/more/expenses/new')} />}
    >
      <KpiGrid columns={2}>
        <KpiTile value={formatMoney(total)} label="All time" />
        <KpiTile value={formatMoney(thisMonth)} label="This month" />
      </KpiGrid>

      {byCat.length ? (
        <Card>
          <CardTitle>By category</CardTitle>
          <Bars items={byCat.map((c) => ({ label: c.label, value: c.value, display: formatMoney0(c.value) }))} />
        </Card>
      ) : null}

      {list.length === 0 ? (
        <EmptyState title="No expenses yet" message="Add satchels, tissue paper, tape, labels and anything else you buy to run the business." />
      ) : (
        <ListGroup>
          {list.map((e) => (
            <ExpenseRow key={e.id} expense={e} onOpen={() => setPicked(e)} />
          ))}
        </ListGroup>
      )}
      {list.length ? <Text style={styles.hint}>Tap or hold an expense to see it or delete it.</Text> : null}

      <Sheet visible={!!picked} onClose={close} title={confirming ? 'Delete this expense?' : (picked?.description ?? '')}>
        {picked && !confirming ? (
          <>
            <Text style={styles.detail}>
              {formatMoney(picked.amount)} · {picked.category}
            </Text>
            <Text style={styles.detailSub}>{formatDate(picked.expenseDate)}</Text>
            {picked.receiptPath ? (
              <View style={{ marginVertical: 10 }}>
                <Thumb path={picked.receiptPath} label={picked.description} size={120} radius={12} />
              </View>
            ) : null}
            <Button label="Delete expense" variant="danger" onPress={() => setConfirming(true)} />
            <Button label="Close" variant="secondary" onPress={close} />
          </>
        ) : null}
        {picked && confirming ? (
          <ConfirmBody expense={picked} busy={del.isPending} error={error} onConfirm={remove} onCancel={() => setConfirming(false)} />
        ) : null}
      </Sheet>
    </Screen>
  );
}

function ConfirmBody({
  expense,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  expense: Expense;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <Text style={styles.detail}>
        {expense.description}, {formatMoney(expense.amount)}, {formatDate(expense.expenseDate)}. This cannot be undone, and your totals and tax-year report will change.
      </Text>
      {error ? <Text style={{ color: colors.warn, marginBottom: 10 }} accessibilityRole="alert">{error}</Text> : null}
      <Button label="Delete" variant="danger" loading={busy} onPress={onConfirm} />
      <Button label="Keep it" variant="secondary" onPress={onCancel} />
    </>
  );
}

function ExpenseRow({ expense: e, onOpen }: { expense: Expense; onOpen: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${e.description}, ${formatMoney(e.amount)}, ${formatDate(e.expenseDate)}, ${e.category}`}
      accessibilityHint="Opens details and delete"
      accessibilityActions={[{ name: 'delete', label: 'Delete expense' }]}
      onAccessibilityAction={(ev) => {
        if (ev.nativeEvent.actionName === 'delete') onOpen();
      }}
      onPress={onOpen}
      onLongPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F3F0EB' }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {e.description}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {formatDate(e.expenseDate)} · {e.category}
        </Text>
      </View>
      <Text style={styles.amount}>{formatMoney(e.amount)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10, paddingHorizontal: 14 },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 13, color: colors.ink2 },
  amount: { fontSize: 14, fontWeight: '600', color: colors.ink },
  hint: { fontSize: 12, color: colors.ink2, textAlign: 'center', marginTop: 2 },
  detail: { fontSize: 15, color: colors.ink, lineHeight: 21, marginBottom: 4 },
  detailSub: { fontSize: 13, color: colors.ink2, marginBottom: 6 },
});
