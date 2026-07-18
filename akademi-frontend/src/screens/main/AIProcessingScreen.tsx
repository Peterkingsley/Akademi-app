import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { BrainCircuit } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation, useRoute } from "@react-navigation/native";
import { sessionService } from "../../services/session";

const STATUS_TEXTS = [
  "ANALYZING YOUR PROMPT",
  "RETRIEVING COURSE CONTEXT",
  "GENERATING SOLUTION",
  "FINALIZING OUTPUT",
];

export const AIProcessingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { type, sessionId, reply_mode, courseCode } = route.params || {};

  const [statusIndex, setStatusIndex] = useState(0);
  
  // Animation Values
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Continuous pulsing animation for the AI Core
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Cycle status text
    const textInterval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_TEXTS.length);
    }, 2000);

    let isNavigating = false;
    
    const checkStatus = async () => {
      if (isNavigating || type !== "assignment") return;
      
      try {
        const messages = sessionId ? await sessionService.listMessages(sessionId) : [];
        const aiMessage = messages.find(m => m.role === "AI");
        
        if (aiMessage) {
          isNavigating = true;
          
          const hasWhiteboardPayload = aiMessage.metadata?.whiteboard?.payload?.steps?.length;
          
          if (hasWhiteboardPayload) {
            navigation.replace("BoardReplay", { sessionId });
          } else if (reply_mode === "STUDY") {
            navigation.replace("StudyMode", { sessionId });
          } else {
            navigation.replace("AssignmentResult", { sessionId });
          }
        }
      } catch (error) {
        console.error("Polling error in AIProcessingScreen", error);
      }
    };

    // Poll every 1 second
    const pollInterval = setInterval(checkStatus, 1000);
    
    // Safety fallback: If nothing happens after 15 seconds, just route it
    const maxTimeout = setTimeout(() => {
      if (!isNavigating) {
        isNavigating = true;
        if (reply_mode === "STUDY") {
          navigation.replace("StudyMode", { sessionId });
        } else {
          navigation.replace("AssignmentResult", { sessionId });
        }
      }
    }, 15000);

    return () => {
      clearInterval(textInterval);
      clearInterval(pollInterval);
      clearTimeout(maxTimeout);
    };
  }, [pulseAnim, navigation, reply_mode, sessionId, type]);

  const scaleCore1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.2],
  });
  const opacityCore1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0.2],
  });

  const scaleCore2 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });
  const opacityCore2 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.05],
  });

  const title =
    type === "assignment" && reply_mode === "STUDY"
      ? "Preparing Walkthrough..."
      : "Solving Assignment...";

  return (
    <Screen style={styles.screen}>
      <View style={styles.centerContent}>
        
        <View style={styles.coreContainer}>
           <Animated.View style={[styles.orbRing, { transform: [{ scale: scaleCore2 }], opacity: opacityCore2 }]} />
           <Animated.View style={[styles.orbCore, { transform: [{ scale: scaleCore1 }], opacity: opacityCore1 }]} />
           
           <View style={styles.iconCenter}>
             <BrainCircuit size={40} color={colors.primary} />
           </View>
        </View>

        <Text style={styles.title}>{title}</Text>

        <View style={styles.statusPill}>
          <ActivityIndicator size="small" color={colors.textSecondary} style={styles.spinner} />
          <Text style={styles.statusText}>{STATUS_TEXTS[statusIndex]}</Text>
        </View>

        {courseCode ? (
          <Text style={styles.contextText}>
            Using context from <Text style={styles.courseCode}>{courseCode}</Text>
          </Text>
        ) : (
          <Text style={styles.contextText}>
            Synthesizing the clearest possible answer.
          </Text>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  centerContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  coreContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 180,
    width: 180,
    marginBottom: 48,
    position: "relative",
  },
  orbRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary,
  },
  orbCore: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accentPurple,
  },
  iconCenter: {
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceElevated,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    zIndex: 10,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 22,
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  spinner: {
    marginRight: 10,
  },
  statusText: {
    ...typography.mono,
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  contextText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: "80%",
  },
  courseCode: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
});
