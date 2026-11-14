import { useState } from 'react';

import { Button, Card, KV, Screen } from '@/components';
import { useBusinessData } from '@/data';
import { exportEverything } from '@/features/more/exports';
import { shareCsv } from '@/features/more/share';
import { CardTitle, ErrorText, Note } from '@/features/more/ui';

const DESCRIPTIONS: Record<string, string> = {
  'items.csv': 'Items',
  'sales.csv': 'Sales',
  'expenses.csv': 'Expenses',
  'trips.csv': 'Shopping trips',
};

export default function ExportScreen() {
  const { data } = useBusinessData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts: Record<string, number> = {
    'items.csv': data.items.length,
    'sales.csv': data.orders.reduce((a, o) => a + o.items.length, 0),
    'expenses.csv': data.expenses.length,
    'trips.csv': data.trips.length,
  };

  const run = async (names: string[]) => {
    setBusy(names.length > 1 ? 'all' : names[0]);
    setError(null);
    try {
      // Built on demand so the files always match the latest data.
      const files = exportEverything(data).filter((f) => names.includes(f.name));
      for (const f of files) await shareCsv(f.name, f.csv, f.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="Export everything" back backLabel="More" bottomInset>
      <Note>
        Four CSV files you can open in Excel, Numbers or Google Sheets, and keep as a backup. Each one opens the share sheet: choose Save to Files, AirDrop or Mail.
      </Note>
      <Card>
        <CardTitle>What is included</CardTitle>
        {Object.keys(DESCRIPTIONS).map((name, i, arr) => (
          <KV key={name} label={`${DESCRIPTIONS[name]} (${name})`} value={`${counts[name]} ${counts[name] === 1 ? 'row' : 'rows'}`} last={i === arr.length - 1} />
        ))}
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button label="Share all four files, one after another" loading={busy === 'all'} disabled={busy !== null} onPress={() => run(Object.keys(DESCRIPTIONS))} />
      {Object.keys(DESCRIPTIONS).map((name) => (
        <Button
          key={name}
          label={`Share ${name}`}
          variant="secondary"
          loading={busy === name}
          disabled={busy !== null}
          onPress={() => run([name])}
        />
      ))}
    </Screen>
  );
}
