export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  strong: 2,
} as const;

export const controlSize = {
  minTouch: 48,
  inputMinHeight: 52,
  buttonMinHeight: 52,
  iconButton: 48,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

export const motion = {
  duration: { micro: 140, ui: 200, large: 280 },
  easing: { standard: [0.2, 0, 0, 1] as const, emphasized: [0.2, 0, 0, 1] as const },
} as const;

export const breakpoint = {
  medium: 600,
  expanded: 840,
  large: 1200,
  extraLarge: 1600,
} as const;

export const contentWidth = {
  readingMin: 600,
  readingMax: 760,
  formMax: 560,
  pageMax: 1200,
} as const;

export const elevation = {
  none: {},
  raised: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;
