import React from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useTheme } from "../../theme/ThemeContext";

export interface PressableSurfaceProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  selected?: boolean;
  busy?: boolean;
  enforceMinTouchTarget?: boolean;
}

export const PressableSurface: React.FC<PressableSurfaceProps> = ({
  children,
  style,
  pressedStyle,
  selected = false,
  busy = false,
  disabled = false,
  enforceMinTouchTarget = true,
  accessibilityRole = "button",
  accessibilityState,
  ...props
}) => {
  const { controlSize } = useTheme();
  const reduceMotion = useReducedMotion();
  const unavailable = disabled || busy;

  return (
    <Pressable
      {...props}
      disabled={unavailable}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        ...accessibilityState,
        disabled: unavailable,
        selected,
        busy,
      }}
      style={({ pressed }) => [
        enforceMinTouchTarget && {
          minHeight: controlSize.minTouch,
          minWidth: controlSize.minTouch,
        },
        style,
        pressed && !unavailable && styles.pressed,
        pressed && !unavailable && !reduceMotion && styles.pressedMotion,
        pressed && !unavailable && pressedStyle,
        unavailable && styles.unavailable,
      ]}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressed: { opacity: 0.84 },
  pressedMotion: { transform: [{ scale: 0.98 }] },
  unavailable: { opacity: 0.62 },
});
