import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { Sparkles } from "lucide-react-native";
import { BrandWordmark } from "../../components/ui/BrandWordmark";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { SafeArea } from "../../components/layout/SafeArea";

export const SplashScreen: React.FC = () => {
  const akademiOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const pillOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. "Akademi" wordmark fades in over 600ms
    akademiOpacity.value = withTiming(1, { duration: 600 });

    // 2. Tagline fades in 300ms after wordmark
    taglineOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));

    // 3. Bottom pill fades in 300ms after tagline
    pillOpacity.value = withDelay(900, withTiming(1, { duration: 300 }));
  }, []);

  const akademiStyle = useAnimatedStyle(() => ({
    opacity: akademiOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <SafeArea style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.systemText}>
            SYSTEM_V1.0.4{"\n"}EST_2024
          </Text>
        </View>

        <View style={styles.center}>
          <Animated.View style={akademiStyle}>
            <BrandWordmark style={styles.wordmark} />
          </Animated.View>
          <Animated.View style={taglineStyle}>
            <Text style={styles.tagline}>LEARN DEEPER. GO FURTHER.</Text>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Animated.View style={[styles.pill, pillStyle]}>
            <Sparkles size={14} color={colors.primary} />
            <Text style={styles.pillText}>AI-ENHANCED PEDAGOGY</Text>
          </Animated.View>
        </View>
      </SafeArea>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginTop: 20,
  },
  systemText: {
    fontFamily: "SpaceMono-Regular",
    fontSize: 7.5,
    color: colors.textMuted,
    lineHeight: 14,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  wordmark: {
    fontFamily: "Inter-Bold",
    fontSize: 30,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  tagline: {
    fontFamily: "SpaceMono-Regular",
    fontSize: 9.75,
    color: colors.textSecondary,
    letterSpacing: 13 * 0.15, // 0.15em
    marginTop: 8,
  },
  footer: {
    marginBottom: 40,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 99,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    fontFamily: "SpaceMono-Regular",
    fontSize: 8.25,
    color: colors.textSecondary,
    letterSpacing: 11 * 0.1, // 0.1em
    marginLeft: 8,
  },
});
