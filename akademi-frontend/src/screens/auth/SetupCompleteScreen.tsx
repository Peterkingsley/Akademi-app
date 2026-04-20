import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Check, ArrowRight } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { useAuthStore } from "../../store/useAuthStore";

const COURSES = ["EEE 301", "MTH 201", "CSC 312", "EEE 305"];

export const SetupCompleteScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const setAuth = useAuthStore((state) => state.setAuth);

  const checkScale = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const courseOpacities = COURSES.map(() => useSharedValue(0));

  useEffect(() => {
    // 1. Checkmark circle scales from 0 to 1.2 then settles at 1.0
    checkScale.value = withSpring(1, { damping: 12, stiffness: 100 });

    // 2. Headline and body fade up 150ms stagger after checkmark
    contentOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));

    // 3. Course pills appear one by one with 80ms stagger
    COURSES.forEach((_, index) => {
      courseOpacities[index].value = withDelay(
        800 + index * 80,
        withTiming(1, { duration: 400 })
      );
    });
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: withTiming(contentOpacity.value === 1 ? 0 : 20, { duration: 600 }) }],
  }));

  const handleGoHome = () => {
    // Set a dummy user to trigger the navigation shift in RootNavigator
    setAuth(
      { id: "1", email: "student@unilag.edu.ng", name: "Jules" },
      "dummy_access_token",
      "dummy_refresh_token"
    );
  };

  return (
    <Screen scrollable style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.center}>
          <Animated.View style={[styles.checkCircle, checkStyle]}>
            <Check size={32} color={colors.success} strokeWidth={3} />
          </Animated.View>

          <Animated.View style={[styles.celebrationPill, contentStyle]}>
            <Text style={styles.celebrationText}>Account Verified! 🎉</Text>
          </Animated.View>

          <Animated.View style={[styles.textContainer, contentStyle]}>
            <Text style={styles.headline}>Setup Complete</Text>
            <Text style={styles.body}>
              Your personalized learning dashboard is ready. Time to smash those goals.
            </Text>
          </Animated.View>

          <View style={styles.syncSection}>
            <Text style={styles.syncLabel}>CURRICULUM SYNCED</Text>
            <View style={styles.courseRow}>
              {COURSES.map((course, index) => {
                const animatedStyle = useAnimatedStyle(() => ({
                  opacity: courseOpacities[index].value,
                  transform: [{ scale: withSpring(courseOpacities[index].value) }],
                }));
                return (
                  <Animated.View key={course} style={[styles.coursePill, animatedStyle]}>
                    <Text style={styles.courseText}>{course}</Text>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            label="Go to Home"
            onPress={handleGoHome}
            icon={<ArrowRight size={20} color={colors.textPrimary} />}
          />
          <Text style={styles.footerMotto}>
            KNOWLEDGE IS POWER • SUCCESS AWAITS
          </Text>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -40,
  },
  checkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#052e16",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  celebrationPill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  celebrationText: {
    color: colors.textPrimary,
    fontSize: 10.5,
    fontFamily: "Inter-Medium",
  },
  textContainer: {
    alignItems: "center",
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 24,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 24,
  },
  syncSection: {
    marginTop: 48,
    width: "100%",
  },
  syncLabel: {
    color: colors.textMuted,
    fontSize: 8.25,
    fontFamily: "SpaceMono-Regular",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 1,
  },
  courseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  coursePill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  courseText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
  },
  footer: {
    marginBottom: 80,
    alignItems: "center",
  },
  footerMotto: {
    color: colors.textMuted,
    fontSize: 7.5,
    fontFamily: "SpaceMono-Regular",
    marginTop: 20,
    letterSpacing: 1,
  },
});
