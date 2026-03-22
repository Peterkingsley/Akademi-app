import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  h1: { fontSize: 32, fontWeight: '700', fontFamily: 'Inter-Bold' },
  h2: { fontSize: 24, fontWeight: '700', fontFamily: 'Inter-Bold' },
  h3: { fontSize: 20, fontWeight: '600', fontFamily: 'Inter-SemiBold' },
  body: { fontSize: 16, fontWeight: '400', fontFamily: 'Inter-Regular' },
  bodySmall: { fontSize: 14, fontWeight: '400', fontFamily: 'Inter-Regular' },
  caption: { fontSize: 12, fontWeight: '400', fontFamily: 'Inter-Regular' },
  mono: { fontSize: 11, fontFamily: 'SpaceMono-Regular' },
};
