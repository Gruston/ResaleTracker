/// <reference types="jest" />
// Checks the TanStack behaviour the offline queue relies on: writes made offline wait, survive save/restore
// (dehydrate/hydrate) and then run one at a time in the order they were made.
import { MutationObserver, QueryClient, dehydrate, hydrate, onlineManager } from '@tanstack/react-query';

function makeClient(log: string[]) {
  const qc = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } }); // no gc timers: lets jest exit
  qc.setMutationDefaults(['write'], {
    mutationFn: async (v: { name: string }) => {
      log.push(v.name);
      await new Promise((r) => setTimeout(r, 5));
      return v.name;
    },
    networkMode: 'online',
    scope: { id: 'business-writes' },
  });
  return qc;
}

afterEach(() => onlineManager.setOnline(true));

it('queues offline, persists, and resumes in order after a restart', async () => {
  const log: string[] = [];
  const oldLog: string[] = []; // the pre-restart client is gone in real life; its leftovers must not mix into `log`
  const before = makeClient(oldLog);
  onlineManager.setOnline(false);
  for (const name of ['trip', 'line', 'item']) {
    void new MutationObserver<unknown, Error, { name: string }>(before, { mutationKey: ['write'] }).mutate({ name }).catch(() => undefined);
  }
  expect(oldLog).toEqual([]);
  expect(before.isMutating()).toBe(3);

  const saved = JSON.parse(JSON.stringify(dehydrate(before, { shouldDehydrateMutation: (m) => m.state.isPaused })));
  expect(saved.mutations).toHaveLength(3);

  // "restart": a fresh client with the same defaults
  const after = makeClient(log);
  hydrate(after, saved);
  onlineManager.setOnline(true);
  await after.resumePausedMutations();
  await new Promise((r) => setTimeout(r, 60));
  expect(log).toEqual(['trip', 'line', 'item']);
  expect(after.isMutating()).toBe(0);
});
