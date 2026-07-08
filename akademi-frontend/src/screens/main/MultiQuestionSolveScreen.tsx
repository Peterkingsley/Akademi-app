import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SelectableText } from "../../components/ui/SelectableText";
import { AskAkademiModal } from "../../components/ui/AskAkademiModal";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { sessionService } from "../../services/session";

type QuestionEntry = { index: number; text: string };

export const MultiQuestionSolveScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { sessionId, questions } = route.params as {
    sessionId: string;
    questions: QuestionEntry[];
  };

  const total = questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [errorByIndex, setErrorByIndex] = useState<Record<number, string>>({});
  const [isAskModalVisible, setIsAskModalVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  // Tracks indexes that have an in-flight or completed solve call so the
  // background prefetch and the on-arrival solve never race each other.
  const requestedIndexes = useRef<Set<number>>(new Set());

  const currentQuestion = questions[currentIndex];
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  const solveIndex = useCallback(
    async (index: number, opts: { isForeground: boolean }) => {
      if (index < 0 || index >= total) return;
      if (requestedIndexes.current.has(index)) return;
      requestedIndexes.current.add(index);

      if (opts.isForeground) setLoadingIndex(index);

      try {
        const result = await sessionService.solveQuestion(sessionId, index);
        setAnswers((prev) => ({ ...prev, [index]: result.answer.content }));
        setErrorByIndex((prev) => {
          if (!prev[index]) return prev;
          const next = { ...prev };
          delete next[index];
          return next;
        });
      } catch (error: any) {
        requestedIndexes.current.delete(index);
        setErrorByIndex((prev) => ({
          ...prev,
          [index]: error?.response?.data?.message || "Could not solve this question. Try again.",
        }));
      } finally {
        if (opts.isForeground) setLoadingIndex((prev) => (prev === index ? null : prev));
      }
    },
    [sessionId, total]
  );

  useEffect(() => {
    if (!currentQuestion) return;
    if (answers[currentIndex] === undefined) {
      solveIndex(currentIndex, { isForeground: true });
    }
    // Quietly warm the next question so tapping Next feels instant, without
    // blocking or racing the current question's own solve call.
    if (currentIndex + 1 < total && answers[currentIndex + 1] === undefined) {
      solveIndex(currentIndex + 1, { isForeground: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const handleRetry = (index: number) => {
    requestedIndexes.current.delete(index);
    setErrorByIndex((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    solveIndex(index, { isForeground: true });
  };

  const handlePrevious = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    Alert.alert("All done", "You have gone through every question in this assignment.", [
      { text: "Back to Solve", onPress: () => navigation.navigate("Solve") },
    ]);
  };

  const isCurrentLoading = loadingIndex === currentIndex && answers[currentIndex] === undefined;
  const currentError = errorByIndex[currentIndex];

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.h3]} numberOfLines={1}>
          Assignment Solve
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.progressWrap}>
        <Text style={[styles.progressLabel, typography.mono]}>
          QUESTION {currentIndex + 1} OF {total}
        </Text>
        <ProgressBar progress={progress} style={styles.progressBar} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.questionCard}>
          <Text style={[styles.monoLabel, typography.mono]}>QUESTION {currentIndex + 1}</Text>
          <SelectableText
            content={currentQuestion?.text || ""}
            onAskAkademi={(text) => {
              setSelectedText(text);
              setIsAskModalVisible(true);
            }}
          />
        </Card>

        <Card style={styles.answerCard}>
          <Text style={[styles.monoLabel, typography.mono]}>AKADEMI SYNTHESIS</Text>

          {isCurrentLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, typography.bodySmall]}>Solving this question...</Text>
            </View>
          ) : currentError ? (
            <View style={styles.errorBlock}>
              <Text style={[styles.errorText, typography.bodySmall]}>{currentError}</Text>
              <Button label="Retry" onPress={() => handleRetry(currentIndex)} style={styles.retryBtn} />
            </View>
          ) : (
            <SelectableText
              content={answers[currentIndex] || ""}
              onAskAkademi={(text) => {
                setSelectedText(text);
                setIsAskModalVisible(true);
              }}
            />
          )}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.prevBtn, currentIndex === 0 && styles.disabledBtn]}
          onPress={handlePrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={20} color={colors.textPrimary} />
          <Text style={[styles.navBtnText, typography.body]}>Previous</Text>
        </TouchableOpacity>

        <Button
          label={currentIndex === total - 1 ? "Finish" : "Next Question"}
          icon={<ChevronRight size={18} color="#FFFFFF" />}
          onPress={handleNext}
          style={styles.nextBtn}
        />
      </View>

      <AskAkademiModal
        visible={isAskModalVisible}
        onClose={() => setIsAskModalVisible(false)}
        contextText={selectedText}
      />
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 4,
      marginBottom: 4,
    },
    backBtn: {
      padding: 4,
    },
    headerSpacer: {
      width: 22,
    },
    headerTitle: {
      color: colors.textPrimary,
      flex: 1,
      fontWeight: "600",
      textAlign: "center",
    },
    progressWrap: {
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    progressLabel: {
      color: colors.textMuted,
      fontSize: 11,
      marginBottom: 8,
    },
    progressBar: {
      marginBottom: 2,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    monoLabel: {
      color: colors.textMuted,
      fontSize: 10,
      marginBottom: 8,
    },
    questionCard: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      marginBottom: 16,
    },
    answerCard: {
      backgroundColor: colors.surface,
      marginBottom: 16,
      minHeight: 100,
    },
    loadingRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      paddingVertical: 12,
    },
    loadingText: {
      color: colors.textSecondary,
    },
    errorBlock: {
      paddingVertical: 8,
    },
    errorText: {
      color: colors.error,
      marginBottom: 12,
    },
    retryBtn: {
      alignSelf: "flex-start",
      minWidth: 120,
    },
    footer: {
      alignItems: "center",
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
      paddingBottom: 20,
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    prevBtn: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      paddingVertical: 12,
    },
    disabledBtn: {
      opacity: 0.4,
    },
    navBtnText: {
      color: colors.textPrimary,
    },
    nextBtn: {
      flex: 1,
      height: 50,
      borderRadius: 24,
      maxWidth: 200,
    },
  });
