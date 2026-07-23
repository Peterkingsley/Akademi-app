import React, { useMemo } from "react";
import { TouchableOpacity, View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";
import { usePressBounce } from "../../hooks/usePressBounce";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  onPress?: () => void;
  bordered?: boolean;
  noPadding?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const Card: React.FC<CardProps> = ({
  children,
  style,
  elevated = false,
  onPress,
  bordered = true,
  noPadding = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { animatedStyle, onPressIn, onPressOut } = usePressBounce(0.97);
  const pressed = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: bordered
      ? interpolateColor(pressed.value, [0, 1], [colors.border, colors.primary])
      : "transparent",
  }));

  if (!onPress) {
    return (
      <View
        style={[
          styles.base,
          noPadding && styles.noPadding,
          elevated ? styles.elevated : styles.default,
          bordered && styles.bordered,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const handlePressIn = () => {
    onPressIn();
    pressed.value = withTiming(1, { duration: 120 });
  };

  const handlePressOut = () => {
    onPressOut();
    pressed.value = withTiming(0, { duration: 220 });
  };

  return (
    <AnimatedTouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      style={[
        styles.base,
        noPadding && styles.noPadding,
        elevated ? styles.elevated : styles.default,
        bordered && styles.bordered,
        style,
        animatedStyle,
        borderStyle,
      ]}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  base: {
    borderRadius: 12,
    padding: 16,
    overflow: "hidden",
  },
  noPadding: {
    padding: 0,
  },
  default: {
    backgroundColor: colors.surface,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
