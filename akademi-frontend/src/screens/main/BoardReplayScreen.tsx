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
import { RichMathText } from "../../components/ui/RichMathText";
import { GraphRenderer } from "../../components/graph/GraphRenderer";
import { GraphSpec } from "../../components/graph/types";
import { BoardStep, isMeaningfulStep } from "../../components/board/boardTypes";
import { BoardStepCard } from "../../components/board/BoardStepCard";
import { BoardFinalAnswerCard } from "../../components/board/BoardFinalAnswerCard";

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
  const [steps, setSteps] = useState<BoardStep[]>([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalAnswerMath, setFinalAnswerMath] = useState("");
  const [summary, setSummary] = useState("");
  const [graphSpec, setGraphSpec] = useState<GraphSpec | null>(null);
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
        setGraphSpec(firstAiWithBoard.metadata?.graph?.payload || null);
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
        <View style={styles.questionBlock}>
          <Text style={styles.questionLabel}>Question</Text>
          <RichMathText content={question} textColor={colors.textPrimary} fontSize={16} lineHeight={1.45} />
        </View>

        <View style={styles.board}>
          <View style={styles.boardHeadingRow}>
            <Text style={styles.boardProgress}>
              {steps.length > 0 ? `${visibleStepCount}/${steps.length} steps` : "Starting"}
            </Text>
          </View>
          {visibleSteps.length === 0 ? (
            <Text style={styles.boardPlaceholder}>Setting up the first step...</Text>
          ) : (
            visibleSteps.map((step, index) => <BoardStepCard key={step.id} step={step} index={index} />)
          )}
        </View>

        {currentStep >= steps.length && (
          <BoardFinalAnswerCard finalAnswer={finalAnswer} finalAnswerMath={finalAnswerMath} summary={summary} />
        )}

        {currentStep >= steps.length && graphSpec && (
          <View style={styles.graphCard}>
            <GraphRenderer spec={graphSpec} />
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
    questionBlock: {
      marginBottom: 4,
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
      minHeight: 340,
    },
    boardHeadingRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: 12,
    },
    boardProgress: {
      ...typography.caption,
      color: colors.textMuted,
    },
    boardPlaceholder: {
      ...typography.body,
      color: colors.textSecondary,
    },
    graphCard: {
      marginTop: 4,
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
