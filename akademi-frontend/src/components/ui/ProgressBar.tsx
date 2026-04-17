import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
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
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withSpring(progress);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  return (
    <View style={[styles.track, { backgroundColor: colors.border }, style]}>
      <Animated.View
        style={[
          styles.fill,
          animatedStyle,
          { backgroundColor: color || colors.primary }
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
});
