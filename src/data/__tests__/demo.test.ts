import { demoStore } from '../demo-store';
import { buildDemoSeed } from '../mock';
import { itemFromRow, itemToRow, orderFromRow, tripFromRow } from '../mappers';

describe('demo store', () => {
  beforeEach(() => demoStore.reset());

  it('seeds from the sample data with the demo business id', () => {
    const d = demoStore.get();
    expect(d.settings.businessId).toBe('demo');
    expect(d.items.length).toBeGreaterThan(10);
  });

  it('mutate edits a copy and commits it', () => {
    const before = demoStore.get();
    const n = before.expenses.length;
    demoStore.mutate((d) => {
      d.expenses.push({ ...d.expenses[0], id: 'x' });
    });
    expect(demoStore.get().expenses.length).toBe(n + 1);
    expect(before.expenses.length).toBe(n);
  });

  it('reset restores the seed', () => {
    demoStore.mutate((d) => {
      d.items = [];
    });
    demoStore.reset();
    expect(demoStore.get().items.length).toBe(buildDemoSeed().items.length);
  });
});

describe('mappers', () => {
  it('round-trips an item row', () => {
    const item = demoStore.get().items[0];
    const row = itemToRow('b1', item);
    expect(row.sku_prefix).toBe(item.skuPrefix);
    expect(itemFromRow({ ...row, id: item.id }, item.photos)).toEqual(item);
  });

  it('accepts numeric strings and sorts trip lines', () => {
    const t = tripFromRow(
      { id: 't', shop_id: null, trip_date: '2026-11-01', total: '12.50', receipt_path: null, notes: null },
      [
        { id: 'b', tripId: 't', description: '', qty: 1, price: 1, outcome: 'to_list', itemId: null, sort: 2 },
        { id: 'a', tripId: 't', description: '', qty: 1, price: 1, outcome: 'to_list', itemId: null, sort: 1 },
      ],
    );
    expect(t.total).toBe(12.5);
    expect(t.lines.map((l) => l.id)).toEqual(['a', 'b']);
    expect(orderFromRow({ id: 'o', sold_date: '2026-11-01', order_total: '82' }, []).orderTotal).toBe(82);
  });
});
