export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const spacing = {
  ...space,
  xs: space[1],
  sm: space[2],
  md: space[4],
  lg: space[6],
  xl: space[8],
  xxl: space[12],
} as const;
