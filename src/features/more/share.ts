// Writing CSV files to the cache folder and opening the share sheet (expo-file-system new File/Paths API,
// expo-sharing). Kept out of the pure helpers so those stay testable without native modules.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Excel and Numbers read UTF-8 correctly when the file starts with a byte order mark. */
const BOM = '﻿';

/** Write a text file into the app's cache folder, replacing any earlier file of the same name. Returns its uri. */
export function writeCacheFile(name: string, text: string): string {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  return file.uri;
}

/** Read a text file (a picked CSV) from a file uri. */
export async function readTextFile(uri: string): Promise<string> {
  return new File(uri).text();
}

/** Write a CSV and open the iOS share sheet (Save to Files, AirDrop, Mail...). Throws a readable Error if sharing is not possible. */
export async function shareCsv(name: string, csv: string, dialogTitle?: string): Promise<void> {
  const uri = writeCacheFile(name, BOM + csv);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: dialogTitle ?? name });
}
