import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerValue.value,
      [0, 1],
      [-100, 100], // Relative percentages
    );
    return {
      transform: [{ translateX: `${translateX}%` }],
    };
  });

  return (
    <View
      style={[
        styles.base,
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: colors.surfaceElevated,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          animatedStyle,
          { backgroundColor: isDark ? "#252F42" : "#E5E7EB", opacity: 0.5 }
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
});
