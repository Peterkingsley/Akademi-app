import React, { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "warning";
  onHide?: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = "success",
  onHide,
  duration = 3000,
}) => {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);
  const scale = useSharedValue(0.85);
  const iconScale = useSharedValue(0);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 180 }),
      withDelay(
        duration,
        withTiming(0, { duration: 220 }, (finished) => {
          if (finished && onHide) {
            runOnJS(onHide)();
          }
        }),
      ),
    );
    translateY.value = withSequence(
      withSpring(0, { damping: 11, stiffness: 220, mass: 0.6 }),
      withDelay(duration, withTiming(24, { duration: 220 })),
    );
    scale.value = withSequence(
      withSpring(1, { damping: 9, stiffness: 240, mass: 0.6 }),
      withDelay(duration, withTiming(0.9, { duration: 220 })),
    );
    iconScale.value = withDelay(90, withSpring(1, { damping: 7, stiffness: 260 }));
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const getBackgroundColor = () => {
    switch (type) {
      case "error":
        return colors.error;
      case "warning":
        return colors.warning;
      case "success":
      default:
        return colors.success;
    }
  };

  const Icon = type === "error" ? XCircle : type === "warning" ? AlertTriangle : CheckCircle2;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor() },
        containerStyle,
      ]}
    >
      <Animated.View style={iconStyle}>
        <Icon size={18} color="#FFFFFF" />
      </Animated.View>
      <Text style={[styles.text, typography.bodySmall, { fontWeight: "600" }]}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 9999,
  },
  text: {
    color: "#FFFFFF",
    textAlign: "center",
  },
});
