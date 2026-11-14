import type { BusinessData, LineOutcome, Trip, TripLine } from '@/domain/types';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { splitLine } from '../domain';
import { tripLineToRow, tripToRow } from '../mappers';
import { check, nextSort, useBizMutation } from './helpers';

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
export function useCreateTrip() {
  return useBizMutation<CreateTripInput, Trip>(
    async ({ businessId }, input) => {
      const trip = buildTrip(input);
      const { lines, ...row } = trip;
      check(await supabase.from('trips').insert(tripToRow(businessId, row)));
      if (lines.length) check(await supabase.from('trip_lines').insert(lines.map((l) => tripLineToRow(businessId, l))));
      return trip;
    },
    (draft, input) => {
      const trip = buildTrip(input);
      draft.trips.unshift(trip);
      return trip;
    },
  );
}

function tripPatchRow(p: Partial<TripInput>) {
  const out: Record<string, unknown> = {};
  if (p.shopId !== undefined) out.shop_id = p.shopId;
  if (p.tripDate !== undefined) out.trip_date = p.tripDate;
  if (p.total !== undefined) out.total = p.total;
  if (p.receiptPath !== undefined) out.receipt_path = p.receiptPath;
  if (p.notes !== undefined) out.notes = p.notes;
  return out;
}

export function useUpdateTrip() {
  return useBizMutation<UpdateTripInput, void>(
    async (_ctx, { id, ...patch }) => {
      check(await supabase.from('trips').update(tripPatchRow(patch)).eq('id', id));
    },
    (draft, { id, ...patch }) => {
      const t = draft.trips.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    },
  );
}

/** Deletes a trip and its lines. Items bought on it stay (they just lose the trip link). */
export function useDeleteTrip() {
  return useBizMutation<string, void>(
    async (_ctx, id) => {
      check(await supabase.from('trips').delete().eq('id', id));
    },
    (draft, id) => {
      draft.trips = draft.trips.filter((t) => t.id !== id);
      for (const it of draft.items) {
        if (it.tripId === id) {
          it.tripId = null;
          it.tripLineId = null;
        }
      }
    },
  );
}

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

/** Add or edit a receipt line. Resolves with the saved line. */
export function useUpsertTripLine() {
  return useBizMutation<TripLineInput, TripLine>(
    async ({ businessId, data }, input) => {
      const trip = data.trips.find((t) => t.id === input.tripId);
      const existing = input.id ? trip?.lines.find((l) => l.id === input.id) : undefined;
      const line = existing ? { ...existing, ...stripUndefined(input), id: existing.id } as TripLine : newLine(trip, input);
      check(await supabase.from('trip_lines').upsert(tripLineToRow(businessId, line)));
      return line;
    },
    (draft, input) => {
      const trip = draft.trips.find((t) => t.id === input.tripId);
      if (!trip) throw new Error('Trip not found');
      const idx = input.id ? trip.lines.findIndex((l) => l.id === input.id) : -1;
      if (idx >= 0) {
        const merged = { ...trip.lines[idx], ...stripUndefined(input) } as TripLine;
        trip.lines[idx] = merged;
        return merged;
      }
      const line = newLine(trip, input);
      trip.lines.push(line);
      return line;
    },
  );
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function useDeleteTripLine() {
  return useBizMutation<string, void>(
    async (_ctx, id) => {
      check(await supabase.from('trip_lines').delete().eq('id', id));
    },
    (draft, id) => {
      for (const t of draft.trips) t.lines = t.lines.filter((l) => l.id !== id);
      for (const it of draft.items) if (it.tripLineId === id) it.tripLineId = null;
    },
  );
}

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
export function useSplitTripLine() {
  return useBizMutation<{ lineId: string; tripId: string }, void>(
    async ({ businessId, data }, { lineId, tripId }) => {
      const trip = data.trips.find((t) => t.id === tripId);
      if (!trip) throw new Error('Trip not found');
      const writes = planSplit(trip, lineId);
      if (!writes.length) return;
      check(await supabase.from('trip_lines').upsert(writes.map((l) => tripLineToRow(businessId, l))));
    },
    (draft: BusinessData, { lineId, tripId }) => {
      const trip = draft.trips.find((t) => t.id === tripId);
      if (!trip) throw new Error('Trip not found');
      const writes = planSplit(trip, lineId);
      if (!writes.length) return;
      const byId = new Map(writes.map((w) => [w.id, w]));
      trip.lines = trip.lines.map((l) => byId.get(l.id) ?? l);
      for (const w of writes) if (!trip.lines.some((l) => l.id === w.id)) trip.lines.push(w);
      trip.lines.sort((a, b) => a.sort - b.sort);
    },
  );
}
