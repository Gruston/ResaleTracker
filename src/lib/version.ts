import * as Updates from 'expo-updates';

/** Bump with each published change so we can tell which version a phone is running. */
export const APP_VERSION_LABEL = '14 Nov 2026 · calendar dates';

/** e.g. "14 Nov 2026 · calendar dates (update 1a2b3c4d, published 14/11/2026 6:30 pm)" */
export function versionText(): string {
  try {
    const id = Updates.updateId ? Updates.updateId.slice(0, 8) : null;
    const at = Updates.createdAt
      ? Updates.createdAt.toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : null;
    const extra = [id && `update ${id}`, at && `published ${at}`].filter(Boolean).join(', ');
    return extra ? `${APP_VERSION_LABEL} (${extra})` : APP_VERSION_LABEL;
  } catch {
    return APP_VERSION_LABEL;
  }
}
