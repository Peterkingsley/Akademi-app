import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

interface BadgeProps {
  label: string;
  variant: "verified" | "pending" | "course" | "ai" | "purple" | "blue" | "warning";
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant, style }) => {
  const { colors, typography } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case "verified":
        return { backgroundColor: colors.success };
      case "pending":
      case "warning":
        return { backgroundColor: colors.warning };
      case "ai":
      case "purple":
        return { backgroundColor: colors.accentPurple };
      case "course":
      case "blue":
        return { backgroundColor: colors.surfaceElevated };
      default:
        return { backgroundColor: colors.surfaceElevated };
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

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    alignSelf: "flex-start",
    justifyContent: "center",
    alignItems: "center",
  },
});
