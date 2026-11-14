/// <reference types="jest" />
import { appPathFor } from '../../app/+native-intent';

test('Expo Go update links start at home', () => {
  expect(appPathFor('exps://u.expo.dev/abc/group/123')).toBe('/');
  expect(appPathFor('exp://192.168.1.2:8081')).toBe('/');
});
test('our own deep links are kept', () => {
  expect(appPathFor('resaletracker://items/abc')).toBe('/items/abc');
  expect(appPathFor('resaletracker://items?filter=Listed')).toBe('/items?filter=Listed');
  expect(appPathFor('resaletracker://group/1')).toBe('/');
});
