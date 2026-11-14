/// <reference types="jest" />
import {
  addPending,
  canRefetchBusiness,
  describeQueue,
  isNetworkError,
  parsePending,
  removePending,
  retryDelayMs,
  shouldQueueLocally,
  shouldRetryMutation,
} from '../offlineLogic';

describe('isNetworkError', () => {
  it('recognises no-signal errors', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError('The Internet connection appears to be offline.')).toBe(true);
  });
  it('does not treat real rejections as network errors', () => {
    expect(isNetworkError(new Error('duplicate key value violates unique constraint'))).toBe(false);
    expect(isNetworkError(new Error('new row violates row-level security policy'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('retry rules', () => {
  it('retries network errors a limited number of times', () => {
    expect(shouldRetryMutation(0, new Error('Network request failed'))).toBe(true);
    expect(shouldRetryMutation(4, new Error('Network request failed'))).toBe(false);
    expect(shouldRetryMutation(0, new Error('violates check constraint'))).toBe(false);
  });
  it('backs off up to 30s', () => {
    expect([0, 1, 2].map(retryDelayMs)).toEqual([1000, 2000, 4000]);
    expect(retryDelayMs(10)).toBe(30000);
  });
});

describe('ordering rules', () => {
  it('queues locally when offline or when earlier changes are waiting', () => {
    expect(shouldQueueLocally(true, 0)).toBe(false);
    expect(shouldQueueLocally(false, 0)).toBe(true);
    expect(shouldQueueLocally(true, 2)).toBe(true);
  });
  it('refetches only when nothing else is waiting', () => {
    expect(canRefetchBusiness(0)).toBe(true);
    expect(canRefetchBusiness(3)).toBe(false);
    expect(canRefetchBusiness(1, true)).toBe(true); // the one that just finished
    expect(canRefetchBusiness(2, true)).toBe(false);
  });
});

describe('describeQueue', () => {
  const base = { online: true, waiting: 0, failed: 0, photos: 0 };
  it('says nothing when all is well', () => {
    expect(describeQueue(base)).toBeNull();
  });
  it('offline with waiting changes', () => {
    expect(describeQueue({ ...base, online: false, waiting: 3 })?.text).toBe('Offline – 3 changes waiting');
    expect(describeQueue({ ...base, online: false, waiting: 1, photos: 2 })?.text).toBe(
      'Offline – 1 change and 2 photos waiting',
    );
  });
  it('offline with nothing waiting', () => {
    expect(describeQueue({ ...base, online: false })?.tone).toBe('offline');
  });
  it('online and sending', () => {
    expect(describeQueue({ ...base, waiting: 2 })).toEqual({ tone: 'syncing', text: 'Saving 2 changes…' });
  });
  it('failed changes', () => {
    expect(describeQueue({ ...base, failed: 1 })).toEqual({ tone: 'problem', text: '1 change could not be saved' });
  });
});

describe('pending photo list', () => {
  const a = { path: 'b/items/a.jpg', localUri: 'file:///a.jpg' };
  const b = { path: 'b/items/b.jpg', localUri: 'file:///b.jpg' };
  it('adds without duplicating a path, removes by path', () => {
    const list = addPending(addPending([], a), b);
    expect(addPending(list, { ...a, localUri: 'file:///a2.jpg' })).toHaveLength(2);
    expect(removePending(list, a.path)).toEqual([b]);
  });
  it('parses saved json defensively', () => {
    expect(parsePending(null)).toEqual([]);
    expect(parsePending('not json')).toEqual([]);
    expect(parsePending(JSON.stringify([a, { path: 1 }]))).toEqual([a]);
  });
});
