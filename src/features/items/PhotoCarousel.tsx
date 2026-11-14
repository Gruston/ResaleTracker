import { Image } from 'expo-image';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useSignedUrl } from '@/data';
import { colorFor } from '@/lib/palette';
import type { ItemPhoto } from '@/domain';

function Page({ path, width, height, label, n, total }: { path: string; width: number; height: number; label: string; n: number; total: number }) {
  const url = useSignedUrl(path);
  return (
    <View style={{ width, height, backgroundColor: colorFor(label || '?') }} accessible accessibilityRole="image" accessibilityLabel={`${label}, photo ${n} of ${total}`}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
    </View>
  );
}

/** Swipeable photos (horizontal paging) with a "Photo n of N" badge, or a coloured block with the brand. */
export function PhotoCarousel({ photos, brand }: { photos: ItemPhoto[]; brand: string }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const height = Math.round(width * 0.8);
  const sorted = [...photos].sort((a, b) => a.sort - b.sort);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 ? (
        sorted.length ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            style={{ width, height }}
            accessibilityHint="Swipe left or right for more photos"
          >
            {sorted.map((p, i) => (
              <Page key={p.id} path={p.path} width={width} height={height} label={brand} n={i + 1} total={sorted.length} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.empty, { width, height, backgroundColor: colorFor(brand || '?') }]} accessible accessibilityLabel={`No photos. ${brand}`}>
            <Text style={styles.emptyText}>{brand || 'No photo'}</Text>
          </View>
        )
      ) : (
        <View style={{ height: 200 }} />
      )}
      <View style={styles.count} pointerEvents="none">
        <Text style={styles.countText}>{sorted.length ? `Photo ${Math.min(index + 1, sorted.length)} of ${sorted.length}` : 'No photos yet'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  count: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
