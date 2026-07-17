export const darkPalette = {
  background: "#0B0B0B",        // deep black (eye-friendly)
  surface: "#111111",           // base cards
  surfaceElevated: "#1A1A1A",   // raised elements
  primary: "#16A34A",           // vibrant green (main brand) — for FILLS behind white text only
  primaryDark: "#15803D",       // deeper green for press states
  accentPurple: "#A855F7",      // lighter green accent -> now a distinct purple
  success: "#22C55E",           // aligns perfectly
  accent: "#4ADE80",            // bright green for text/icons/borders drawn ON dark surfaces
  warning: "#F59E0B",
  error: "#EF4444",
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
  border: "#27272A",
};

export const lightPalette = {
  background: "#F9FAFB",
  surface: "#FFFFFF",
  surfaceElevated: "#F3F4F6",
  primary: "#16A34A",
  primaryDark: "#15803D",
  accentPurple: "#A855F7",
  success: "#22C55E",
  accent: "#16A34A",            // dark green already has strong contrast on light surfaces
  warning: "#D97706",
  error: "#DC2626",
  textPrimary: "#111827",
  textSecondary: "#4B5563",
  textMuted: "#9CA3AF",
  border: "#E5E7EB",
};

export const colors = darkPalette; // Default to dark for backward compatibility if needed

