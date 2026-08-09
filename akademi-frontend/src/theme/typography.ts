export const typeScale = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: "700", fontFamily: "Inter-Bold" },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: "700", fontFamily: "Inter-Bold" },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: "700", fontFamily: "Inter-Bold" },
  h3: { fontSize: 20, lineHeight: 26, fontWeight: "600", fontFamily: "Inter-SemiBold" },
  title: { fontSize: 18, lineHeight: 24, fontWeight: "600", fontFamily: "Inter-SemiBold" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400", fontFamily: "Inter-Regular" },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: "600", fontFamily: "Inter-SemiBold" },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: "400", fontFamily: "Inter-Regular" },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "600", fontFamily: "Inter-SemiBold" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400", fontFamily: "Inter-Regular" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "500", fontFamily: "Inter-Medium" },
  mono: { fontSize: 14, lineHeight: 20, fontWeight: "400", fontFamily: "SpaceMono-Regular" },
} as const;

// Compatibility scale for screens awaiting migration to AppText.
export const typography = {
  h1: { fontSize: 24, fontWeight: "700", fontFamily: "Inter-Bold" },
  h2: { fontSize: 18, fontWeight: "700", fontFamily: "Inter-Bold" },
  h3: { fontSize: 15, fontWeight: "600", fontFamily: "Inter-SemiBold" },
  h4: { fontSize: 13.5, fontWeight: "600", fontFamily: "Inter-SemiBold" },
  body: { fontSize: 12, fontWeight: "400", fontFamily: "Inter-Regular" },
  bodySmall: { fontSize: 10.5, fontWeight: "400", fontFamily: "Inter-Regular" },
  label: { fontSize: 10, fontWeight: "600", fontFamily: "Inter-SemiBold", textTransform: "uppercase" as const },
  caption: { fontSize: 9, fontWeight: "400", fontFamily: "Inter-Regular" },
  mono: { fontSize: 8.25, fontFamily: "SpaceMono-Regular" },
} as const;

export type TypographyVariant = keyof typeof typeScale;
