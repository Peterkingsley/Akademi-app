import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import { Screen } from "../../components/layout/Screen";
import { sessionService, Message } from "../../services/session";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { MathFormula } from "../../components/ui/MathFormula";

const AUTO_STEP_INTERVAL_MS = 1400;

export const BoardReplayScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params || {};
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [title, setTitle] = useState("Board walkthrough");
  const [steps, setSteps] = useState<Array<{ id: string; type: "write" | "highlight" | "answer"; text: string; math?: string; note: string }>>([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalAnswerMath, setFinalAnswerMath] = useState("");
  const [summary, setSummary] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const visibleSteps = steps.slice(0, currentStep);

  useEffect(() => {
    const load = async () => {
      if (!sessionId) {
        setError("No board session found.");
        setLoading(false);
        return;
      }

      try {
        const messages = await sessionService.listMessages(sessionId);
        const studentMessage = messages.find((message) => message.role === "STUDENT");
        const firstAiWithBoard = messages.find(
          (message) => message.role === "AI" && message.metadata?.whiteboard?.payload?.steps?.length
        );

        if (!firstAiWithBoard?.metadata?.whiteboard?.payload) {
          navigation.replace("AssignmentResult", { sessionId });
          return;
        }

        const payload = firstAiWithBoard.metadata.whiteboard.payload;
        setQuestion(studentMessage?.content || "");
        setTitle(payload.title || "Board walkthrough");
        setSteps(payload.steps || []);
        setFinalAnswer(payload.final_answer || "");
        setFinalAnswerMath(payload.final_answer_math || "");
        setSummary(payload.summary || "");
      } catch (loadError) {
        console.error("Failed to load board replay", loadError);
        setError("Could not load the board replay.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigation, sessionId]);

  useEffect(() => {
    if (!isPlaying || loading || steps.length === 0 || currentStep >= steps.length) {
      return;
    }

    timerRef.current = setTimeout(() => {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length));
    }, AUTO_STEP_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStep, isPlaying, loading, steps.length]);

  useEffect(() => {
    if (currentStep >= steps.length && steps.length > 0) {
      setIsPlaying(false);
    }
  }, [currentStep, steps.length]);

  if (loading) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </Screen>
    );
  }

  const moveToStep = (nextStep: number) => {
    setCurrentStep(Math.max(0, Math.min(nextStep, steps.length)));
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Board walkthrough</Text>
          <Text style={styles.headerSubtitle}>{title}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>Question</Text>
          <Text style={styles.questionText}>{question}</Text>
        </View>

        <View style={styles.board}>
          <Text style={styles.boardHeading}>Akademi board</Text>
          {visibleSteps.length === 0 ? (
            <Text style={styles.boardPlaceholder}>Preparing the first step…</Text>
          ) : (
            visibleSteps.map((step, index) => (
              <View
                key={step.id}
                style={[
                  styles.stepCard,
                  step.type === "highlight" && styles.highlightStepCard,
                  step.type === "answer" && styles.answerStepCard,
                ]}
              >
                <Text style={styles.stepIndex}>Step {index + 1}</Text>
                {!!step.text && <Text style={styles.stepText}>{step.text}</Text>}
                {!!step.math && (
                  <View style={styles.mathBlock}>
                    <MathFormula latex={step.math} />
                  </View>
                )}
                {!!step.note && <Text style={styles.stepNote}>{step.note}</Text>}
              </View>
            ))
          )}
        </View>

        {currentStep >= steps.length && (
          <View style={styles.answerCard}>
            <Text style={styles.answerLabel}>Final answer</Text>
            {!!finalAnswerMath ? (
              <View style={styles.finalMathBlock}>
                <MathFormula latex={finalAnswerMath} fontSize={28} />
              </View>
            ) : (
              <Text style={styles.answerText}>{finalAnswer}</Text>
            )}
            {!!finalAnswer && finalAnswerMath && <Text style={styles.answerTextFallback}>{finalAnswer}</Text>}
            {!!summary && <Text style={styles.summaryText}>{summary}</Text>}
          </View>
        )}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.iconControl} onPress={() => moveToStep(currentStep - 1)} disabled={currentStep === 0}>
          <ChevronLeft size={18} color={currentStep === 0 ? colors.textMuted : colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playControl} onPress={() => setIsPlaying((prev) => !prev)}>
          {isPlaying ? <Pause size={18} color={colors.background} /> : <Play size={18} color={colors.background} />}
          <Text style={styles.playControlText}>{isPlaying ? "Pause" : "Play"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconControl} onPress={() => moveToStep(currentStep + 1)} disabled={currentStep >= steps.length}>
          <ChevronRight size={18} color={currentStep >= steps.length ? colors.textMuted : colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconControl} onPress={() => { setIsPlaying(false); moveToStep(0); }}>
          <RotateCcw size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    centeredState: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    errorText: {
      ...typography.body,
      color: colors.textPrimary,
      textAlign: "center",
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    headerCopy: {
      flex: 1,
    },
    headerTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      fontSize: 22,
    },
    headerSubtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 2,
    },
    content: {
      paddingHorizontal: 18,
      paddingBottom: 24,
      gap: 16,
    },
    questionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
    },
    questionLabel: {
      ...typography.label,
      color: colors.textMuted,
      marginBottom: 8,
    },
    questionText: {
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    board: {
      backgroundColor: "#16311D",
      borderColor: "rgba(255,255,255,0.08)",
      borderRadius: 14,
      borderWidth: 1,
      minHeight: 340,
      padding: 16,
    },
    boardHeading: {
      ...typography.label,
      color: "#9AE6B4",
      marginBottom: 12,
    },
    boardPlaceholder: {
      ...typography.body,
      color: "rgba(255,255,255,0.72)",
    },
    stepCard: {
      backgroundColor: "rgba(7, 15, 9, 0.45)",
      borderColor: "rgba(255,255,255,0.06)",
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 10,
      padding: 12,
    },
    highlightStepCard: {
      borderColor: "rgba(34,197,94,0.45)",
    },
    answerStepCard: {
      backgroundColor: "rgba(34,197,94,0.16)",
      borderColor: "rgba(34,197,94,0.55)",
    },
    stepIndex: {
      ...typography.caption,
      color: "#9AE6B4",
      marginBottom: 6,
    },
    stepText: {
      ...typography.body,
      color: "#F7FAFC",
      lineHeight: 23,
    },
    mathBlock: {
      marginTop: 8,
      minHeight: 32,
    },
    stepNote: {
      ...typography.bodySmall,
      color: "rgba(247,250,252,0.76)",
      lineHeight: 18,
      marginTop: 8,
    },
    answerCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
    },
    answerLabel: {
      ...typography.label,
      color: colors.primary,
      marginBottom: 8,
    },
    answerText: {
      ...typography.h3,
      color: colors.textPrimary,
      fontSize: 22,
    },
    finalMathBlock: {
      marginTop: 2,
      minHeight: 40,
    },
    answerTextFallback: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 6,
    },
    summaryText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      lineHeight: 20,
      marginTop: 8,
    },
    controls: {
      alignItems: "center",
      backgroundColor: colors.background,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    iconControl: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    playControl: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 12,
      flexDirection: "row",
      gap: 8,
      height: 44,
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    playControlText: {
      ...typography.bodySmall,
      color: colors.background,
      fontWeight: "700",
    },
  });
