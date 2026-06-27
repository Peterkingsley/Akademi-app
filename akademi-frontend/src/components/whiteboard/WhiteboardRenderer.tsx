import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import { StaticWhiteboardRenderer } from "./StaticWhiteboardRenderer";
import { WebViewWhiteboardRenderer } from "./WebViewWhiteboardRenderer";
import { WhiteboardPlan, WhiteboardRendererMode } from "./types";

type WhiteboardRendererProps = {
  plan: WhiteboardPlan | null;
  mode: WhiteboardRendererMode;
  onModeChange?: (mode: WhiteboardRendererMode) => void;
  showModeSwitcher?: boolean;
};

const modes: WhiteboardRendererMode[] = ["static", "svg", "webview", "skia"];

const placeholderCopy: Record<Exclude<WhiteboardRendererMode, "static" | "webview">, string> = {
  svg: "SVG renderer coming next",
  skia: "Skia renderer coming next",
};

export const WhiteboardRenderer: React.FC<WhiteboardRendererProps> = ({
  plan,
  mode,
  onModeChange,
  showModeSwitcher = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {showModeSwitcher ? (
        <View style={styles.switcherRow}>
          {modes.map((item) => {
            const active = item === mode;
            return (
              <Pressable
                key={item}
                onPress={() => onModeChange?.(item)}
                style={[styles.modeChip, active ? styles.modeChipActive : null]}
              >
                <Text style={[styles.modeChipText, active ? styles.modeChipTextActive : null]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {mode === "static" ? (
        <StaticWhiteboardRenderer plan={plan} />
      ) : mode === "webview" ? (
        <WebViewWhiteboardRenderer plan={plan} autoPlay />
      ) : (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>{placeholderCopy[mode]}</Text>
          <Text style={styles.placeholderText}>
            This renderer shell is ready for comparison mode, but only the static baseline is active in this phase.
          </Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    container: {
      gap: 12,
    },
    switcherRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    modeChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    modeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    modeChipText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    modeChipTextActive: {
      color: "#08130C",
    },
    placeholderCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 6,
    },
    placeholderTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    placeholderText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
