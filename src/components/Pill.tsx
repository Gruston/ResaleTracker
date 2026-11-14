import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/theme';

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  listed: 'Listed',
  sold: 'To post',
  posted: 'Posted',
  returned: 'Returned',
  faulty: 'Faulty',
};

/** Receipt-line outcome labels, in Kat's words. */
export const OUTCOME_LABELS: Record<string, string> = {
  to_list: 'To list',
  listed: 'Listed',
  family: 'For family',
  keeping: 'Keeping',
  faulty: 'Faulty',
};

export interface PillProps {
  /** An ItemStatus ('listed', 'sold' ...) picks colours and a default label. */
  status?: string;
  /** Override the label (or supply one when no status). */
  label?: string;
  tone?: 'neutral' | 'accent' | 'warn';
}

export function Pill({ status, label, tone = 'neutral' }: PillProps) {
  const pair: [string, string] =
    status && colors.status[status]
      ? colors.status[status]
      : tone === 'accent'
        ? [colors.accentSoft, colors.accent]
        : tone === 'warn'
          ? [colors.warnSoft, colors.warn]
          : ['#EEEAE4', colors.ink2];
  const text = label ?? (status ? (STATUS_LABELS[status] ?? status) : '');
  return (
    <View style={[styles.pill, { backgroundColor: pair[0] }]}>
      <Text style={[styles.text, { color: pair[1] }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill },
  text: { fontSize: 11, fontWeight: '600' },
});
