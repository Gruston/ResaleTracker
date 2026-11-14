// Design tokens, taken from the approved prototype.
export const colors = {
  bg: '#F7F5F1',
  card: '#FFFFFF',
  ink: '#1E1C1A',
  ink2: '#5F5A54',
  line: '#E6E1DA',
  accent: '#2E6B5E',
  accentSoft: '#E3EFEB',
  warn: '#B4541F',
  warnSoft: '#FBEDE4',
  // money breakdown bar
  cost: '#8C8780',
  profit: '#2E6B5E',
  postage: '#D9893F',
  protection: '#5B6FB5',
  ad: '#C9B458',
  // status pills: [background, text]
  status: {
    draft: ['#EEEAE4', '#5F5A54'],
    listed: ['#E6ECF7', '#3B4F8F'],
    sold: ['#FBEDE4', '#B4541F'],
    posted: ['#E3EFEB', '#2E6B5E'],
    returned: ['#F4E6F0', '#8A3A73'],
    faulty: ['#F6E3E3', '#9B2C2C'],
  } as Record<string, [string, string]>,
};

export const radius = { card: 14, control: 12, pill: 99 };
export const space = (n: number) => n * 4;
export const minTouch = 44;

export const type = {
  largeTitle: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5, color: colors.ink },
  title: { fontSize: 17, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink },
  label: { fontSize: 13, color: colors.ink2 },
  section: { fontSize: 13, fontWeight: '600' as const, color: colors.ink2, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  kpi: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
};
