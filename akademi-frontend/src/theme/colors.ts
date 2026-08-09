const statusRoles = {
  dark: {
    success: { fg: "#86EFAC", bg: "#0D2E1A", border: "#166534", icon: "#4ADE80" },
    warning: { fg: "#FCD34D", bg: "#33250A", border: "#854D0E", icon: "#FBBF24" },
    error: { fg: "#FCA5A5", bg: "#351313", border: "#991B1B", icon: "#F87171" },
    info: { fg: "#93C5FD", bg: "#10243E", border: "#1E40AF", icon: "#60A5FA" },
  },
  light: {
    success: { fg: "#166534", bg: "#F0FDF4", border: "#86EFAC", icon: "#15803D" },
    warning: { fg: "#92400E", bg: "#FFFBEB", border: "#FCD34D", icon: "#B45309" },
    error: { fg: "#991B1B", bg: "#FEF2F2", border: "#FCA5A5", icon: "#B91C1C" },
    info: { fg: "#1E40AF", bg: "#EFF6FF", border: "#93C5FD", icon: "#1D4ED8" },
  },
};

export const darkPalette = {
  bg: {
    canvas: "#0B0B0B",
    surface: "#111111",
    surfaceRaised: "#1A1A1A",
    subtle: "#151515",
    inverse: "#F9FAFB",
    scrim: "rgba(0,0,0,0.68)",
  },
  fg: {
    primary: "#FFFFFF",
    secondary: "#D4D4D8",
    muted: "#A1A1AA",
    inverse: "#111827",
    disabled: "#71717A",
  },
  brand: {
    fill: "#15803D",
    fillPressed: "#166534",
    foreground: "#4ADE80",
    onFill: "#FFFFFF",
    subtle: "#0D2E1A",
    border: "#22C55E",
  },
  borderRoles: {
    subtle: "#202024",
    default: "#3F3F46",
    strong: "#52525B",
    focus: "#4ADE80",
    disabled: "#27272A",
  },
  status: statusRoles.dark,

  // Compatibility aliases. Remove only after every existing screen migrates.
  background: "#0B0B0B",
  surface: "#111111",
  surfaceElevated: "#1A1A1A",
  primary: "#15803D",
  primaryDark: "#166534",
  accentPurple: "#A855F7",
  success: "#22C55E",
  accent: "#4ADE80",
  warning: "#F59E0B",
  error: "#EF4444",
  textPrimary: "#FFFFFF",
  textSecondary: "#D4D4D8",
  textMuted: "#A1A1AA",
  border: "#3F3F46",
};

export const lightPalette = {
  bg: {
    canvas: "#F9FAFB",
    surface: "#FFFFFF",
    surfaceRaised: "#F3F4F6",
    subtle: "#F8FAFC",
    inverse: "#111827",
    scrim: "rgba(15,23,42,0.48)",
  },
  fg: {
    primary: "#111827",
    secondary: "#4B5563",
    muted: "#6B7280",
    inverse: "#FFFFFF",
    disabled: "#9CA3AF",
  },
  brand: {
    fill: "#15803D",
    fillPressed: "#166534",
    foreground: "#166534",
    onFill: "#FFFFFF",
    subtle: "#F0FDF4",
    border: "#86EFAC",
  },
  borderRoles: {
    subtle: "#F1F5F9",
    default: "#D1D5DB",
    strong: "#9CA3AF",
    focus: "#15803D",
    disabled: "#E5E7EB",
  },
  status: statusRoles.light,

  // Compatibility aliases. Remove only after every existing screen migrates.
  background: "#F9FAFB",
  surface: "#FFFFFF",
  surfaceElevated: "#F3F4F6",
  primary: "#15803D",
  primaryDark: "#166534",
  accentPurple: "#7E22CE",
  success: "#15803D",
  accent: "#166534",
  warning: "#B45309",
  error: "#B91C1C",
  textPrimary: "#111827",
  textSecondary: "#4B5563",
  textMuted: "#6B7280",
  border: "#D1D5DB",
};

export type AkademiPalette = typeof darkPalette;
export const colors = darkPalette;
