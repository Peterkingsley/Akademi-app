import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

interface AIInsightBannerProps {
  text: string;
}

export const AIInsightBanner: React.FC<AIInsightBannerProps> = ({ text }) => {
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
    <View style={styles.container}>
      <Animated.View style={[styles.glowBorder, glowStyle]} />
      <View style={styles.content}>
        <Text
          style={[styles.sparkle, typography.h3, { color: colors.primary }]}
        >
          ✦
        </Text>
        <Text style={[styles.text, typography.mono]}>{text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0D1526",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    // Add glow effect using shadow on iOS/Android or just opacity modulation
    shadowColor: colors.primary,
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
    fontSize: 20,
  },
  text: {
    color: colors.textSecondary,
    flex: 1,
  },
});
