import React, { useMemo } from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

interface BadgeProps {
  label: string;
  variant: "verified" | "pending" | "course" | "ai" | "purple" | "blue" | "warning" | "success" | "error";
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant, style }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case "verified":
      case "success":
        return styles.verified;
      case "pending":
      case "warning":
        return styles.pending;
      case "error":
        return styles.error;
      case "ai":
      case "purple":
        return styles.ai;
      case "course":
      case "blue":
        return styles.course;
      default:
        return styles.course;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case "course":
      case "blue":
        return { color: colors.primary };
      default:
        return { color: "#FFFFFF" };
    }
  };

  return (
    <View style={[styles.base, getVariantStyle(), style]}>
      <Text
        style={[
          styles.text,
          typography.caption,
          getTextStyle(),
          { fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    alignSelf: "flex-start",
    justifyContent: "center",
    alignItems: "center",
  },
  verified: {
    backgroundColor: colors.success,
  },
  pending: {
    backgroundColor: colors.warning,
  },
  error: {
    backgroundColor: colors.error,
  },
  ai: {
    backgroundColor: colors.accentPurple,
  },
  course: {
    backgroundColor: colors.surfaceElevated,
  },
  text: {
    fontSize: 8.25,
    textTransform: "uppercase",
  },
});
