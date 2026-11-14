import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useSignedUrl } from '@/data/images';
import { colorFor, initials } from '@/lib/palette';

export interface ThumbProps {
  /** Storage path of the photo (signed URL fetched and cached automatically). */
  path?: string | null;
  /** Brand (or title) used for the fallback initials and colour. */
  label: string;
  size?: number;
  radius?: number;
}

/** Item photo, or coloured initials (colour is deterministic from the label). */
export function Thumb({ path, label, size = 44, radius = 10 }: ThumbProps) {
  const url = useSignedUrl(path);
  const seed = label || '?';
  return (
    <View
      style={[styles.box, { width: size, height: size, borderRadius: radius, backgroundColor: colorFor(seed) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <Text style={[styles.text, { fontSize: Math.max(10, Math.round(size * 0.27)) }]}>{initials(seed)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  text: { color: '#fff', fontWeight: '700' },
});
