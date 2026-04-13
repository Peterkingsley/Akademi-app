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

export type TypographyVariant = keyof typeof typography;
