import React from "react";
import { StyleProp, Text, TextProps, TextStyle } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { TypographyVariant } from "../../theme/typography";

type TextTone = "primary" | "secondary" | "muted" | "inverse" | "disabled" | "brand" | "error";

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
  align?: TextStyle["textAlign"];
  heading?: boolean;
  style?: StyleProp<TextStyle>;
}

export const AppText: React.FC<AppTextProps> = ({
  variant = "body",
  tone = "primary",
  align,
  heading = false,
  style,
  accessibilityRole,
  ...props
}) => {
  const { colors, typeScale } = useTheme();
  const toneColors: Record<TextTone, string> = {
    primary: colors.fg.primary,
    secondary: colors.fg.secondary,
    muted: colors.fg.muted,
    inverse: colors.fg.inverse,
    disabled: colors.fg.disabled,
    brand: colors.brand.foreground,
    error: colors.status.error.fg,
  };

  return (
    <Text
      {...props}
      accessibilityRole={heading ? "header" : accessibilityRole}
      style={[typeScale[variant], { color: toneColors[tone], textAlign: align }, style]}
    />
  );
};
