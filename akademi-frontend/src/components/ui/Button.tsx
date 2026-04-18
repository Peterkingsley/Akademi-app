import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

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
  style?: ViewStyle;
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
}) => {
  const displayLabel = label || title || "";
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.97);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
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
        (disabled || loading) && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={displayLabel}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={variant === "outline" ? colors.primary : "#FFFFFF"} size="small" />
        ) : (
          <Animated.View style={[styles.innerContent, animatedStyle]}>
            {icon && (
              <View style={styles.iconContainer}>{icon}</View>
            )}
            <Text
              style={[getTextStyle(), typography.body, { fontWeight: "600" }]}
            >
              {displayLabel}
            </Text>
          </Animated.View>
        )}
      </View>
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: colors.primary,
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
    color: "#FFFFFF",
    fontSize: 12,
  },
  ghostText: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  outlineText: {
    color: colors.primary,
    fontSize: 12,
  },
  iconContainer: {
    marginRight: 8,
  },
  disabled: {
    opacity: 0.6,
  },
});
