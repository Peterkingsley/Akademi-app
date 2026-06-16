import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { Sparkles, Loader2 } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { useNavigation, useRoute } from "@react-navigation/native";
import { sessionService } from "../../services/session";

const STATUS_TEXTS = [
  "ANALYSING PROBLEM STRUCTURE",
  "CHECKING COURSE CONTEXT",
  "BUILDING YOUR ANSWER",
];

export const AIProcessingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { type, sessionId, reply_mode, courseCode } = route.params || {};

  const [statusIndex, setStatusIndex] = useState(0);
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulsing glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.7,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Progress bar animation
    Animated.loop(
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

    // Status text cycling
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_TEXTS.length);
    }, 1500);

    // Simulate completion and navigation after 5 seconds
    const timeout = setTimeout(async () => {
      if (type === "assignment") {
        try {
          const messages = sessionId ? await sessionService.listMessages(sessionId) : [];
          const hasWhiteboardPayload = messages.some(
            (message) => message.role === "AI" && message.metadata?.whiteboard?.payload?.steps?.length
          );

          if (hasWhiteboardPayload) {
            navigation.navigate("BoardReplay", { sessionId });
          } else if (reply_mode === "STUDY") {
            navigation.navigate("StudyMode", { sessionId });
          } else {
            navigation.navigate("AssignmentResult", { sessionId });
          }
        } catch (error) {
          console.error("Failed to inspect board payload", error);
          if (reply_mode === "STUDY") {
            navigation.navigate("StudyMode", { sessionId });
          } else {
            navigation.navigate("AssignmentResult", { sessionId });
          }
        }
      } else {
        navigation.navigate("LiveTutorSession", { sessionId });
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Screen style={styles.screen}>
      <View style={styles.systemStats}>
        <Text style={[styles.statText, typography.mono]}>LATENCY: 42MS</Text>
        <Text style={[styles.statText, typography.mono]}>TOKEN_GEN: ACTIVE</Text>
        <Text style={[styles.statText, typography.mono]}>MODEL: AKADEMI_OS_V2</Text>
      </View>

      <View style={styles.centerContent}>
        <View style={styles.iconContainer}>
          <Animated.View
            style={[
              styles.glow,
              { opacity: glowAnim }
            ]}
          />
          <View style={styles.sparkleCircle}>
            <Sparkles size={32} color="#C4B5FD" />
          </View>
        </View>

        <Text style={[styles.title, typography.h2]}>Reading your question…</Text>

        <View style={styles.statusPill}>
          <ActivityIndicator size="small" color={colors.textSecondary} style={styles.spinner} />
          <Text style={[styles.statusText, typography.mono]}>{STATUS_TEXTS[statusIndex]}</Text>
        </View>

        <Text style={[styles.contextText, typography.bodySmall]}>
          Checking against your course: <Text style={styles.courseCode}>{courseCode || "your course"}</Text>
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
        </View>
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={styles.cancelBtn}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    justifyContent: "space-between",
    paddingVertical: 40,
    flex: 1,
  },
  systemStats: {
    paddingHorizontal: 20,
    alignItems: "flex-end",
  },
  statText: {
    color: colors.textMuted,
    fontSize: 8.25,
    lineHeight: 18,
  },
  centerContent: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 32,
  },
  glow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accentPurple,
    shadowColor: colors.accentPurple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  sparkleCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 21,
    textAlign: "center",
    marginBottom: 24,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 16,
  },
  spinner: {
    marginRight: 10,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  contextText: {
    color: colors.textSecondary,
  },
  courseCode: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  footer: {
    paddingHorizontal: 0,
    alignItems: "center",
  },
  progressBarBg: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(91, 110, 245, 0.1)",
    marginBottom: 24,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  cancelBtn: {
    height: 40,
  },
});
