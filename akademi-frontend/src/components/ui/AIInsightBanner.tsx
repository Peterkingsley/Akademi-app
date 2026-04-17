import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";

interface AIInsightBannerProps {
  text: string;
}

export const AIInsightBanner: React.FC<AIInsightBannerProps> = ({ text }) => {
  const { colors, typography, isDark } = useTheme();
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 }),
      ),
      -1,
      true,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#0D1526" : "#F0F9FF",
          borderLeftColor: colors.primary,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.glowBorder,
          glowStyle,
          {
            borderLeftColor: colors.primary,
            shadowColor: colors.primary,
          },
        ]}
      />
      <View style={styles.content}>
        <Text
          style={[
            styles.sparkle,
            typography.h3,
            { color: colors.primary }
          ]}
        >
          ✦
        </Text>
        <Text
          style={[
            typography.mono,
            { color: colors.textSecondary, flex: 1 }
          ]}
        >
          {text}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderLeftWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  sparkle: {
    marginRight: 10,
  },
});
