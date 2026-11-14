// Small, dependency-free CSV reader and writer.
// Reader: quoted fields, "" escapes, commas/semicolons/tabs, CRLF/CR/LF, embedded newlines, BOM.
// Writer: quotes only when needed, CRLF line ends (what Excel and Numbers expect).

export type CsvCell = string | number | boolean | null | undefined;

/** Remove a leading UTF-8 byte order mark. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Guess the delimiter from the first line (outside quotes): the most common of comma, semicolon, tab. Defaults to comma. */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of stripBom(text)) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === '\n' || ch === '\r') break;
      if (ch in counts) counts[ch] += 1;
    }
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  return ',';
}

/**
 * Parse CSV text into rows of strings. Completely blank lines are dropped. A quote that is not at the start of
 * a field is kept as a literal character; an unterminated quote runs to the end of the text.
 */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = stripBom(input);
  const delim = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false; // true once the current field has any content or quote

  const endField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (ch === delim) {
      endField();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else if (ch === '\n') {
      endRow();
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (field !== '' || fieldStarted || row.length > 0) endRow();
  return rows;
}

/** Header names plus the data rows (each padded or trimmed to the header width). */
export function parseCsvTable(text: string): { headers: string[]; rows: string[][] } {
  const all = parseCsv(text);
  if (!all.length) return { headers: [], rows: [] };
  const headers = all[0].map((h) => h.trim());
  const rows = all.slice(1).map((r) => {
    const out = r.slice(0, headers.length);
    while (out.length < headers.length) out.push('');
    return out;
  });
  return { headers, rows };
}

/** One field, quoted if it contains a comma, quote, CR or LF, or has leading/trailing spaces. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV text, CRLF-separated with a trailing CRLF. */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + (rows.length ? '\r\n' : '');
}

/** Money as plain "12.50" (no symbol, no thousands separator) so spreadsheets read it as a number. */
export function csvMoney(n: number | null | undefined): string {
  return n == null ? '' : n.toFixed(2);
}
