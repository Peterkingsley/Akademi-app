import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowRight, GraduationCap, Sparkles } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";

const { width, height } = Dimensions.get("window");

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setActiveSlide(Math.round(index));
  };

  const nextSlide = () => {
    if (activeSlide < 1) {
      scrollViewRef.current?.scrollTo({ x: width, animated: true });
    } else {
      navigation.navigate("UniversityPicker");
    }
  };

  const skipOnboarding = () => {
    navigation.navigate("Login");
  };

  const handleLogin = () => {
    navigation.navigate("Login");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Slide 1 - Frame 3 */}
        <View style={styles.slide}>
          <TouchableOpacity style={styles.skipButton} onPress={skipOnboarding}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <View style={styles.illustrationArea}>
            <View style={styles.illustrationCard}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.placeholderText}>[Nigerian Student Illustration]</Text>
              </View>
              <View style={styles.badgeChip}>
                <Text style={styles.systemStatusLabel}>SYSTEM STATUS</Text>
                <Text style={styles.systemStatusValue}>
                  Personalized curriculum optimized for JAMB 2024.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.contentArea}>
            <Text style={styles.headline}>
              Built for <Text style={{ color: colors.primary }}>you</Text>
            </Text>
            <Text style={styles.body}>
              Tailored learning paths that adapt to your pace, your goals, and
              your dreams.
            </Text>
          </View>

          <View style={styles.bottomArea}>
            <View style={styles.progressDots}>
              <View style={[styles.dot, styles.activeDot, styles.pillDot]} />
              <View style={[styles.dot, styles.inactiveDot]} />
              <View style={[styles.dot, styles.inactiveDot]} />
            </View>
            <Button
              label="Get Started"
              onPress={nextSlide}
              icon={<ArrowRight size={20} color={colors.textPrimary} />}
            />
          </View>
        </View>

        {/* Slide 2 - Frame 38 */}
        <View style={styles.slide}>
          <View style={styles.slide2Header}>
            <View style={styles.logoContainer}>
              <GraduationCap size={24} color={colors.primary} />
              <Text style={styles.logoText}>Akademi</Text>
            </View>
            <View style={styles.progressIndicators}>
              <View style={[styles.indicator, styles.activeIndicator]} />
              <View style={styles.indicator} />
              <View style={styles.indicator} />
              <View style={styles.indicator} />
            </View>
          </View>

          <View style={styles.heroImageContainer}>
            <View style={styles.heroImagePlaceholder}>
              <Text style={styles.placeholderText}>[Nigerian Student Photo]</Text>
            </View>
            <LinearGradient
              colors={["transparent", colors.background]}
              style={styles.imageOverlay}
            />
          </View>

          <View style={styles.slide2Content}>
            <Text style={styles.slide2Headline}>
              The tutor you always needed.{"\n"}
              <Text style={{ color: colors.primary }}>Finally here.</Text>
            </Text>
            <Text style={styles.slide2Body}>
              Akademi helps you solve assignments, understand topics, and
              prepare for exams — all in one place.
            </Text>

            <View style={styles.slide2Buttons}>
              <Button
                label="Let's go"
                onPress={nextSlide}
                icon={<ArrowRight size={20} color={colors.textPrimary} />}
                style={styles.mainButton}
              />
              <Button
                label="Already have an account?"
                variant="secondary"
                onPress={handleLogin}
                style={styles.secondaryButton}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  slide: {
    width: width,
    height: height,
    paddingHorizontal: 24,
  },
  skipButton: {
    position: "absolute",
    top: 60,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 11.25,
    fontFamily: "Inter-Regular",
  },
  illustrationArea: {
    height: height * 0.45,
    marginTop: 100,
    justifyContent: "center",
  },
  illustrationCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 24,
    height: 300,
    position: "relative",
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  badgeChip: {
    position: "absolute",
    bottom: -16,
    right: 16,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 200,
  },
  systemStatusLabel: {
    color: colors.textMuted,
    fontSize: 7.5,
    fontFamily: "SpaceMono-Regular",
    marginBottom: 4,
  },
  systemStatusValue: {
    color: colors.textPrimary,
    fontSize: 9.75,
    fontFamily: "Inter-Regular",
  },
  contentArea: {
    marginTop: 40,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 24,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    lineHeight: 40,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    lineHeight: 24,
    marginTop: 16,
  },
  bottomArea: {
    position: "absolute",
    bottom: 50,
    left: 24,
    right: 24,
  },
  progressDots: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: "#1F2937",
  },
  activeDot: {
    backgroundColor: colors.primary,
  },
  pillDot: {
    width: 24,
  },
  // Slide 2 Styles
  slide2Header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 60,
    zIndex: 10,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoText: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    marginLeft: 8,
  },
  progressIndicators: {
    flexDirection: "row",
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1F2937",
    marginLeft: 6,
  },
  activeIndicator: {
    backgroundColor: colors.primary,
  },
  heroImageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.55,
  },
  heroImagePlaceholder: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  placeholderText: {
    color: colors.textMuted,
    fontFamily: "SpaceMono-Regular",
    fontSize: 9,
  },
  slide2Content: {
    marginTop: height * 0.5,
    flex: 1,
  },
  slide2Headline: {
    color: colors.textPrimary,
    fontSize: 27,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    lineHeight: 44,
  },
  slide2Body: {
    color: colors.textSecondary,
    fontSize: 11.25,
    fontFamily: "Inter-Regular",
    lineHeight: 22,
    marginTop: 12,
  },
  slide2Buttons: {
    marginTop: 32,
  },
  mainButton: {
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
