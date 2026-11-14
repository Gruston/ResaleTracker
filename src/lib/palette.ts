// Thumbnail colours from the prototype: deterministic per brand/name.
export const thumbPalette = ['#7C9A8E', '#B98A6B', '#8A8FB5', '#C2A267', '#A3787F', '#6F8FA6', '#9B9A6A', '#B07D9C'];

export function colorFor(s: string): string {
  let sum = 0;
  for (const ch of s) sum += ch.charCodeAt(0);
  return thumbPalette[sum % thumbPalette.length];
}

export function initials(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
