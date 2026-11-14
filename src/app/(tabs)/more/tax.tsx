import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, Chips, KV, Screen } from '@/components';
import { useBusinessData } from '@/data';
import { formatDate, formatMoney, fyLabel, taxYear, today } from '@/domain';
import { financialYearsWithData, taxDetailCsv, taxFileName } from '@/features/more/exports';
import { shareCsv } from '@/features/more/share';
import { CardTitle, ErrorText, Note } from '@/features/more/ui';
import { colors } from '@/theme';

export default function TaxScreen() {
  const { data } = useBusinessData();
  const now = today();
  const years = financialYearsWithData(data, now);
  const [picked, setPicked] = useState<number | null>(null);
  const fy = picked !== null && years.includes(picked) ? picked : years[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = taxYear(data, fy);
  const current = now >= t.start && now <= t.end;

  const exportCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      await shareCsv(taxFileName(fy), taxDetailCsv(data, fy), `Tax ${fyLabel(fy)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Tax-year report" back backLabel="More" bottomInset>
      <Note>Australian financial year, 1 July to 30 June. Summary for your accountant.</Note>

      {years.length > 1 ? (
        <Chips
          options={years.map((y) => ({ value: y, label: fyLabel(y) }))}
          value={fy}
          onChange={(v) => setPicked(v)}
        />
      ) : null}

      <Card>
        <CardTitle>{t.label}</CardTitle>
        <Text style={{ fontSize: 13, color: colors.ink2, marginBottom: 6 }}>
          {formatDate(t.start)} to {formatDate(t.end)}
          {current ? ', to date' : ''}
        </Text>
        <KV label="Items sold" value={String(t.itemsSold)} />
        <KV label="Sales (eBay earnings)" value={formatMoney(t.income)} />
        <KV label="Refunds on returns" value={formatMoney(-t.refunds)} muted />
        <KV label="Cost of items sold" value={formatMoney(-t.costOfSold)} muted />
        <KV label="Supplies and expenses" value={formatMoney(-t.expenses)} muted />
        <KV label="Net profit" value={formatMoney(t.net)} total />
        <KV label="Stock bought in the year" value={formatMoney(t.stockBought)} last />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button label="Export detailed CSV for accountant" loading={busy} onPress={exportCsv} />
      <Note>
        One row per sale and per expense, with dates, SKUs, fees and costs. Net profit here is sales minus cost of items sold minus expenses; refunds are shown for information because returned items are already left out of sales. Not tax advice; your accountant decides how to treat it.
      </Note>
    </Screen>
  );
}
