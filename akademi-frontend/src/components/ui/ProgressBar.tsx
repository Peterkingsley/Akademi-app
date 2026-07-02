import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";

interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  style,
}) => {
  const { colors } = useTheme();
  const fillColor = color || colors.primary;
  const animatedWidth = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const spark = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withSpring(progress, { damping: 14, stiffness: 120, mass: 0.9 });
    spark.value = 0;
    spark.value = withSequence(
      withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 320 })
    );
  }, [progress]);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, []);

  const trackStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-80, 260]) }, { skewX: "-20deg" }],
  }));

  const sparkStyle = useAnimatedStyle(() => ({
    left: `${animatedWidth.value}%`,
    opacity: spark.value,
    transform: [
      { translateX: -6 },
      { scale: interpolate(spark.value, [0, 1], [0.4, 1.6]) },
    ],
  }));

  return (
    <View style={[styles.track, { backgroundColor: colors.border }, style]}>
      <Animated.View style={[styles.fill, trackStyle, { backgroundColor: fillColor }]}>
        <Animated.View style={[styles.shimmer, shimmerStyle]} />
      </Animated.View>
      <Animated.View style={[styles.spark, sparkStyle, { backgroundColor: fillColor }]} pointerEvents="none" />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    overflow: "visible",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  spark: {
    position: "absolute",
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
