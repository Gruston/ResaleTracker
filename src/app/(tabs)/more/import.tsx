import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Callout, Card, KV, Progress, Screen, Select } from '@/components';
import {
  useBusinessData,
  useCreateItem,
  useMarkPosted,
  useRecordSale,
  useUpsertShop,
} from '@/data';
import { formatDate, formatMoney, today } from '@/domain';
import { parseCsvTable, toCsv } from '@/features/more/csv';
import {
  dedupeKey,
  groupReasons,
  guessMapping,
  IMPORT_FIELDS,
  missingRequired,
  planRows,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type ColumnMapping,
  type ImportContext,
  type ImportField,
  type ImportPlan,
} from '@/features/more/importMap';
import { readTextFile, shareCsv } from '@/features/more/share';
import { CardTitle, ErrorText, Note } from '@/features/more/ui';
import { colors } from '@/theme';

interface Loaded {
  name: string;
  headers: string[];
  rows: string[][];
  mapping: ColumnMapping;
}

interface Outcome {
  imported: number;
  skipped: { rowNumber: number; reason: string }[];
  estimated: number;
  newShops: number;
  stopped: boolean;
}

const CSV_TYPES = ['text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel', 'text/plain'];

export default function ImportScreen() {
  const { data } = useBusinessData();
  const createItem = useCreateItem();
  const recordSale = useRecordSale();
  const markPosted = useMarkPosted();
  const upsertShop = useUpsertShop();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const stopRef = useRef(false);

  const ctx: ImportContext = useMemo(
    () => ({ settings: data.settings, shops: data.shops, skuCodes: data.skuCodes, today: today() }),
    [data.settings, data.shops, data.skuCodes],
  );

  const existingKeys = useMemo(() => {
    const titles = new Map(data.items.map((i) => [i.id, i.title]));
    const keys = new Set<string>();
    for (const o of data.orders) {
      for (const oi of o.items) {
        const k = dedupeKey(o.orderNo, titles.get(oi.itemId) ?? '');
        if (k) keys.add(k);
      }
    }
    return keys;
  }, [data.orders, data.items]);

  const plan = useMemo(
    () => (loaded ? planRows(loaded.rows, loaded.mapping, ctx, existingKeys) : null),
    [loaded, ctx, existingKeys],
  );
  const missing = loaded ? missingRequired(loaded.mapping) : [];

  const pick = async () => {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: CSV_TYPES, copyToCacheDirectory: true });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      const text = await readTextFile(asset.uri);
      const table = parseCsvTable(text);
      if (!table.headers.length || !table.rows.length) {
        setError('That file has no rows to load. Check it opens as a table with a header row.');
        return;
      }
      setOutcome(null);
      setLoaded({ name: asset.name, headers: table.headers, rows: table.rows, mapping: guessMapping(table.headers) });
    } catch (e) {
      setError(`Could not read that file. ${e instanceof Error ? e.message : ''}`.trim());
    }
  };

  const template = async () => {
    setError(null);
    try {
      await shareCsv('resale-history-template.csv', toCsv([[...TEMPLATE_HEADERS], ...TEMPLATE_ROWS]), 'Template');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share the template');
    }
  };

  const setField = (field: ImportField, idx: number | null) => {
    if (!loaded) return;
    setLoaded({ ...loaded, mapping: { ...loaded.mapping, [field]: idx } });
  };

  const run = async () => {
    if (!plan || !plan.plans.length) return;
    setBusy(true);
    setError(null);
    stopRef.current = false;
    const skipped = [...plan.skipped];
    let imported = 0;
    let estimated = 0;
    let failuresInARow = 0;
    let stopped = false;
    const total = plan.plans.length;
    setProgress({ done: 0, total });
    try {
      // 1. Shops named in the file that do not exist yet.
      const shopIds = new Map<string, string>();
      const wanted = [...new Set(plan.plans.map((p) => p.plan.newShopName).filter((n): n is string => !!n).map((n) => n))];
      const seenLower = new Set<string>();
      for (const name of wanted) {
        if (seenLower.has(name.toLowerCase())) continue;
        seenLower.add(name.toLowerCase());
        const shop = await upsertShop.mutateAsync({ name, kind: 'shop' });
        shopIds.set(name.toLowerCase(), shop.id);
      }

      // 2. One item and one sale per row.
      for (let i = 0; i < plan.plans.length; i++) {
        if (stopRef.current) {
          stopped = true;
          for (const rest of plan.plans.slice(i)) skipped.push({ rowNumber: rest.rowNumber, reason: 'Stopped before this row' });
          break;
        }
        const { rowNumber, plan: p } = plan.plans[i];
        try {
          await importOne(p, p.newShopName ? (shopIds.get(p.newShopName.toLowerCase()) ?? null) : p.item.shopId);
          imported += 1;
          if (p.notes.some((n) => n.includes('estimated'))) estimated += 1;
          failuresInARow = 0;
        } catch (e) {
          failuresInARow += 1;
          skipped.push({ rowNumber, reason: `Could not save: ${e instanceof Error ? e.message : 'unknown error'}` });
          if (failuresInARow >= 3) {
            stopped = true;
            for (const rest of plan.plans.slice(i + 1)) skipped.push({ rowNumber: rest.rowNumber, reason: 'Stopped after repeated errors' });
            break;
          }
        }
        setProgress({ done: i + 1, total });
      }
      skipped.sort((a, b) => a.rowNumber - b.rowNumber);
      setOutcome({ imported, skipped, estimated, newShops: shopIds.size, stopped });
      setLoaded(null);
    } catch (e) {
      setError(`Import stopped. ${e instanceof Error ? e.message : ''}`.trim());
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const importOne = async (p: ImportPlan, shopId: string | null) => {
    const it = p.item;
    const item = await createItem.mutateAsync({
      item: {
        title: it.title,
        brand: it.brand,
        department: it.department,
        itemType: it.itemType,
        size: it.size,
        description: '',
        shopId,
        tripId: null,
        tripLineId: null,
        purchaseDate: null,
        cost: it.cost,
        status: 'posted',
        listedDate: it.listedDate,
        firstListPrice: it.firstListPrice,
        adRate: it.adRate,
        channel: 'ebay',
      },
    });
    const order = await recordSale.mutateAsync({
      orderNo: p.sale.orderNo,
      soldDate: p.sale.soldDate,
      orderTotal: p.sale.orderTotal,
      buyerProtection: p.sale.buyerProtection,
      postage: p.sale.postage,
      items: [{ itemId: item.id, salePrice: p.sale.salePrice }],
      channel: 'ebay',
    });
    // History is already posted: mark it so it does not appear under "To post".
    await markPosted.mutateAsync({ orderId: order.id, postedDate: p.sale.soldDate });
  };

  // ------------------------------------------------------------------ views

  if (busy && progress) {
    return (
      <Screen title="Loading sales" back={false} bottomInset>
        <Card>
          <CardTitle>Importing</CardTitle>
          <Text style={styles.big}>
            {progress.done} of {progress.total}
          </Text>
          <Progress done={progress.done} total={progress.total} />
          <Note>Keep the app open until this finishes. Each sale is saved as it goes, so nothing is lost if you stop.</Note>
        </Card>
        <Button label="Stop after this one" variant="secondary" onPress={() => (stopRef.current = true)} />
      </Screen>
    );
  }

  if (outcome) {
    const reasons = groupReasons(outcome.skipped);
    return (
      <Screen title="Load your sales history" back backLabel="More" bottomInset>
        <Card tone="accent">
          <Text style={styles.big} accessibilityLiveRegion="polite">
            Imported {outcome.imported}
            {outcome.skipped.length ? `, skipped ${outcome.skipped.length}` : ''}
          </Text>
          <Text style={styles.body}>
            {outcome.stopped ? 'The import stopped early. ' : ''}
            {outcome.imported
              ? 'These sales now appear in Items, Insights and the tax-year report.'
              : 'Nothing was added.'}
          </Text>
        </Card>

        {outcome.estimated ? (
          <Note>
            {outcome.estimated} {outcome.estimated === 1 ? 'sale' : 'sales'} had no postage or buyer protection in the file, so those were estimated from Fee settings. Check them against eBay if you need exact figures.
          </Note>
        ) : null}
        {outcome.newShops ? <Note>{outcome.newShops} new {outcome.newShops === 1 ? 'shop was' : 'shops were'} added to Shops.</Note> : null}

        {reasons.length ? (
          <Card>
            <CardTitle>Skipped rows</CardTitle>
            {reasons.map((r, i) => (
              <KV key={r.reason} label={r.reason} value={String(r.count)} last={i === reasons.length - 1} />
            ))}
            <Text style={styles.small}>
              {outcome.skipped.slice(0, 12).map((s) => `Row ${s.rowNumber}: ${s.reason}`).join('\n')}
              {outcome.skipped.length > 12 ? `\nand ${outcome.skipped.length - 12} more` : ''}
            </Text>
          </Card>
        ) : null}

        <Button label="Done" onPress={() => router.back()} />
        <Button label="Load another file" variant="secondary" onPress={() => setOutcome(null)} />
      </Screen>
    );
  }

  if (loaded && plan) {
    const preview = loaded.rows.slice(0, 5);
    const previewPlans = planRows(preview, loaded.mapping, ctx, existingKeys);
    const required = IMPORT_FIELDS.filter((f) => f.required);
    const optional = IMPORT_FIELDS.filter((f) => !f.required);
    const options = loaded.headers.map((h, i) => ({ value: i, label: h || `Column ${i + 1}` }));
    const picker = (f: (typeof IMPORT_FIELDS)[number]) => (
      <View key={f.key}>
        <Select<number>
          label={f.label}
          value={loaded.mapping[f.key]}
          options={options}
          onChange={(v) => setField(f.key, v)}
          onClear={() => setField(f.key, null)}
          clearLabel="Not in my file"
          placeholder="Not in my file"
          title={`Which column is ${f.label.toLowerCase()}?`}
        />
        {f.hint && loaded.mapping[f.key] == null ? <Text style={styles.hint}>{f.hint}</Text> : null}
      </View>
    );
    const rowPlan = (n: number) => {
      const ok = previewPlans.plans.find((p) => p.rowNumber === n);
      if (ok) return { plan: ok.plan };
      return { reason: previewPlans.skipped.find((s) => s.rowNumber === n)?.reason ?? 'Skipped' };
    };

    return (
      <Screen
        title="Match columns"
        back={() => setLoaded(null)}
        backLabel="Back"
        bottomInset
        footer={
          <>
            <ErrorText>{error}</ErrorText>
            <Button
              label={plan.plans.length ? `Import ${plan.plans.length} ${plan.plans.length === 1 ? 'sale' : 'sales'}` : 'Nothing to import'}
              disabled={!plan.plans.length || missing.length > 0}
              onPress={run}
              style={{ marginBottom: 0 }}
            />
          </>
        }
      >
        <Note>
          {loaded.name}: {loaded.rows.length} {loaded.rows.length === 1 ? 'row' : 'rows'}. The app guessed which column is which from the headings. Change any that look wrong.
        </Note>

        <Card>
          <CardTitle>Needed for each sale</CardTitle>
          {required.map(picker)}
        </Card>
        <Card>
          <CardTitle>Optional</CardTitle>
          {optional.map(picker)}
          <Text style={styles.hint}>
            Anything missing is filled in: postage and buyer protection are estimated from Fee settings, an unknown department becomes Women, an unknown item type becomes Other, and cost stays unknown.
          </Text>
        </Card>

        {missing.length ? (
          <ErrorText>
            {`Still needed: ${missing.map((m) => IMPORT_FIELDS.find((f) => f.key === m)?.label.toLowerCase()).join(', ')}.`}
          </ErrorText>
        ) : null}

        <Card>
          <CardTitle>{`Preview of the first ${preview.length} rows`}</CardTitle>
          {preview.map((_, i) => {
            const r = rowPlan(i + 2);
            return (
              <View key={i} style={styles.prev} accessible>
                {'plan' in r && r.plan ? (
                  <>
                    <Text style={styles.prevTitle} numberOfLines={1}>
                      {r.plan.item.title}
                    </Text>
                    <Text style={styles.prevSub}>
                      {formatDate(r.plan.sale.soldDate)} · {r.plan.item.department} {r.plan.item.itemType}
                      {r.plan.item.size ? ` ${r.plan.item.size}` : ''} · sold {formatMoney(r.plan.sale.salePrice)}
                      {r.plan.item.cost != null ? ` · cost ${formatMoney(r.plan.item.cost)}` : ' · cost unknown'}
                    </Text>
                    {r.plan.notes.length ? <Text style={styles.prevNote}>{r.plan.notes.join('. ')}</Text> : null}
                  </>
                ) : (
                  <>
                    <Text style={[styles.prevTitle, { color: colors.warn }]}>Row {i + 2} will be skipped</Text>
                    <Text style={styles.prevSub}>{'reason' in r ? r.reason : ''}</Text>
                  </>
                )}
              </View>
            );
          })}
          <Text style={styles.small}>
            {plan.plans.length} to import, {plan.skipped.length} to skip
            {plan.skipped.length ? ` (${groupReasons(plan.skipped).slice(0, 3).map((g) => `${g.count} ${g.reason.toLowerCase()}`).join(', ')})` : ''}.
          </Text>
        </Card>
      </Screen>
    );
  }

  // Start: the three ways
  return (
    <Screen title="Load your sales history" back backLabel="More" bottomInset>
      <Note>Bring in what you have already sold, including things from your own wardrobe (enter those with a $0 cost).</Note>

      <Card>
        <CardTitle>From eBay</CardTitle>
        <Text style={styles.body}>Coming later. Pulls past sales, fees and dates. eBay limits how far back the app can read, so older sales may need the next option.</Text>
        <Button label="Not available yet" variant="secondary" disabled style={{ marginTop: 10, marginBottom: 0 }} />
      </Card>

      <Card>
        <CardTitle>From an eBay sales report or spreadsheet (CSV)</CardTitle>
        <Text style={styles.body}>
          Download a report from eBay Seller Hub, or use your own list. The app matches the columns, shows a preview, and only then loads anything.
        </Text>
        <Button label="Choose a CSV file" onPress={pick} style={{ marginTop: 10 }} />
        <Button label="Download a template CSV" variant="secondary" onPress={template} style={{ marginBottom: 0 }} />
      </Card>

      <Card>
        <CardTitle>Quick-add past items one by one</CardTitle>
        <Text style={styles.body}>For things only on receipts. Items from your own wardrobe are entered with a $0 cost.</Text>
        <Button label="Add an item" variant="secondary" onPress={() => router.push('/items/new')} style={{ marginTop: 10, marginBottom: 0 }} />
      </Card>

      <ErrorText>{error}</ErrorText>
      {data.items.length === 0 && data.orders.length === 0 ? (
        <Callout>Tip: a first import of a few rows is a good way to check the columns before loading everything.</Callout>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, color: colors.ink },
  small: { fontSize: 13, lineHeight: 19, color: colors.ink2, marginTop: 8 },
  hint: { fontSize: 12, color: colors.ink2, marginTop: -6, marginBottom: 12, lineHeight: 17 },
  prev: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  prevTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  prevSub: { fontSize: 13, color: colors.ink2 },
  prevNote: { fontSize: 12, color: colors.ink2, marginTop: 2 },
});
