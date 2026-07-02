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
import { sessionService } from "../../services/session";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { MathFormula } from "../../components/ui/MathFormula";
import { RichMathText } from "../../components/ui/RichMathText";

const AUTO_STEP_INTERVAL_MS = 1400;

type BoardStep = {
  id: string;
  type: "write" | "highlight" | "answer";
  text: string;
  math?: string;
  note: string;
};

// Defense in depth: even if a malformed LaTeX fragment slips through the backend, never show its raw
// broken source to the student - KaTeX renders unbalanced braces as visible red error text.
const hasBalancedBraces = (value: string) => {
  let depth = 0;
  for (const char of value) {
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
};

const isRenderableMath = (value?: string) => !!value && !!value.trim() && hasBalancedBraces(value);

const isMeaningfulStep = (step: BoardStep) =>
  !!step.text.trim() || isRenderableMath(step.math) || !!step.note.trim();

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
  const [steps, setSteps] = useState<BoardStep[]>([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalAnswerMath, setFinalAnswerMath] = useState("");
  const [summary, setSummary] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const visibleSteps = steps.slice(0, currentStep);
  const visibleStepCount = Math.min(currentStep, steps.length);

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
        setSteps((payload.steps || []).filter(isMeaningfulStep));
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

  const moveToStep = (nextStep: number) => {
    setCurrentStep(Math.max(0, Math.min(nextStep, steps.length)));
  };

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
          <RichMathText content={question} textColor={colors.textPrimary} fontSize={16} lineHeight={1.45} />
        </View>

        <View style={styles.board}>
          <View style={styles.boardHeadingRow}>
            <Text style={styles.boardHeading}>Akademi board</Text>
            <Text style={styles.boardProgress}>
              {steps.length > 0 ? `${visibleStepCount}/${steps.length} steps` : "Starting"}
            </Text>
          </View>
          {visibleSteps.length === 0 ? (
            <Text style={styles.boardPlaceholder}>Setting up the first step...</Text>
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
                {!!step.text && (
                  <RichMathText content={step.text} textColor="#F7FAFC" fontSize={16} lineHeight={1.45} />
                )}
                {isRenderableMath(step.math) && (
                  <View style={styles.mathBlock}>
                    <MathFormula latex={step.math!} fontSize={17} />
                  </View>
                )}
                {!!step.note && (
                  <RichMathText
                    content={step.note}
                    textColor="rgba(247,250,252,0.76)"
                    fontSize={14}
                    lineHeight={1.35}
                  />
                )}
              </View>
            ))
          )}
        </View>

        {currentStep >= steps.length && (
          <View style={styles.answerCard}>
            <Text style={styles.answerLabel}>Worked answer</Text>
            {isRenderableMath(finalAnswerMath) ? (
              <View style={styles.finalMathBlock}>
                <MathFormula latex={finalAnswerMath} fontSize={21} />
              </View>
            ) : (
              <RichMathText content={finalAnswer} textColor={colors.textPrimary} fontSize={22} lineHeight={1.4} />
            )}
            {!!finalAnswer && finalAnswerMath && <RichMathText content={finalAnswer} textColor={colors.textSecondary} fontSize={14} lineHeight={1.4} />}
            {!!summary && <RichMathText content={summary} textColor={colors.textSecondary} fontSize={14} lineHeight={1.45} />}
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
        <TouchableOpacity
          style={styles.iconControl}
          onPress={() => {
            setIsPlaying(false);
            moveToStep(0);
          }}
        >
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
    boardHeadingRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    boardHeading: {
      ...typography.label,
      color: "#9AE6B4",
    },
    boardProgress: {
      ...typography.caption,
      color: "rgba(247,250,252,0.74)",
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
      justifyContent: "center",
      paddingHorizontal: 18,
      paddingVertical: 14,
      gap: 10,
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
      borderRadius: 10,
      flexDirection: "row",
      gap: 8,
      height: 44,
      justifyContent: "center",
      minWidth: 120,
      paddingHorizontal: 18,
    },
    playControlText: {
      ...typography.bodySmall,
      color: colors.background,
      fontWeight: "700",
    },
  });
