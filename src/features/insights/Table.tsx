import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

export interface TableColumn {
  label: string;
  /** Right-align (numbers). The first column is always left-aligned text. */
  numeric?: boolean;
  /** Minimum width in points (default: 120 for text, 76 for numbers). */
  width?: number;
}

export interface TableProps {
  columns: TableColumn[];
  rows: string[][];
  /** Shown instead of the rows when there are none. */
  empty?: string;
  /** Accessible name for the table. */
  accessibilityLabel?: string;
}

/** Header row + rows; numeric columns right-aligned; scrolls horizontally when the screen is narrow. */
export function Table({ columns, rows, empty = 'Nothing to show yet.', accessibilityLabel }: TableProps) {
  if (!rows.length) return <Text style={styles.empty}>{empty}</Text>;
  const widths = columns.map((c) => c.width ?? (c.numeric ? 76 : 120));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.table}>
        <View style={styles.row}>
          {columns.map((c, i) => (
            <Text
              key={c.label}
              style={[styles.th, { minWidth: widths[i], flex: i === 0 ? 1 : 0 }, c.numeric && styles.num]}
              numberOfLines={2}
              accessibilityRole="header"
            >
              {c.label}
            </Text>
          ))}
        </View>
        {rows.map((r, ri) => (
          <View
            key={ri}
            style={[styles.row, styles.bodyRow]}
            accessible
            accessibilityLabel={r.map((cell, ci) => `${columns[ci]?.label ?? ''} ${cell}`).join(', ')}
          >
            {columns.map((c, i) => (
              <Text
                key={c.label}
                style={[styles.td, { minWidth: widths[i], flex: i === 0 ? 1 : 0 }, c.numeric && styles.num]}
                numberOfLines={i === 0 ? 2 : 1}
              >
                {r[i] ?? ''}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  table: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bodyRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, minHeight: 40 },
  th: { fontSize: 12, fontWeight: '600', color: colors.ink2, paddingVertical: 6 },
  td: { fontSize: 14, color: colors.ink, paddingVertical: 8 },
  num: { textAlign: 'right' },
  empty: { fontSize: 14, color: colors.ink2, paddingVertical: 6 },
});
