import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AxiosError } from "axios";
import { Check, CheckCircle2, ChevronLeft, Lightbulb, X, XCircle } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { RichMathText } from "../../components/ui/RichMathText";
import examPrepService, {
  ExamPrepSessionSummary,
  ExamPrepTeachingFeedback,
  GuidedExamPrepSession,
} from "../../services/examPrep";
import { MainStackParamList } from "../../navigation/types";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

type GuidedQuestionPhase = "LOADING" | "ANSWERING" | "REASONING" | "SUBMITTING" | "FEEDBACK" | "COMPLETE";

const requestMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ message?: string }>)?.response?.data?.message || fallback;

export const ExamPrepSessionScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "ExamPrepSession">>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [phase, setPhase] = useState<GuidedQuestionPhase>("LOADING");
  const [session, setSession] = useState<GuidedExamPrepSession | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [feedback, setFeedback] = useState<ExamPrepTeachingFeedback | null>(null);
  const [summary, setSummary] = useState<ExamPrepSessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const applySession = (loaded: GuidedExamPrepSession) => {
    setSession(loaded);
    setError(null);
    if (loaded.currentAttempt) {
      setSelectedAnswer(loaded.currentAttempt.feedback.selectedAnswer);
      setReasoning(loaded.currentAttempt.reasoning);
      setFeedback(loaded.currentAttempt.feedback);
      setPhase("FEEDBACK");
    } else {
      setSelectedAnswer("");
      setReasoning("");
      setFeedback(null);
      setPhase("ANSWERING");
    }
  };

  const loadSession = async () => {
    try {
      setPhase("LOADING");
      applySession(await examPrepService.getGuidedSession(route.params.sessionId));
    } catch (requestError: unknown) {
      setError(requestMessage(requestError, "Could not restore this study session."));
    }
  };

  useEffect(() => {
    void loadSession();
  }, [route.params.sessionId]);

  const selectAnswer = (option: string) => {
    if (phase !== "ANSWERING" && phase !== "REASONING") return;
    setSelectedAnswer(option);
    setError(null);
    setPhase("REASONING");
  };

  const submit = async () => {
    const question = session?.currentQuestion;
    const trimmedReasoning = reasoning.trim();
    if (!session || !question || !selectedAnswer) return;
    if (trimmedReasoning.length < 5) {
      setError("Explain your thinking in at least a few words before submitting.");
      return;
    }
    try {
      setPhase("SUBMITTING");
      setError(null);
      const result = await examPrepService.submitGuidedQuestion(session.id, question.id, selectedAnswer, trimmedReasoning);
      setFeedback(result);
      setReasoning(result.reasoning);
      setSession({ ...session, completedCount: result.progress.completed, progress: result.progress, isComplete: result.isComplete });
      setPhase("FEEDBACK");
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 250, animated: true }));
    } catch (requestError: unknown) {
      setError(requestMessage(requestError, "Your answer could not be sent. Your selection and reasoning are still here—try again."));
      setPhase("REASONING");
    }
  };

  const continueSession = async () => {
    const question = session?.currentQuestion;
    if (!session || !question || !feedback) return;
    try {
      setAdvancing(true);
      setError(null);
      if (session.isComplete) {
        setSummary(await examPrepService.getGuidedSummary(session.id));
        setPhase("COMPLETE");
      } else {
        const next = await examPrepService.advanceGuidedSession(session.id, question.id);
        applySession(next);
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
      }
    } catch (requestError: unknown) {
      setError(requestMessage(requestError, "Could not continue to the next question."));
    } finally {
      setAdvancing(false);
    }
  };

  if (phase === "LOADING" && !session) {
    return (
      <Screen hideHeader style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingTitle}>Preparing your question…</Text>
        <Text style={styles.loadingCopy}>Restoring your guided study session</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {error ? <Button label="Try again" variant="outline" onPress={() => void loadSession()} style={styles.loadingRetry} /> : null}
      </Screen>
    );
  }

  if (phase === "COMPLETE" && summary) {
    return (
      <Screen hideHeader scrollable contentContainerStyle={styles.summaryContent}>
        <View style={styles.summaryIcon}><CheckCircle2 size={42} color={colors.status.success.icon} /></View>
        <Text style={styles.summaryTitle}>Study session complete</Text>
        <Text style={styles.summaryCopy}>You studied {summary.questionsStudied} questions and learned from each one.</Text>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}><Text style={styles.summaryValue}>{summary.questionsStudied}</Text><Text style={styles.summaryLabel}>STUDIED</Text></View>
            <View style={styles.summaryStat}><Text style={styles.summaryValue}>{summary.correctAnswers}</Text><Text style={styles.summaryLabel}>CORRECT</Text></View>
            <View style={styles.summaryStat}><Text style={styles.summaryValue}>{summary.percentage}%</Text><Text style={styles.summaryLabel}>SCORE</Text></View>
          </View>
          {summary.averageReasoningQuality !== null ? (
            <Text style={styles.reasoningAverage}>Average reasoning quality: {summary.averageReasoningQuality}%</Text>
          ) : null}
          {summary.needsReview.length > 0 ? (
            <View style={styles.reviewSummary}>
              <Text style={styles.reviewSummaryTitle}>Worth reviewing</Text>
              {summary.needsReview.map((item, index) => <Text key={`${index}-${item}`} style={styles.reviewSummaryItem}>• {item}</Text>)}
            </View>
          ) : null}
        </Card>
        <Button label="Study another material" onPress={() => navigation.replace("ExamPrep")} />
        <Button label="Back to Exam Prep" variant="ghost" onPress={() => navigation.navigate("ExamPrep")} style={styles.secondarySummaryButton} />
      </Screen>
    );
  }

  const question = session?.currentQuestion;
  if (!session || !question) return null;
  const progress = Math.round(((feedback ? session.progress.completed : session.currentIndex) / session.totalQuestions) * 100);
  const frozen = phase === "SUBMITTING" || phase === "FEEDBACK";

  return (
    <Screen hideHeader>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Leave study session">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.materialTitle} numberOfLines={1}>{session.material.title}</Text>
          <Text style={styles.courseCode}>{session.material.courseCode || "GENERAL"}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.progressHeader}>
          <Text style={styles.questionCount}>Question {session.currentIndex + 1} of {session.totalQuestions}</Text>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
        <ProgressBar progress={progress} />

        <Card style={styles.questionCard}>
          <View style={styles.difficultyBadge}><Text style={styles.difficultyText}>{question.difficulty}</Text></View>
          <RichMathText content={question.text} textColor={colors.textPrimary} fontSize={19} lineHeight={1.42} />
        </Card>

        <View style={styles.optionsList}>
          {question.options.map((option, index) => {
            const selected = selectedAnswer === option;
            const isCorrectAfterSubmit = Boolean(feedback && feedback.correctAnswer === option);
            const isWrongSelection = Boolean(feedback && selected && !feedback.isCorrect);
            return (
              <TouchableOpacity
                key={`${index}-${option}`}
                onPress={() => selectAnswer(option)}
                disabled={frozen}
                activeOpacity={0.82}
                style={[styles.option, selected && styles.optionSelected, isCorrectAfterSubmit && styles.optionCorrect, isWrongSelection && styles.optionIncorrect]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: frozen }}
                accessibilityLabel={`Option ${String.fromCharCode(65 + index)}: ${option}${isCorrectAfterSubmit ? ", correct answer" : isWrongSelection ? ", your incorrect answer" : ""}`}
              >
                <View style={[styles.optionLetter, selected && styles.optionLetterSelected, isCorrectAfterSubmit && styles.optionLetterCorrect, isWrongSelection && styles.optionLetterIncorrect]}>
                  <Text style={[styles.optionLetterText, (selected || isCorrectAfterSubmit || isWrongSelection) && styles.optionLetterTextSelected]}>{String.fromCharCode(65 + index)}</Text>
                </View>
                <View style={styles.optionText}><RichMathText content={option} textColor={colors.textPrimary} fontSize={15} lineHeight={1.38} /></View>
                {isCorrectAfterSubmit ? <CheckCircle2 size={21} color={colors.status.success.icon} /> : isWrongSelection ? <XCircle size={21} color={colors.status.error.icon} /> : selected ? <Check size={20} color={colors.brand.foreground} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {(phase === "REASONING" || phase === "SUBMITTING" || phase === "FEEDBACK") ? (
          <Animated.View entering={FadeInUp.duration(250)}>
            <Card style={styles.reasoningCard}>
              <Text style={styles.sectionTitle}>Why do you think this is the answer?</Text>
              <Text style={styles.sectionCopy}>Explain your thinking in your own words. Akademi will check both your answer and your reasoning.</Text>
              <TextInput
                value={reasoning}
                onChangeText={setReasoning}
                editable={!frozen}
                multiline
                maxLength={2000}
                textAlignVertical="top"
                placeholder="I chose this because…"
                placeholderTextColor={colors.textMuted}
                style={[styles.reasoningInput, frozen && styles.reasoningInputFrozen]}
                accessibilityLabel="Explain why you chose this answer"
              />
              <Text style={styles.characterCount}>{reasoning.length}/2,000</Text>
              {phase !== "FEEDBACK" ? (
                <Button label={phase === "SUBMITTING" ? "Checking your reasoning…" : "Check my reasoning"} loading={phase === "SUBMITTING"} disabled={reasoning.trim().length < 5} onPress={() => void submit()} />
              ) : null}
            </Card>
          </Animated.View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {feedback ? <FeedbackView feedback={feedback} styles={styles} colors={colors} /> : null}
        {feedback ? (
          <Button label={session.isComplete ? "Finish session" : "Next question"} loading={advancing} onPress={() => void continueSession()} style={styles.nextButton} />
        ) : null}
      </ScrollView>
    </Screen>
  );
};

const FeedbackView = ({ feedback, styles, colors }: { feedback: ExamPrepTeachingFeedback; styles: ReturnType<typeof createStyles>; colors: typeof import("../../theme/colors").darkPalette }) => (
  <Animated.View entering={FadeInUp.duration(320)} style={styles.feedbackWrap}>
    <View style={[styles.verdictCard, feedback.isCorrect ? styles.verdictCorrect : styles.verdictIncorrect]}>
      {feedback.isCorrect ? <CheckCircle2 size={28} color={colors.status.success.icon} /> : <XCircle size={28} color={colors.status.error.icon} />}
      <View style={styles.verdictTextWrap}>
        <Text style={[styles.verdictTitle, { color: feedback.isCorrect ? colors.status.success.fg : colors.status.error.fg }]}>{feedback.isCorrect ? "Correct" : "Not quite"}</Text>
        {!feedback.isCorrect ? <Text style={styles.yourAnswer}>Your answer: {feedback.selectedAnswer}</Text> : null}
        <Text style={styles.correctAnswer}>Correct answer: {feedback.correctAnswer}</Text>
      </View>
    </View>

    <Card style={styles.feedbackCard}>
      <Text style={styles.feedbackTitle}>Why this is correct</Text>
      <RichMathText content={feedback.teachingExplanation.whyCorrect} textColor={colors.textSecondary} fontSize={14} lineHeight={1.5} />
      <View style={styles.keyConceptBox}>
        <Text style={styles.keyConceptLabel}>KEY CONCEPT</Text>
        <RichMathText content={feedback.teachingExplanation.keyConcept} textColor={colors.brand.foreground} fontSize={13} lineHeight={1.45} />
      </View>
    </Card>

    <Card style={styles.feedbackCard}>
      <Text style={styles.feedbackTitle}>Your reasoning</Text>
      <Text style={styles.reasoningSummary}>{feedback.reasoningAssessment.summary}</Text>
      {feedback.reasoningAssessment.whatYouGotRight.length > 0 ? (
        <FeedbackList title="What you understood" items={feedback.reasoningAssessment.whatYouGotRight} positive styles={styles} colors={colors} />
      ) : null}
      {feedback.reasoningAssessment.whatYouMissed.length > 0 ? (
        <FeedbackList title="What you missed" items={feedback.reasoningAssessment.whatYouMissed} styles={styles} colors={colors} />
      ) : null}
      {feedback.reasoningAssessment.misconception ? (
        <View style={styles.misconceptionBox}><Text style={styles.misconceptionLabel}>MISCONCEPTION TO FIX</Text><Text style={styles.misconceptionText}>{feedback.reasoningAssessment.misconception}</Text></View>
      ) : null}
      {!feedback.personalized ? <Text style={styles.fallbackNote}>Your answer is safely recorded. Personalized reasoning analysis was unavailable, so this explanation uses the stored canonical teaching.</Text> : null}
    </Card>

    <Text style={styles.optionBreakdownHeading}>Understand every option</Text>
    {feedback.optionBreakdown.map((item, index) => (
      <Card key={`${index}-${item.option}`} style={[styles.optionFeedbackCard, item.isCorrect && styles.optionFeedbackCorrect]}>
        <View style={styles.optionFeedbackHeader}>
          <View style={[styles.optionFeedbackLetter, item.isCorrect && styles.optionFeedbackLetterCorrect]}><Text style={styles.optionFeedbackLetterText}>{String.fromCharCode(65 + index)}</Text></View>
          <View style={styles.optionFeedbackText}><RichMathText content={item.option} textColor={colors.textPrimary} fontSize={14} lineHeight={1.4} /></View>
          <Text style={[styles.optionFeedbackStatus, { color: item.isCorrect ? colors.status.success.fg : colors.textMuted }]}>{item.isCorrect ? "CORRECT" : "DOESN’T FIT"}</Text>
        </View>
        <Text style={styles.optionExplanation}>{item.whyItFitsOrDoesNotFit}</Text>
        <Text style={styles.optionRepresents}><Text style={styles.inlineLabel}>What it represents: </Text>{item.whatItRepresents}</Text>
        {item.whenItWouldBeCorrect ? <Text style={styles.optionRepresents}><Text style={styles.inlineLabel}>When it would be correct: </Text>{item.whenItWouldBeCorrect}</Text> : null}
      </Card>
    ))}

    <View style={styles.takeawayCard}>
      <Lightbulb size={22} color={colors.status.warning.icon} />
      <View style={styles.takeawayTextWrap}><Text style={styles.takeawayLabel}>KEY TAKEAWAY</Text><Text style={styles.takeawayText}>{feedback.takeaway}</Text></View>
    </View>
  </Animated.View>
);

const FeedbackList = ({ title, items, positive, styles, colors }: { title: string; items: string[]; positive?: boolean; styles: ReturnType<typeof createStyles>; colors: typeof import("../../theme/colors").darkPalette }) => (
  <View style={styles.feedbackList}>
    <Text style={styles.feedbackListTitle}>{title}</Text>
    {items.map((item, index) => <View key={`${index}-${item}`} style={styles.feedbackListRow}>{positive ? <Check size={16} color={colors.status.success.icon} /> : <X size={16} color={colors.status.error.icon} />}<Text style={styles.feedbackListText}>{item}</Text></View>)}
  </View>
);

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  loadingScreen: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  loadingTitle: { ...typography.h2, color: colors.textPrimary, marginTop: 18 },
  loadingCopy: { color: colors.textSecondary, fontSize: 13, marginTop: 7 },
  loadingRetry: { marginTop: 18, maxWidth: 260 },
  header: { alignItems: "center", borderBottomColor: colors.borderRoles.subtle, borderBottomWidth: 1, flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10 },
  backButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  headerText: { alignItems: "center", flex: 1 },
  headerSpacer: { width: 44 },
  materialTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "700", maxWidth: "95%" },
  courseCode: { color: colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1, marginTop: 3 },
  content: { paddingBottom: 52, paddingHorizontal: 18, paddingTop: 18 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 9 },
  questionCount: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  progressText: { color: colors.brand.foreground, fontSize: 12, fontWeight: "700" },
  questionCard: { marginBottom: 16, marginTop: 20, padding: 18 },
  difficultyBadge: { alignSelf: "flex-start", backgroundColor: colors.surfaceElevated, borderRadius: 6, marginBottom: 12, paddingHorizontal: 7, paddingVertical: 4 },
  difficultyText: { color: colors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  optionsList: { gap: 11, marginBottom: 18 },
  option: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", minHeight: 64, paddingHorizontal: 13, paddingVertical: 8 },
  optionSelected: { backgroundColor: colors.brand.subtle, borderColor: colors.brand.border, borderWidth: 2 },
  optionCorrect: { backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border, borderWidth: 2 },
  optionIncorrect: { backgroundColor: colors.status.error.bg, borderColor: colors.status.error.border, borderWidth: 2 },
  optionLetter: { alignItems: "center", backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  optionLetterSelected: { backgroundColor: colors.brand.fill, borderColor: colors.brand.border },
  optionLetterCorrect: { backgroundColor: colors.status.success.icon, borderColor: colors.status.success.border },
  optionLetterIncorrect: { backgroundColor: colors.status.error.icon, borderColor: colors.status.error.border },
  optionLetterText: { color: colors.textSecondary, fontSize: 13, fontWeight: "800" },
  optionLetterTextSelected: { color: "#FFFFFF" },
  optionText: { flex: 1, marginHorizontal: 12, minWidth: 0 },
  reasoningCard: { marginBottom: 16, padding: 17 },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, fontSize: 16, marginBottom: 7 },
  sectionCopy: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 19, marginBottom: 14 },
  reasoningInput: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 11, borderWidth: 1, color: colors.textPrimary, fontSize: 14, lineHeight: 21, minHeight: 122, padding: 13 },
  reasoningInputFrozen: { opacity: 0.78 },
  characterCount: { color: colors.textMuted, fontSize: 10, marginBottom: 13, marginTop: 6, textAlign: "right" },
  errorText: { color: colors.status.error.fg, fontSize: 12.5, lineHeight: 18, marginBottom: 14, marginTop: 8, textAlign: "center" },
  feedbackWrap: { marginTop: 4 },
  verdictCard: { alignItems: "flex-start", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginBottom: 14, padding: 16 },
  verdictCorrect: { backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border },
  verdictIncorrect: { backgroundColor: colors.status.error.bg, borderColor: colors.status.error.border },
  verdictTextWrap: { flex: 1, marginLeft: 12 },
  verdictTitle: { fontSize: 20, fontWeight: "800", marginBottom: 5 },
  yourAnswer: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
  correctAnswer: { color: colors.textPrimary, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },
  feedbackCard: { marginBottom: 14, padding: 17 },
  feedbackTitle: { ...typography.h2, color: colors.textPrimary, fontSize: 16, marginBottom: 10 },
  keyConceptBox: { backgroundColor: colors.brand.subtle, borderRadius: 10, marginTop: 12, padding: 12 },
  keyConceptLabel: { color: colors.brand.foreground, fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginBottom: 5 },
  reasoningSummary: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  feedbackList: { marginTop: 14 },
  feedbackListTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  feedbackListRow: { alignItems: "flex-start", flexDirection: "row", marginBottom: 7 },
  feedbackListText: { color: colors.textSecondary, flex: 1, fontSize: 12.5, lineHeight: 18, marginLeft: 8 },
  misconceptionBox: { backgroundColor: colors.status.warning.bg, borderRadius: 9, marginTop: 12, padding: 11 },
  misconceptionLabel: { color: colors.status.warning.fg, fontSize: 9, fontWeight: "800", letterSpacing: 0.7, marginBottom: 5 },
  misconceptionText: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
  fallbackNote: { color: colors.textMuted, fontSize: 11, fontStyle: "italic", lineHeight: 17, marginTop: 12 },
  optionBreakdownHeading: { ...typography.h2, color: colors.textPrimary, fontSize: 17, marginBottom: 11, marginTop: 8 },
  optionFeedbackCard: { marginBottom: 11, padding: 14 },
  optionFeedbackCorrect: { borderColor: colors.status.success.border },
  optionFeedbackHeader: { alignItems: "center", flexDirection: "row", marginBottom: 10 },
  optionFeedbackLetter: { alignItems: "center", backgroundColor: colors.surfaceElevated, borderRadius: 15, height: 30, justifyContent: "center", width: 30 },
  optionFeedbackLetterCorrect: { backgroundColor: colors.status.success.icon },
  optionFeedbackLetterText: { color: colors.textPrimary, fontSize: 11, fontWeight: "800" },
  optionFeedbackText: { flex: 1, marginHorizontal: 9 },
  optionFeedbackStatus: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  optionExplanation: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 19, marginBottom: 8 },
  optionRepresents: { color: colors.textSecondary, fontSize: 11.5, lineHeight: 18, marginTop: 4 },
  inlineLabel: { color: colors.textPrimary, fontWeight: "700" },
  takeawayCard: { alignItems: "flex-start", backgroundColor: colors.status.warning.bg, borderColor: colors.status.warning.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", marginTop: 4, padding: 15 },
  takeawayTextWrap: { flex: 1, marginLeft: 11 },
  takeawayLabel: { color: colors.status.warning.fg, fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginBottom: 5 },
  takeawayText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  nextButton: { marginTop: 18 },
  summaryContent: { alignItems: "center", justifyContent: "center", paddingHorizontal: 22, paddingVertical: 42 },
  summaryIcon: { alignItems: "center", backgroundColor: colors.status.success.bg, borderRadius: 36, height: 72, justifyContent: "center", width: 72 },
  summaryTitle: { ...typography.h1, color: colors.textPrimary, marginTop: 20, textAlign: "center" },
  summaryCopy: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 24, marginTop: 9, textAlign: "center" },
  summaryCard: { marginBottom: 22, padding: 18, width: "100%" },
  summaryRow: { flexDirection: "row" },
  summaryStat: { alignItems: "center", flex: 1 },
  summaryValue: { color: colors.textPrimary, fontSize: 22, fontWeight: "800" },
  summaryLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.7, marginTop: 5 },
  reasoningAverage: { color: colors.textSecondary, fontSize: 12, marginTop: 16, textAlign: "center" },
  reviewSummary: { borderTopColor: colors.borderRoles.subtle, borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  reviewSummaryTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: "700", marginBottom: 7 },
  reviewSummaryItem: { color: colors.textSecondary, fontSize: 11.5, lineHeight: 17, marginBottom: 5 },
  secondarySummaryButton: { marginTop: 8 },
});
