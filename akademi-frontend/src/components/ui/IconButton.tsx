import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { PressableSurface } from "./PressableSurface";
import { useTheme } from "../../theme/ThemeContext";

type IconButtonVariant = "plain" | "surface" | "brand" | "danger";

export interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  hint?: string;
  variant?: IconButtonVariant;
  selected?: boolean;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  onPress,
  hint,
  variant = "plain",
  selected = false,
  disabled = false,
  busy = false,
  style,
}) => {
  const { colors, controlSize, radius } = useTheme();
  const backgrounds: Record<IconButtonVariant, string> = {
    plain: "transparent",
    surface: colors.bg.surfaceRaised,
    brand: colors.brand.fill,
    danger: colors.status.error.bg,
  };

  return (
    <PressableSurface
      onPress={onPress}
      disabled={disabled}
      busy={busy}
      selected={selected}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={[
        styles.base,
        {
          backgroundColor: backgrounds[variant],
          borderColor: selected ? colors.brand.border : colors.borderRoles.default,
          borderRadius: radius.md,
          height: controlSize.iconButton,
          width: controlSize.iconButton,
        },
        variant === "plain" && styles.plain,
        style,
      ]}
    >
      <View pointerEvents="none">
        {busy ? <ActivityIndicator color={colors.brand.foreground} size="small" /> : icon}
      </View>
    </PressableSurface>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
  },
  plain: { borderColor: "transparent" },
});
