import React, { useRef, useState } from "react";
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowRight, BookOpen, GraduationCap, ScanLine, Target } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Button } from "../../components/ui/Button";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const { width, height } = Dimensions.get("window");

const onboardingFemale = require("../../../assets/images/onboarding-female.jpg");
const onboardingMale = require("../../../assets/images/onboarding-male.jpg");

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    setActiveSlide(Math.round(event.nativeEvent.contentOffset.x / slideSize));
  };

  const nextSlide = () => {
    if (activeSlide < 1) {
      scrollViewRef.current?.scrollTo({ x: width, animated: true });
      return;
    }

    navigation.navigate("UniversityPicker");
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
        <View style={styles.slide}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideContent}>
            <View style={styles.topBar}>
              <View style={styles.logoContainer}>
                <GraduationCap size={22} color={colors.primary} />
                <Text style={styles.logoText}>Akademi</Text>
              </View>
              <TouchableOpacity onPress={handleLogin} activeOpacity={0.8}>
                <Text style={styles.signInTop}>Sign in</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.illustrationArea}>
              <View style={styles.illustrationCard}>
                <Image source={onboardingFemale} style={styles.illustrationImage} resizeMode="cover" />
                <View style={styles.badgeChip}>
                  <Text style={styles.badgeLabel}>MVP BETA</Text>
                  <Text style={styles.badgeValue}>Materials, CBT practice, and live tutor in one flow.</Text>
                </View>
              </View>
            </View>

            <View style={styles.contentArea}>
              <Text style={styles.headline}>
                Study with your <Text style={styles.greenText}>real course context</Text>
              </Text>
              <Text style={styles.body}>
                Open verified materials, ask Akademi questions, practice CBT, and keep your prep organized around your department.
              </Text>
            </View>

            <View style={styles.featureRow}>
              <View style={styles.featureItem}>
                <BookOpen size={17} color={colors.primary} />
                <Text style={styles.featureText}>Verified library</Text>
              </View>
              <View style={styles.featureItem}>
                <ScanLine size={17} color="#38BDF8" />
                <Text style={styles.featureText}>Photo solving</Text>
              </View>
            </View>

            <View style={styles.bottomArea}>
              <View style={styles.progressDots}>
                <View style={[styles.dot, styles.activeDot, styles.pillDot]} />
                <View style={[styles.dot, styles.inactiveDot]} />
              </View>
              <Button label="Continue" onPress={nextSlide} icon={<ArrowRight size={18} color={colors.textPrimary} />} />
            </View>
          </ScrollView>
        </View>

        <View style={styles.slide}>
          <View style={styles.slide2Header}>
            <View style={styles.logoContainer}>
              <GraduationCap size={22} color={colors.primary} />
              <Text style={styles.logoText}>Akademi</Text>
            </View>
            <View style={styles.progressIndicators}>
              <View style={styles.indicator} />
              <View style={[styles.indicator, styles.activeIndicator]} />
            </View>
          </View>

          <View style={styles.heroImageContainer}>
            <Image source={onboardingMale} style={styles.heroImage} resizeMode="cover" />
            <LinearGradient colors={["transparent", colors.background]} style={styles.imageOverlay} />
          </View>

          <ScrollView style={styles.slide2Content} contentContainerStyle={styles.slide2ScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.liveBadge}>
              <Target size={15} color={colors.primary} />
              <Text style={styles.liveBadgeText}>Free beta access</Text>
            </View>
            <Text style={styles.slide2Headline}>
              Your academic command center.{"\n"}
              <Text style={styles.greenText}>Built for Android beta.</Text>
            </Text>
            <Text style={styles.slide2Body}>
              Create your academic profile once. Akademi uses it to match materials, assignment help, live tutor sessions, and exam prep.
            </Text>

            <View style={styles.slide2Buttons}>
              <Button
                label="Create your profile"
                onPress={nextSlide}
                icon={<ArrowRight size={18} color={colors.textPrimary} />}
                style={styles.mainButton}
              />
              <Button
                label="Already have an account?"
                variant="secondary"
                onPress={handleLogin}
                style={styles.secondaryButton}
              />
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  slide: {
    height,
    paddingHorizontal: 24,
    width,
  },
  slideContent: {
    paddingBottom: 54,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
  },
  logoContainer: {
    alignItems: "center",
    flexDirection: "row",
  },
  logoText: {
    ...typography.h4,
    color: colors.textPrimary,
    marginLeft: 8,
  },
  signInTop: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
  },
  illustrationArea: {
    height: height * 0.42,
    justifyContent: "center",
    marginTop: 34,
  },
  illustrationCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 292,
    padding: 14,
    position: "relative",
  },
  illustrationImage: {
    borderRadius: 8,
    height: "100%",
    width: "100%",
  },
  badgeChip: {
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    bottom: -18,
    maxWidth: 214,
    padding: 12,
    position: "absolute",
    right: 16,
  },
  badgeLabel: {
    ...typography.label,
    color: colors.primary,
    fontSize: 8,
    marginBottom: 4,
  },
  badgeValue: {
    ...typography.caption,
    color: colors.textPrimary,
    lineHeight: 15,
  },
  contentArea: {
    marginTop: 36,
  },
  headline: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 27,
    lineHeight: 36,
  },
  greenText: {
    color: colors.primary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 12,
  },
  featureRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  featureItem: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  featureText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700",
    marginLeft: 8,
  },
  bottomArea: {
    marginTop: 28,
  },
  progressDots: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 22,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    marginRight: 8,
  },
  inactiveDot: {
    backgroundColor: "#1F2937",
    width: 8,
  },
  activeDot: {
    backgroundColor: colors.primary,
  },
  pillDot: {
    width: 24,
  },
  slide2Header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
    zIndex: 10,
  },
  progressIndicators: {
    flexDirection: "row",
  },
  indicator: {
    backgroundColor: "#1F2937",
    borderRadius: 4,
    height: 8,
    marginLeft: 6,
    width: 8,
  },
  activeIndicator: {
    backgroundColor: colors.primary,
    width: 24,
  },
  heroImageContainer: {
    height: height * 0.56,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  heroImage: {
    height: "100%",
    width: "100%",
  },
  imageOverlay: {
    bottom: 0,
    height: 170,
    left: 0,
    position: "absolute",
    right: 0,
  },
  slide2Content: {
    flex: 1,
    marginTop: height * 0.48,
  },
  slide2ScrollContent: {
    paddingBottom: 56,
  },
  liveBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
    marginLeft: 6,
  },
  slide2Headline: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 26,
    lineHeight: 36,
  },
  slide2Body: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 12,
  },
  slide2Buttons: {
    marginTop: 26,
  },
  mainButton: {
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderColor: colors.border,
    borderWidth: 1,
  },
});
