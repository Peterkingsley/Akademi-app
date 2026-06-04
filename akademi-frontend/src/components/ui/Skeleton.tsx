import React, { useEffect } from "react";
import { Dimensions, View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

const SHIMMER_DISTANCE = Dimensions.get("window").width;

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
      [-SHIMMER_DISTANCE, SHIMMER_DISTANCE],
    );
    return {
      transform: [{ translateX }],
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
      <Animated.View style={[styles.shimmer, animatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#252F42",
    opacity: 0.5,
  },
});
