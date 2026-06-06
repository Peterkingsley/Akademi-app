import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, ChevronLeft, ChevronRight, ClipboardList, X } from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { materialService, PracticeQuestion } from "../../services/material";
import { userService } from "../../services/user";

const MATERIAL_CBT_DAY_PASS = "MATERIAL_CBT_DAY_PASS";
const MATERIAL_CBT_PASS_LABEL = "Material CBT Day Pass";
const MATERIAL_CBT_PASS_PRICE = "NGN 100";

export const MaterialPracticeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { materialId, title } = route.params;

  const [loading, setLoading] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutOpening, setCheckoutOpening] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [passStatus, setPassStatus] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setPassStatus("Checking CBT pass...");
        const pass = await userService.purchaseFeaturePass(MATERIAL_CBT_DAY_PASS, materialId, "MATERIAL");
        if (pass.betaUnlocked) {
          setPassStatus("Free beta active");
        } else if (pass.paymentUrl) {
          setCheckoutUrl(pass.paymentUrl);
          return;
        }

        const data = await materialService.getMaterialQuestions(materialId);
        setQuestions(data);
      } catch (error) {
        console.error("Failed to load material questions:", error);
        Alert.alert("Practice unavailable", "No CBT questions are available for this material yet.");
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [materialId]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length ? (Object.keys(answers).length / questions.length) * 100 : 0;
  const score = questions.reduce((total, question) => {
    const answer = answers[question.id];
    if (!answer || !question.correct_answer) return total;
    return answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase() ? total + 1 : total;
  }, 0);

  const fallbackOptions = ["I know this", "I am unsure", "Need a hint", "Review later"];

  const getOptions = (question: PracticeQuestion) => {
    if (Array.isArray(question.options) && question.options.length > 0) return question.options;
    if (question.correct_answer) return [question.correct_answer, ...fallbackOptions.filter((option) => option !== question.correct_answer)].slice(0, 4);
    return fallbackOptions;
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      Alert.alert("Submit CBT?", "Some questions are unanswered.", [
        { text: "Keep going", style: "cancel" },
        { text: "Submit", onPress: () => setSubmitted(true) },
      ]);
      return;
    }
    setSubmitted(true);
  };

  const openCheckout = async () => {
    if (!checkoutUrl || checkoutOpening) return;

    setCheckoutOpening(true);
    try {
      const result = await WebBrowser.openBrowserAsync(checkoutUrl);
      if (result.type === "cancel") {
        Alert.alert(
          "Checkout not completed",
          "Complete payment to unlock CBT practice for this material, then return here and try again."
        );
      }
    } catch (error) {
      console.error("Failed to open CBT pass checkout:", error);
      Alert.alert("Checkout unavailable", "We could not open payment. Please check your connection and try again.");
    } finally {
      setCheckoutOpening(false);
    }
  };

  if (loading) {
    return (
      <Screen style={styles.screen} hideHeader>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, typography.caption]}>{passStatus || "Preparing CBT..."}</Text>
        </View>
      </Screen>
    );
  }

  if (checkoutUrl) {
    return (
      <Screen style={styles.screen} hideHeader>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, typography.h3]}>Material CBT</Text>
            <Text style={[styles.headerSubtitle, typography.caption]} numberOfLines={1}>{title || "Practice"}</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.passPrompt}>
          <View style={styles.passIcon}>
            <ClipboardList size={28} color={colors.primary} />
          </View>
          <Text style={[styles.passEyebrow, typography.mono]}>PASS REQUIRED</Text>
          <Text style={[styles.passTitle, typography.h2]}>{MATERIAL_CBT_PASS_LABEL}</Text>
          <Text style={[styles.passPrice, typography.h1]}>{MATERIAL_CBT_PASS_PRICE}</Text>
          <Text style={[styles.passDescription, typography.bodySmall]}>
            Unlock unlimited CBT practice for this material for 24 hours. This pass only applies to this material.
          </Text>
          <Button
            label="Buy pass and continue"
            onPress={openCheckout}
            loading={checkoutOpening}
            style={styles.passButton}
          />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.passCancel}>
            <Text style={[styles.passCancelText, typography.bodySmall]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} hideHeader>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, typography.h3]}>Material CBT</Text>
          <Text style={[styles.headerSubtitle, typography.caption]} numberOfLines={1}>{title || "Practice"}</Text>
        </View>
        <View style={styles.scorePill}>
          <ClipboardList size={14} color={colors.primary} />
          <Text style={[styles.scorePillText, typography.mono]}>{questions.length} Qs</Text>
        </View>
      </View>

      {questions.length === 0 ? (
        <View style={styles.emptyState}>
          <ClipboardList size={40} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, typography.h3]}>No CBT yet</Text>
          <Text style={[styles.emptyText, typography.bodySmall]}>
            This material has no generated questions yet. Try the selected-text CBT action while the question bank is prepared.
          </Text>
          <Button label="Back to Material" onPress={() => navigation.goBack()} style={styles.emptyBtn} />
        </View>
      ) : (
        <>
          <ProgressBar progress={submitted ? 100 : progress} style={styles.progress} />
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {submitted ? (
              <View>
                <Card style={styles.resultCard}>
                  <Text style={[styles.resultLabel, typography.mono]}>FINAL SCORE</Text>
                  <Text style={[styles.resultScore, typography.h1]}>{score}/{questions.length}</Text>
                  <Text style={[styles.resultText, typography.bodySmall]}>
                    {Math.round((score / questions.length) * 100)}% aggregate
                  </Text>
                </Card>

                {questions.map((question, index) => {
                  const chosen = answers[question.id] || "Not answered";
                  const correct = question.correct_answer || "Not available";
                  const isCorrect = chosen.trim().toLowerCase() === correct.trim().toLowerCase();

                  return (
                    <Card key={question.id} style={styles.reviewCard}>
                      <Text style={[styles.questionCount, typography.mono]}>QUESTION {index + 1}</Text>
                      <Text style={[styles.questionText, typography.body]}>{question.question_text}</Text>
                      <Text style={[styles.answerLine, typography.bodySmall, { color: isCorrect ? colors.success : colors.error }]}>
                        Your answer: {chosen}
                      </Text>
                      {!isCorrect && (
                        <Text style={[styles.answerLine, typography.bodySmall, { color: colors.success }]}>Correct: {correct}</Text>
                      )}
                      <Text style={[styles.explanation, typography.bodySmall]}>
                        {question.explanation || question.approach_guide || "Review the selected material section again."}
                      </Text>
                    </Card>
                  );
                })}
              </View>
            ) : (
              <View>
                <Text style={[styles.questionCount, typography.mono]}>
                  QUESTION {currentIndex + 1} OF {questions.length}
                </Text>
                <Card style={styles.questionCard}>
                  <Text style={[styles.questionText, typography.body]}>{currentQuestion.question_text}</Text>
                </Card>

                <View style={styles.optionsList}>
                  {getOptions(currentQuestion).map((option, index) => {
                    const selected = answers[currentQuestion.id] === option;
                    return (
                      <TouchableOpacity
                        key={`${currentQuestion.id}-${option}`}
                        style={[styles.option, selected && styles.optionSelected]}
                        onPress={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }))}
                      >
                        <View style={[styles.optionLetter, selected && styles.optionLetterSelected]}>
                          <Text style={[styles.optionLetterText, selected && styles.optionLetterTextSelected]}>
                            {String.fromCharCode(65 + index)}
                          </Text>
                        </View>
                        <Text style={[styles.optionText, typography.bodySmall, selected && styles.optionTextSelected]}>{option}</Text>
                        {selected && <Check size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {!submitted && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
                disabled={currentIndex === 0}
                onPress={() => setCurrentIndex((prev) => prev - 1)}
              >
                <ChevronLeft size={20} color="#FFFFFF" />
                <Text style={[styles.navBtnText, typography.bodySmall]}>Previous</Text>
              </TouchableOpacity>
              <Button
                label={currentIndex === questions.length - 1 ? "Submit" : "Next"}
                icon={<ChevronRight size={18} color="#FFFFFF" />}
                onPress={() => currentIndex === questions.length - 1 ? handleSubmit() : setCurrentIndex((prev) => prev + 1)}
                style={styles.nextBtn}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 12,
  },
  passPrompt: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  passIcon: {
    alignItems: "center",
    backgroundColor: colors.primary + "18",
    borderRadius: 22,
    height: 64,
    justifyContent: "center",
    marginBottom: 18,
    width: 64,
  },
  passEyebrow: {
    color: colors.primary,
    fontSize: 9,
    marginBottom: 10,
  },
  passTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
  },
  passPrice: {
    color: colors.primary,
    fontWeight: "800",
    marginTop: 10,
  },
  passDescription: {
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 12,
    textAlign: "center",
  },
  passButton: {
    marginTop: 26,
    width: "100%",
  },
  passCancel: {
    padding: 14,
  },
  passCancelText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerBtn: {
    padding: 8,
    width: 44,
  },
  headerTitleWrap: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  headerSubtitle: {
    color: colors.textMuted,
    marginTop: 2,
    maxWidth: 220,
  },
  scorePill: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scorePillText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "700",
  },
  progress: {
    borderRadius: 0,
    height: 3,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },
  questionCount: {
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 12,
  },
  questionCard: {
    backgroundColor: colors.surface,
    marginBottom: 24,
    padding: 18,
  },
  questionText: {
    color: "#FFFFFF",
    lineHeight: 24,
  },
  optionsList: {
    gap: 12,
  },
  option: {
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    padding: 14,
  },
  optionSelected: {
    backgroundColor: colors.primary + "14",
    borderColor: colors.primary,
  },
  optionLetter: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    marginRight: 12,
    width: 30,
  },
  optionLetterSelected: {
    backgroundColor: colors.primary,
  },
  optionLetterText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  optionLetterTextSelected: {
    color: "#FFFFFF",
  },
  optionText: {
    color: colors.textSecondary,
    flex: 1,
  },
  optionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  footer: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    left: 0,
    padding: 20,
    position: "absolute",
    right: 0,
  },
  navBtn: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 6,
    paddingVertical: 12,
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  nextBtn: {
    flex: 1.4,
  },
  resultCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    marginBottom: 24,
    padding: 24,
  },
  resultLabel: {
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 8,
  },
  resultScore: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  resultText: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: colors.surfaceElevated,
    marginBottom: 14,
    padding: 16,
  },
  answerLine: {
    marginTop: 10,
    fontWeight: "700",
  },
  explanation: {
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 12,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: "#FFFFFF",
    marginTop: 18,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 24,
    width: "100%",
  },
});
