import type { BusinessData, LineOutcome, Trip, TripLine } from '@/domain/types';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { splitLine } from '../domain';
import { tripLineToRow, tripToRow } from '../mappers';
import { check, defineBizMutation, nextSort } from './helpers';

export interface TripInput {
  shopId: string | null;
  tripDate: string; // YYYY-MM-DD
  total: number;
  receiptPath?: string | null;
  notes?: string | null;
}

export interface TripLineInput {
  /** Present = update that line; absent = add a new line. */
  id?: string;
  tripId: string;
  description: string;
  qty?: number; // default 1
  price: number; // line total
  outcome?: LineOutcome; // default 'to_list'
  itemId?: string | null;
  sort?: number; // default: after the last line
}

export type CreateTripInput = TripInput & { lines?: Omit<TripLineInput, 'tripId' | 'id'>[] };
export type UpdateTripInput = { id: string } & Partial<TripInput>;

function buildTrip(input: CreateTripInput): Trip {
  const id = uuid();
  const lines: TripLine[] = (input.lines ?? []).map((l, i) => ({
    id: uuid(),
    tripId: id,
    description: l.description,
    qty: l.qty ?? 1,
    price: l.price,
    outcome: l.outcome ?? 'to_list',
    itemId: l.itemId ?? null,
    sort: l.sort ?? i,
  }));
  return {
    id,
    shopId: input.shopId,
    tripDate: input.tripDate,
    total: input.total,
    receiptPath: input.receiptPath ?? null,
    notes: input.notes ?? null,
    lines,
  };
}

/** Creates a trip (optionally with receipt lines). Resolves with the new trip. */
export const useCreateTrip = defineBizMutation<CreateTripInput, Trip, Trip>({
  key: 'createTrip',
  prepare: (_data, input) => buildTrip(input), // ids are made once, here, so queued lines can refer to the trip
  remote: async ({ businessId }, _input, trip) => {
    const { lines, ...row } = trip;
    check(await supabase.from('trips').upsert(tripToRow(businessId, row)));
    if (lines.length) check(await supabase.from('trip_lines').upsert(lines.map((l) => tripLineToRow(businessId, l))));
    return trip;
  },
  apply: (draft, _input, trip) => {
    draft.trips.unshift(trip);
    return trip;
  },
});

function tripPatchRow(p: Partial<TripInput>) {
  const out: Record<string, unknown> = {};
  if (p.shopId !== undefined) out.shop_id = p.shopId;
  if (p.tripDate !== undefined) out.trip_date = p.tripDate;
  if (p.total !== undefined) out.total = p.total;
  if (p.receiptPath !== undefined) out.receipt_path = p.receiptPath;
  if (p.notes !== undefined) out.notes = p.notes;
  return out;
}

export const useUpdateTrip = defineBizMutation<UpdateTripInput, void>({
  key: 'updateTrip',
  remote: async (_ctx, { id, ...patch }) => {
    check(await supabase.from('trips').update(tripPatchRow(patch)).eq('id', id));
  },
  apply: (draft, { id, ...patch }) => {
    const t = draft.trips.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  },
});

/** Deletes a trip and its lines. Items bought on it stay (they just lose the trip link). */
export const useDeleteTrip = defineBizMutation<string, void>({
  key: 'deleteTrip',
  remote: async (_ctx, id) => {
    check(await supabase.from('trips').delete().eq('id', id));
  },
  apply: (draft, id) => {
    draft.trips = draft.trips.filter((t) => t.id !== id);
    for (const it of draft.items) {
      if (it.tripId === id) {
        it.tripId = null;
        it.tripLineId = null;
      }
    }
  },
});

function newLine(trip: Trip | undefined, input: TripLineInput): TripLine {
  return {
    id: input.id ?? uuid(),
    tripId: input.tripId,
    description: input.description,
    qty: input.qty ?? 1,
    price: input.price,
    outcome: input.outcome ?? 'to_list',
    itemId: input.itemId ?? null,
    sort: input.sort ?? nextSort((trip?.lines ?? []).map((l) => l.sort)),
  };
}

/** Work out the full line to save (merging an edit into the existing line), once, when Kat taps Save. */
function prepareLine(data: BusinessData, input: TripLineInput): TripLine {
  const trip = data.trips.find((t) => t.id === input.tripId);
  if (!trip) throw new Error('Trip not found');
  const existing = input.id ? trip.lines.find((l) => l.id === input.id) : undefined;
  return existing ? ({ ...existing, ...stripUndefined(input), id: existing.id } as TripLine) : newLine(trip, input);
}

/** Add or edit a receipt line. Resolves with the saved line. */
export const useUpsertTripLine = defineBizMutation<TripLineInput, TripLine, TripLine>({
  key: 'upsertTripLine',
  prepare: prepareLine,
  remote: async ({ businessId }, _input, line) => {
    check(await supabase.from('trip_lines').upsert(tripLineToRow(businessId, line)));
    return line;
  },
  apply: (draft, _input, line) => {
    const trip = draft.trips.find((t) => t.id === line.tripId);
    if (!trip) throw new Error('Trip not found');
    const idx = trip.lines.findIndex((l) => l.id === line.id);
    if (idx >= 0) trip.lines[idx] = line;
    else trip.lines.push(line);
    return line;
  },
});

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const useDeleteTripLine = defineBizMutation<string, void>({
  key: 'deleteTripLine',
  remote: async (_ctx, id) => {
    check(await supabase.from('trip_lines').delete().eq('id', id));
  },
  apply: (draft, id) => {
    for (const t of draft.trips) t.lines = t.lines.filter((l) => l.id !== id);
    for (const it of draft.items) if (it.tripLineId === id) it.tripLineId = null;
  },
});

/**
 * Work out which lines to write when splitting a qty > 1 line into single lines. The first piece keeps the
 * original line id (so a linked item stays linked); later lines are shifted down to make room.
 */
function planSplit(trip: Trip, lineId: string): TripLine[] {
  const line = trip.lines.find((l) => l.id === lineId);
  if (!line || line.qty <= 1) return [];
  const pieces = splitLine(line);
  const extra = pieces.length - 1;
  const writes: TripLine[] = pieces.map((p, i) => ({
    ...p,
    id: i === 0 ? line.id : uuid(),
    tripId: trip.id,
    sort: line.sort + i,
  }));
  for (const other of trip.lines) {
    if (other.id !== line.id && other.sort > line.sort) writes.push({ ...other, sort: other.sort + extra });
  }
  return writes;
}

/** Splits a "qty 3" receipt line into three single lines at an even price. */
export const useSplitTripLine = defineBizMutation<{ lineId: string; tripId: string }, void, TripLine[]>({
  key: 'splitTripLine',
  prepare: (data, { lineId, tripId }) => {
    const trip = data.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error('Trip not found');
    return planSplit(trip, lineId);
  },
  remote: async ({ businessId }, _input, writes) => {
    if (!writes.length) return;
    check(await supabase.from('trip_lines').upsert(writes.map((l) => tripLineToRow(businessId, l))));
  },
  apply: (draft: BusinessData, { tripId }, writes) => {
    const trip = draft.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error('Trip not found');
    if (!writes.length) return;
    const byId = new Map(writes.map((w) => [w.id, w]));
    trip.lines = trip.lines.map((l) => byId.get(l.id) ?? l);
    for (const w of writes) if (!trip.lines.some((l) => l.id === w.id)) trip.lines.push(w);
    trip.lines.sort((a, b) => a.sort - b.sort);
  },
});
