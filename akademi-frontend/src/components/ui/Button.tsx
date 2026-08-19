import React, { useMemo } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  Platform,
  StyleProp,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme/ThemeContext";
import { usePressBounce } from "../../hooks/usePressBounce";

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

interface ButtonProps {
  label?: string; // Made optional for title/label consistency
  title?: string; // Added title for backward compatibility
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
  pressScale,
}) => {
  const { colors, controlSize, radius, typeScale } = useTheme();
  const styles = useMemo(() => createStyles(colors, controlSize, radius), [colors, controlSize, radius]);
  const displayLabel = label || title || "";
  const { animatedStyle, onPressIn, onPressOut } = usePressBounce(pressScale ?? 0.93);
  const shade = useSharedValue(0);

  const shadeStyle = useAnimatedStyle(() => ({
    opacity: shade.value,
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      onPressIn();
      shade.value = withTiming(0.14, { duration: 80 });
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(
          variant === "primary" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        ).catch(() => undefined);
      }
    }
  };

  const handlePressOut = () => {
    onPressOut();
    shade.value = withTiming(0, { duration: 220 });
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case "secondary":
        return styles.secondary;
      case "ghost":
        return styles.ghost;
      case "outline":
        return styles.outline;
      case "primary":
      default:
        return styles.primary;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case "ghost":
        return styles.ghostText;
      case "outline":
        return styles.outlineText;
      default:
        return styles.text;
    }
  };

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.base,
        getVariantStyle(),
        style,
        animatedStyle,
        (disabled || loading) && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={displayLabel}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      <Animated.View pointerEvents="none" style={[styles.shade, shadeStyle]} />
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={variant === "outline" ? colors.brand.foreground : colors.brand.onFill} size="small" />
        ) : (
          <View style={styles.innerContent}>
            {icon && (
              <View style={styles.iconContainer}>{icon}</View>
            )}
            <Text
              style={[getTextStyle(), typeScale.bodyStrong]}
            >
              {displayLabel}
            </Text>
          </View>
        )}
      </View>
    </AnimatedTouchableOpacity>
  );
};

const createStyles = (
  colors: typeof import("../../theme/colors").darkPalette,
  controlSize: typeof import("../../theme/foundations").controlSize,
  radius: typeof import("../../theme/foundations").radius,
) => StyleSheet.create({
  base: {
    minHeight: controlSize.buttonMinHeight,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    overflow: "hidden",
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.inverse,
  },
  primary: {
    backgroundColor: colors.brand.fill,
  },
  secondary: {
    backgroundColor: colors.bg.surfaceRaised,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: colors.brand.border,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  innerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: colors.brand.onFill,
  },
  ghostText: {
    color: colors.fg.primary,
  },
  outlineText: {
    color: colors.brand.foreground,
  },
  iconContainer: {
    marginRight: 8,
  },
  disabled: {
    opacity: 0.6,
  },
});
