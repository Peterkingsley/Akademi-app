import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import {
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Flag,
  Check,
} from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { SafeArea } from "../../components/layout/SafeArea";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import examPrepService, { MockExam, MockQuestion } from "../../services/examPrep";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Skeleton } from "../../components/ui/Skeleton";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

export const MockExamScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { examId, mockExamId } = route.params;

  const [exam, setExam] = useState<MockExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const timerGlow = useSharedValue(1);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const data = mockExamId
          ? await examPrepService.getMockExam(examId, mockExamId)
          : await examPrepService.startMockExam(examId);
        setExam(data);
        setTimeLeft(data.durationMinutes * 60);
      } catch (error: any) {
        console.error("Failed to fetch mock exam:", error);
        const message = error?.response?.data?.message || "We could not start this mock exam yet.";
        setErrorMessage(message);
        Alert.alert("Mock exam unavailable", message, [
          { text: "Back to Prep Plan", onPress: () => navigation.goBack() },
          { text: "OK", style: "cancel" },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [examId, mockExamId]);

  useEffect(() => {
    if (timeLeft <= 0 || loading) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, loading]);

  useEffect(() => {
    if (timeLeft < 120 && timeLeft > 0) {
      timerGlow.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerStyle = useAnimatedStyle(() => ({
    opacity: timeLeft < 120 ? timerGlow.value : 1,
    color: timeLeft < 120 ? colors.error : colors.warning,
  }));

  const handleExit = () => {
    Alert.alert(
      "Exit Mock Exam?",
      "Your progress will not be saved.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Exit", style: "destructive", onPress: () => navigation.goBack() }
      ]
    );
  };

  const selectAnswer = (option: string) => {
    if (!exam) return;
    const currentQuestionId = exam.questions[currentIndex].id;
    setAnswers(prev => ({ ...prev, [currentQuestionId]: option }));
  };

  const toggleFlag = () => {
    if (!exam) return;
    const currentQuestionId = exam.questions[currentIndex].id;
    setFlagged(prev => ({ ...prev, [currentQuestionId]: !prev[currentQuestionId] }));
  };

  const handleNext = () => {
    if (!exam) return;
    if (currentIndex < exam.questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!exam) return;

    setSubmitting(true);
    try {
      await examPrepService.submitMockExam(examId, exam.id, answers);
      navigation.replace("MockExamResults", { examId, mockExamId: exam.id });
    } catch (error: any) {
      console.error("Failed to submit exam:", error);
      const message = error?.response?.data?.message || "We could not submit your mock exam. Please try again.";
      setErrorMessage(message);
      Alert.alert("Submit failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  const progress = exam ? ((Object.keys(answers).length) / exam.questions.length) * 100 : 0;
  const currentQuestion = exam?.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const aiInsight = useMemo(() => {
    if (!exam) return "";

    const totalQuestions = exam.questions.length;
    const unansweredCount = Math.max(totalQuestions - answeredCount, 0);

    if (unansweredCount === totalQuestions) {
      return `AI INSIGHT: ${totalQuestions} questions loaded. Answer the sure ones first, then flag anything uncertain.`;
    }

    if (flagged[currentQuestion?.id || ""]) {
      return "AI INSIGHT: This question is flagged. Choose your best answer now, then revisit it before submitting.";
    }

    if (unansweredCount === 0) {
      return "AI INSIGHT: All questions have answers. Review flagged items before you submit.";
    }

    return `AI INSIGHT: ${answeredCount} answered, ${unansweredCount} left. Keep a steady pace and use flags for tough questions.`;
  }, [answeredCount, currentQuestion?.id, exam, flagged]);

  const renderQuestionCard = () => {
    if (!currentQuestion) return null;

    return (
      <View style={styles.questionSection}>
        <View style={styles.questionInfoHeader}>
          <Text style={[styles.questionLabel, typography.mono]}>
            QUESTION {currentIndex + 1} OF {exam?.questions.length}
          </Text>
          <Text style={[styles.completionText, typography.mono]}>
            {Math.round(progress)}% Complete
          </Text>
        </View>

        <Text style={[styles.questionTitle, typography.h3]}>
           {currentQuestion.text}
        </Text>

        <Card style={styles.questionCard}>
          <View style={styles.questionTag}>
            <Text style={[styles.questionTagText, typography.caption]}>Q{currentIndex + 1}</Text>
          </View>
          <Text style={[styles.mainQuestionText, typography.body]}>
             {currentQuestion.text}
          </Text>
          {currentQuestion.formula && (
            <View style={styles.formulaBox}>
              <Text style={[styles.formulaText, typography.mono]}>
                {currentQuestion.formula}
              </Text>
            </View>
          )}
        </Card>

        <View style={styles.optionsList}>
          {currentQuestion.options.map((option, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isSelected = answers[currentQuestion.id] === option;

            return (
              <TouchableOpacity
                key={option}
                style={[styles.optionPill, isSelected && styles.optionPillSelected]}
                onPress={() => selectAnswer(option)}
                activeOpacity={0.8}
              >
                <View style={[styles.letterCircle, isSelected && styles.letterCircleSelected]}>
                  <Text style={[styles.letterText, typography.body, isSelected && styles.letterTextSelected]}>
                    {letter}
                  </Text>
                </View>
                <Text style={[styles.optionText, typography.body, isSelected && styles.optionTextSelected]}>
                  {option}
                </Text>
                {isSelected && <Check size={20} color={colors.primary} style={styles.checkIcon} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.flagButton} onPress={toggleFlag}>
          <Flag
            size={18}
            color={flagged[currentQuestion.id] ? colors.error : colors.textMuted}
            fill={flagged[currentQuestion.id] ? colors.error : "transparent"}
            style={styles.flagIcon}
          />
          <Text style={[
            styles.flagText,
            typography.bodySmall,
            { color: flagged[currentQuestion.id] ? colors.error : colors.textMuted }
          ]}>
            Flag for review
          </Text>
        </TouchableOpacity>

        <View style={styles.dotsIndicator}>
           {exam?.questions.map((_, idx) => (
             <View
               key={idx}
               style={[
                 styles.dot,
                 idx === currentIndex && styles.dotActive,
                 answers[exam.questions[idx].id] && styles.dotCompleted
               ]}
             />
           ))}
        </View>
      </View>
    );
  };

  return (
    <SafeArea style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleExit} style={styles.headerIcon}>
          <X size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, typography.body, { fontWeight: '700' }]}>
          {examId} Mock Exam
        </Text>

        <View style={styles.timerPill}>
          <Clock size={14} color={timeLeft < 120 ? colors.error : colors.warning} style={styles.timerIcon} />
          <Animated.Text style={[styles.timerText, typography.mono, timerStyle]}>
            {formatTime(timeLeft)}
          </Animated.Text>
        </View>

        <TouchableOpacity onPress={handleExit} style={styles.exitTextContainer}>
          <Text style={[styles.exitText, typography.bodySmall]}>Exit</Text>
        </TouchableOpacity>
      </View>

      <ProgressBar progress={progress} style={styles.headerProgress} />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {loading ? (
           <Skeleton height={200} borderRadius={12} />
        ) : errorMessage ? (
          <View style={styles.errorState}>
            <Text style={[styles.errorTitle, typography.h3]}>Mock exam unavailable</Text>
            <Text style={[styles.errorText, typography.bodySmall]}>{errorMessage}</Text>
            <Button
              label="Back to Prep Plan"
              onPress={() => navigation.goBack()}
              style={styles.errorButton}
            />
          </View>
        ) : (
          renderQuestionCard()
        )}
      </ScrollView>

      {!errorMessage && (
      <View style={styles.footer}>
         <View style={styles.aiInsightContainer}>
           <TouchableOpacity style={styles.insightPlus}>
             <Plus size={16} color="white" />
           </TouchableOpacity>
           <Text style={[styles.insightText, typography.mono]}>
             {aiInsight}
           </Text>
         </View>

         <View style={styles.navRow}>
           <TouchableOpacity
             style={[styles.prevBtn, currentIndex === 0 && styles.disabledBtn]}
             onPress={handlePrevious}
             disabled={currentIndex === 0}
           >
             <ChevronLeft size={20} color={colors.textPrimary} />
             <Text style={[styles.navBtnText, typography.body]}>Previous</Text>
           </TouchableOpacity>

           <Button
             label={currentIndex === (exam?.questions.length || 0) - 1 ? "Submit Exam" : "Next Question"}
             icon={<ChevronRight size={18} color="white" />}

             onPress={handleNext}
             loading={submitting}
             style={styles.nextBtn}
           />
         </View>
      </View>
      )}
    </SafeArea>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 64,
  },
  headerIcon: {
    width: 40,
  },
  headerTitle: {
    color: colors.textPrimary,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerIcon: {
    marginRight: 6,
  },
  timerText: {
    fontWeight: "700",
  },
  exitTextContainer: {
    width: 40,
    alignItems: "flex-end",
  },
  exitText: {
    color: colors.textSecondary,
  },
  headerProgress: {
    height: 3,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 160,
  },
  questionSection: {
    flex: 1,
  },
  errorState: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  errorTitle: {
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  errorText: {
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  errorButton: {
    width: "100%",
  },
  questionInfoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  questionLabel: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  completionText: {
    color: colors.primary,
    fontSize: 9,
  },
  questionTitle: {
    color: colors.textPrimary,
    marginBottom: 24,
  },
  questionCard: {
    padding: 20,
    backgroundColor: colors.surface,
    marginBottom: 32,
  },
  questionTag: {
    backgroundColor: colors.primary + '20',
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  questionTagText: {
    color: colors.primary,
    fontWeight: "700",
  },
  mainQuestionText: {
    color: colors.textPrimary,
    lineHeight: 24,
  },
  formulaBox: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formulaText: {
    color: colors.primary,
    textAlign: "center",
  },
  optionsList: {
    marginBottom: 32,
  },
  optionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionPillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  letterCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  letterCircleSelected: {
    backgroundColor: colors.primary,
  },
  letterText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  letterTextSelected: {
    color: "#FFFFFF",
  },
  optionText: {
    color: colors.textSecondary,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  checkIcon: {
    marginLeft: 12,
  },
  flagButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  flagIcon: {
    marginRight: 8,
  },
  flagText: {
    fontWeight: "600",
  },
  dotsIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  dotCompleted: {
    backgroundColor: colors.primary + '60',
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
  },
  aiInsightContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1526",
    padding: 12,
    paddingHorizontal: 20,
  },
  insightPlus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  insightText: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingHorizontal: 20,
  },
  prevBtn: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  navBtnText: {
    color: colors.textPrimary,
    marginLeft: 8,
    fontWeight: "600",
  },
  nextBtn: {
    flex: 2,
  },
  disabledBtn: {
    opacity: 0.3,
  },
});
