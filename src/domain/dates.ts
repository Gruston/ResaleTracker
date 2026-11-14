// Dates are 'YYYY-MM-DD' strings (local Australia/Sydney). Date objects are used only internally for arithmetic (UTC).

export type Season = 'Summer' | 'Autumn' | 'Winter' | 'Spring';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(d: string): [number, number, number] {
  return [Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10))];
}
function utc(d: string): number {
  const [y, m, day] = parts(d);
  return Date.UTC(y, m - 1, day);
}
function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

/** Add (or subtract) whole days to a date string. */
export function addDays(d: string, n: number): string {
  const t = new Date(utc(d) + n * 86400000);
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Today's date in Australia/Sydney as 'YYYY-MM-DD'. */
export function today(): string {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** '2026-11-14' -> "14 Nov 2026". */
export function formatDate(d: string): string {
  const [y, m, day] = parts(d);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/** '2026-11-14' -> "14 Nov" (no year). */
export function formatDateShort(d: string): string {
  const [, m, day] = parts(d);
  return `${day} ${MONTHS[m - 1]}`;
}

/** '2026-11-14' -> '2026-11'. */
export function monthOf(d: string): string {
  return d.slice(0, 7);
}

/** '2026-11' -> "Nov". */
export function monthLabel(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

/** '2026-11' -> "Nov 2026". */
export function monthLabelLong(month: string): string {
  return `${monthLabel(month)} ${month.slice(0, 4)}`;
}

/** The `count` months ending at `endMonth` (inclusive), oldest first: ('2026-11', 3) -> ['2026-09','2026-10','2026-11']. */
export function monthsEndingAt(endMonth: string, count: number): string[] {
  const y = Number(endMonth.slice(0, 4));
  const m = Number(endMonth.slice(5, 7));
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const idx = y * 12 + (m - 1) - i;
    out.push(`${pad(Math.floor(idx / 12), 4)}-${pad((idx % 12) + 1)}`);
  }
  return out;
}

/** Australian season: Summer Dec-Feb, Autumn Mar-May, Winter Jun-Aug, Spring Sep-Nov. */
export function seasonOf(d: string): Season {
  const m = parts(d)[1];
  if (m === 12 || m <= 2) return 'Summer';
  if (m <= 5) return 'Autumn';
  if (m <= 8) return 'Winter';
  return 'Spring';
}

/** "Dec–Feb" etc. */
export function seasonMonths(season: Season): string {
  return { Summer: 'Dec–Feb', Autumn: 'Mar–May', Winter: 'Jun–Aug', Spring: 'Sep–Nov' }[season];
}

const ORDER: Season[] = ['Summer', 'Autumn', 'Winter', 'Spring'];

/** The season after the one `d` is in. */
export function nextSeason(d: string): Season {
  return ORDER[(ORDER.indexOf(seasonOf(d)) + 1) % 4];
}

/** Calendar year in which the season containing `d` started (Jan/Feb belong to the summer that began the previous December). */
export function seasonStartYear(d: string): number {
  const [y, m] = parts(d);
  return m <= 2 ? y - 1 : y;
}

/** First day of the next season after the one `d` is in, e.g. '2026-11-14' -> '2026-12-01'. */
export function nextSeasonStart(d: string): string {
  const [y, m] = parts(d);
  if (m === 12) return `${y + 1}-03-01`;
  if (m <= 2) return `${y}-03-01`;
  if (m <= 5) return `${y}-06-01`;
  if (m <= 8) return `${y}-09-01`;
  return `${y}-12-01`;
}

/** Financial year (1 Jul - 30 Jun) as its starting year: 2026-07-01..2027-06-30 -> 2026. */
export function financialYearOf(d: string): number {
  const [y, m] = parts(d);
  return m >= 7 ? y : y - 1;
}

/** 2026 -> "FY 2026–27". */
export function fyLabel(fy: number): string {
  return `FY ${fy}–${pad((fy + 1) % 100)}`;
}

/** First and last day of a financial year. */
export function fyRange(fy: number): { start: string; end: string } {
  return { start: `${fy}-07-01`, end: `${fy + 1}-06-30` };
}
