import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';
import { Icon } from './Icon';

export interface ListGroupProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** White rounded container that stacks Rows with hairline dividers. */
export function ListGroup({ children, style }: ListGroupProps) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

export interface RowProps {
  title: string;
  subtitle?: string;
  /** e.g. <Thumb .../> */
  thumb?: ReactNode;
  /** Right-aligned value (bold) */
  right?: string;
  /** Small grey line under the right value */
  rightSub?: string;
  /** Extra content under the subtitle, e.g. a <Pill/> */
  badge?: ReactNode;
  /** Defaults to true when onPress is set */
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Row({ title, subtitle, thumb, right, rightSub, badge, chevron, onPress, accessibilityLabel }: RowProps) {
  const showChev = chevron ?? !!onPress;
  const content = (
    <>
      {thumb}
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {badge ? <View style={{ marginTop: 3 }}>{badge}</View> : null}
      </View>
      {right || rightSub ? (
        <View style={styles.right}>
          {right ? <Text style={styles.rightText}>{right}</Text> : null}
          {rightSub ? <Text style={styles.rightSub}>{rightSub}</Text> : null}
        </View>
      ) : null}
      {showChev ? <Icon name="chev" size={18} color="#B5AFA7" /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, right].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F3F0EB' }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: 12,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, minHeight: 60 },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 13, color: colors.ink2 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  rightText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  rightSub: { fontSize: 12, color: colors.ink2 },
});
