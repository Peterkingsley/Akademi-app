import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import { ArrowLeft, GraduationCap, Zap, Search, Sparkles } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { CoursePickerModal } from "../../components/ui/CoursePickerModal";
import { useNavigation, useRoute } from "@react-navigation/native";
import { createAssignmentSession, submitPhotoQuestion } from "../../services/assignment";
import { useAuthStore } from "../../store/useAuthStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  withSequence,
  withRepeat,
} from "react-native-reanimated";
import { AnimatedPressable } from "../../components/ui/AnimatedPressable";

const { width } = Dimensions.get("window");

export const CropConfirmScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { imageUri } = route.params || {};
  const { user } = useAuthStore();
  const userCourses = (user as any)?.courses || [];

  const [strategy, setStrategy] = useState<"step" | "quick">("quick");
  const [course, setCourse] = useState(userCourses[0] || "Select Course");
  const [isCoursePickerVisible, setIsCoursePickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const hasCourse = course !== "Select Course";
  const courseCode = hasCourse ? course : null;

  const shimmerValue = useSharedValue(-width);
  const badgeOpacity = useSharedValue(0);
  const badgeScale = useSharedValue(0.8);

  useEffect(() => {
    // Run shimmer animation across the image once
    shimmerValue.value = withTiming(width * 1.5, { duration: 1200, easing: Easing.inOut(Easing.ease) }, () => {
      // Pop the badge in after shimmer
      badgeOpacity.value = withTiming(1, { duration: 400 });
      badgeScale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) });
    });
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerValue.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: badgeScale.value }],
  }));

  const getPhotoErrorMessage = (error: any) => {
    const serverMessage = error?.response?.data?.message;
    if (typeof serverMessage === "string" && serverMessage.trim()) {
      return serverMessage;
    }
    if (error?.code === "ECONNABORTED") {
      return "The upload took too long. Please check your connection and try again.";
    }
    return "We could not read this image. Retake it with clearer lighting and make sure the full question is visible.";
  };

  const handleSolve = async () => {
    if (!imageUri) return;
    setErrorMessage("");
    setLoading(true);
    try {
      const replyMode = strategy === "quick" ? "DIRECT" : "STUDY";
      const session = await createAssignmentSession(replyMode, courseCode);
      await submitPhotoQuestion(session.id, imageUri, replyMode);

      navigation.navigate("AIProcessing", {
        type: "assignment",
        sessionId: session.id,
        reply_mode: replyMode,
        courseCode,
        imageUri,
      });
    } catch (error) {
      const message = getPhotoErrorMessage(error);
      setErrorMessage(message);
      Alert.alert("Could not read image", message, [
        { text: "Retake", onPress: () => navigation.navigate("Camera") },
        { text: "Try Again", style: "cancel" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.screen} hideHeader>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <AnimatedPressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </AnimatedPressable>
        <Text style={[styles.headerTitle, typography.h4]}>Confirm Analysis</Text>
        <AnimatedPressable onPress={() => navigation.navigate("Camera")} style={styles.headerBtn}>
          <Text style={[styles.retakeText, typography.bodySmall]}>Retake</Text>
        </AnimatedPressable>
      </View>

      {/* HERO IMAGE SECTION */}
      <View style={styles.content}>
        <View style={styles.imageCard}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          
          <Animated.View style={[styles.shimmerLine, shimmerStyle]}>
            <View style={styles.shimmerGlow} />
          </Animated.View>

          <Animated.View style={[styles.badgeOverlay, badgeStyle]}>
            <View style={styles.aiBadge}>
              <Sparkles size={12} color="#FFFFFF" />
              <Text style={[styles.aiBadgeText, typography.mono]}>OCR READY</Text>
            </View>
          </Animated.View>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={[styles.errorTitle, typography.bodySmall]}>Extraction failed</Text>
            <Text style={[styles.errorText, typography.caption]}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>

      {/* BOTTOM CONTROL DOCK */}
      <BlurView intensity={90} tint="dark" style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.dockInner}>
          <View style={styles.dockRow}>
            {/* Course Picker */}
            <AnimatedPressable style={styles.courseBtn} onPress={() => setIsCoursePickerVisible(true)}>
              <GraduationCap size={18} color={hasCourse ? colors.primary : colors.textMuted} />
              <Text style={[styles.courseText, typography.bodySmall, hasCourse && styles.courseTextActive]} numberOfLines={1}>
                {hasCourse ? course : "Subject Context"}
              </Text>
            </AnimatedPressable>

            {/* Strategy Segmented Control */}
            <View style={styles.segmentControl}>
              <AnimatedPressable
                style={[styles.segmentBtn, strategy === "step" && styles.segmentBtnActive]}
                onPress={() => setStrategy("step")}
              >
                <Search size={14} color={strategy === "step" ? "#FFFFFF" : colors.textMuted} />
                <Text style={[styles.segmentText, strategy === "step" && styles.segmentTextActive]}>Step</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.segmentBtn, strategy === "quick" && styles.segmentBtnActive]}
                onPress={() => setStrategy("quick")}
              >
                <Zap size={14} color={strategy === "quick" ? "#FFFFFF" : colors.textMuted} />
                <Text style={[styles.segmentText, strategy === "quick" && styles.segmentTextActive]}>Quick</Text>
              </AnimatedPressable>
            </View>
          </View>

          <Button
            label={loading ? "Analyzing..." : "Solve This"}
            onPress={handleSolve}
            loading={loading}
            disabled={!imageUri || loading}
            style={styles.solveBtn}
            icon={!loading ? <Sparkles size={20} color="#FFFFFF" /> : undefined}
          />
        </View>
      </BlurView>

      <CoursePickerModal
        visible={isCoursePickerVisible}
        onClose={() => setIsCoursePickerVisible(false)}
        onSelect={setCourse}
        selectedCourse={course}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#000",
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  retakeText: {
    color: colors.primary,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  imageCard: {
    width: "100%",
    flex: 1,
    maxHeight: "85%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  shimmerLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  shimmerGlow: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -20,
    right: -20,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
  badgeOverlay: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  aiBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  errorCard: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  errorTitle: {
    color: colors.error,
    fontWeight: "700",
    marginBottom: 4,
  },
  errorText: {
    color: colors.textPrimary,
    lineHeight: 18,
  },
  bottomDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  dockInner: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 20,
  },
  dockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  courseBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    gap: 8,
  },
  courseText: {
    color: colors.textMuted,
    fontWeight: "500",
    flexShrink: 1,
  },
  courseTextActive: {
    color: "#FFFFFF",
  },
  segmentControl: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  segmentBtnActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  solveBtn: {
    height: 56,
    borderRadius: 28,
  },
});
