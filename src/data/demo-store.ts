// In-memory store behind demo mode. Seeded from sample data; mutations edit it and the query cache re-reads it.
import type { BusinessData } from '@/domain/types';
import { buildDemoSeed } from './mock';

let current: BusinessData | null = null;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export const demoStore = {
  get(): BusinessData {
    if (!current) current = clone(buildDemoSeed());
    return current;
  },
  /** Run `fn` against a copy; on success the copy becomes the new state. Returns fn's result. */
  mutate<T>(fn: (draft: BusinessData) => T): T {
    const draft = clone(demoStore.get());
    const result = fn(draft);
    current = draft;
    return result;
  },
  reset(): void {
    current = clone(buildDemoSeed());
  },
};
