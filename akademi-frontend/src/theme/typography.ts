export const typography = {
  h1: { fontSize: 24, fontWeight: "700" as const, fontFamily: "Inter-Bold" },
  h2: { fontSize: 18, fontWeight: "700" as const, fontFamily: "Inter-Bold" },
  h3: { fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter-SemiBold" },
  h4: { fontSize: 13.5, fontWeight: "600" as const, fontFamily: "Inter-SemiBold" },
  body: { fontSize: 12, fontWeight: "400" as const, fontFamily: "Inter-Regular" },
  bodySmall: { fontSize: 10.5, fontWeight: "400" as const, fontFamily: "Inter-Regular" },
  caption: { fontSize: 9, fontWeight: "400" as const, fontFamily: "Inter-Regular" },
  label: { fontSize: 9, fontWeight: "500" as const, fontFamily: "Inter-Medium" },
  mono: { fontSize: 8.25, fontFamily: "SpaceMono-Regular" },
} as const;

export type TypographyVariant = keyof typeof typography;
