import type { ViewStyle } from 'react-native';

/** Centre content in a readable column on iPad. */
export const PAGE_MAX_WIDTH = 720;
export const pageStyle: ViewStyle = { width: '100%', maxWidth: PAGE_MAX_WIDTH, alignSelf: 'center' };
