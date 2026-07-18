import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, ChevronLeft, ChevronRight, ClipboardList, Clock3, X, Target, Timer, BookOpen } from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { BlurView } from "expo-blur";
import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { RichMathText } from "../../components/ui/RichMathText";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { materialService, PracticeQuestion } from "../../services/material";
import { userService } from "../../services/user";

const MATERIAL_CBT_DAY_PASS = "MATERIAL_CBT_DAY_PASS";
const MATERIAL_CBT_PASS_LABEL = "Material CBT Day Pass";
const MATERIAL_CBT_PASS_PRICE = "NGN 100";

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20];
const DURATION_OPTIONS = [5, 10, 15, 20, 30];

export const MaterialPracticeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { materialId, title, totalPages: totalPagesParam } = route.params;

  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutOpening, setCheckoutOpening] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [passStatus, setPassStatus] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [setupReady, setSetupReady] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [setupError, setSetupError] = useState("");
  const [persistingResults, setPersistingResults] = useState(false);
  const [totalPages, setTotalPages] = useState<number | null>(totalPagesParam || null);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [pageFrom, setPageFrom] = useState("");
  const [pageTo, setPageTo] = useState("");
  const [rangeError, setRangeError] = useState("");

  useEffect(() => {
    if (totalPages != null) return;
    let cancelled = false;
    materialService
      .getMaterialDetails(materialId)
      .then((data) => {
        if (cancelled) return;
        const pageCount = data.diagnostics?.pageCount;
        if (pageCount) setTotalPages(pageCount);
      })
      .catch((error) => {
        console.error("Failed to fetch material page count:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [materialId, totalPages]);

  const parsedPageFrom = Number(pageFrom);
  const parsedPageTo = Number(pageTo);
  const hasValidRangeInputs =
    pageFrom.trim().length > 0 &&
    pageTo.trim().length > 0 &&
    Number.isInteger(parsedPageFrom) &&
    Number.isInteger(parsedPageTo) &&
    parsedPageFrom >= 1 &&
    parsedPageFrom <= parsedPageTo &&
    (!totalPages || parsedPageTo <= totalPages);
  const canStart = !useCustomRange || hasValidRangeInputs;

  const checkPass = useCallback(async () => {
    try {
      setSetupError("");
      setCheckoutUrl("");
      setSetupReady(false);
      setPassStatus("Checking CBT pass...");
      const access = await userService.checkFeatureAccess("EXAM_PREP", "MATERIAL", materialId);
      if (access.hasAccess) {
        setPassStatus("CBT ready");
        setSetupReady(true);
        return;
      }

      const pass = await userService.purchaseFeaturePass(
        MATERIAL_CBT_DAY_PASS,
        materialId,
        "MATERIAL",
      );
      if (pass.betaUnlocked) {
        setPassStatus("Free beta active");
        setSetupReady(true);
      } else if (pass.paymentUrl) {
        setPassStatus("Pass required");
        setCheckoutUrl(pass.paymentUrl);
        return;
      } else {
        setPassStatus(pass.message || "CBT access is not ready yet");
        setSetupError("We could not confirm CBT access for this material yet.");
      }
    } catch (error) {
      console.error("Failed to check CBT access:", error);
      setPassStatus("CBT unavailable");
      setSetupError("We could not prepare CBT access for this material.");
      Alert.alert("CBT unavailable", "We could not prepare CBT access for this material.");
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    checkPass();
  }, [checkPass]);

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
    if (question.correct_answer) {
      return [
        question.correct_answer,
        ...fallbackOptions.filter((option) => option !== question.correct_answer),
      ].slice(0, 4);
    }
    return fallbackOptions;
  };

  const formattedTime = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (remainingSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }, [remainingSeconds]);

  const startPractice = async () => {
    if (!setupReady) {
      Alert.alert(
        "CBT not ready",
        setupError || passStatus || "We are still preparing CBT access for this material.",
      );
      return;
    }

    if (useCustomRange && !hasValidRangeInputs) {
      setRangeError(
        totalPages
          ? `Enter a valid range between 1 and ${totalPages}.`
          : "Enter a valid page range.",
      );
      return;
    }

    const pageRange = useCustomRange
      ? { pageStart: parsedPageFrom, pageEnd: parsedPageTo }
      : undefined;

    try {
      setSetupLoading(true);
      setRangeError("");
      const data = await materialService.getMaterialQuestions(materialId, questionCount, pageRange);
      setQuestions(data);
      setAnswers({});
      setCurrentIndex(0);
      setSubmitted(false);
      setRemainingSeconds(durationMinutes * 60);
    } catch (error: any) {
      console.error("Failed to load material questions:", error);
      if (pageRange) {
        setRangeError(
          error?.response?.data?.message ||
            `No questions available yet for pages ${pageRange.pageStart}-${pageRange.pageEnd}, try a wider range or check back shortly.`,
        );
      } else {
        Alert.alert("Practice unavailable", "No CBT questions are available for this material yet.");
      }
    } finally {
      setSetupLoading(false);
    }
  };

  const finalizePractice = useCallback(async () => {
    if (submitted || persistingResults || questions.length === 0) return;

    try {
      setPersistingResults(true);
      await materialService.submitMaterialQuestionAttempts(
        materialId,
        questions.map((question) => ({
          questionId: question.id,
          answer: answers[question.id] || "",
        })),
      );
      setSubmitted(true);
    } catch (error) {
      console.error("Failed to save CBT attempts:", error);
      Alert.alert(
        "Could not save CBT",
        "We could not save this CBT attempt yet. Check your connection and try submitting again.",
      );
    } finally {
      setPersistingResults(false);
    }
  }, [answers, materialId, persistingResults, questions, submitted]);

  useEffect(() => {
    if (!setupReady || submitted || questions.length === 0 || remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer);
          void finalizePractice();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [finalizePractice, setupReady, submitted, questions.length, remainingSeconds]);

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      Alert.alert("Submit CBT?", "Some questions are unanswered.", [
        { text: "Keep going", style: "cancel" },
        { text: "Submit", onPress: () => void finalizePractice() },
      ]);
      return;
    }
    void finalizePractice();
  };

  const openCheckout = async () => {
    if (!checkoutUrl || checkoutOpening) return;

    setCheckoutOpening(true);
    try {
      const result = await WebBrowser.openBrowserAsync(checkoutUrl);
      if (result.type === "cancel") {
        Alert.alert(
          "Checkout not completed",
          "Complete payment to unlock CBT practice for this material, then return here and try again.",
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
          <Text style={[styles.loadingText, typography.caption]}>
            {passStatus || "Preparing CBT..."}
          </Text>
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
            <Text style={[styles.headerSubtitle, typography.caption]} numberOfLines={1}>
              {title || "Practice"}
            </Text>
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
            Unlock unlimited CBT practice for this material for 24 hours. This pass only applies
            to this material.
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

  const showSetup = questions.length === 0 && !submitted;

  return (
    <Screen style={[styles.screen, (!showSetup && !submitted) ? styles.wwtbamScreen : undefined]} hideHeader>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, typography.h3]}>Material CBT</Text>
          <Text style={[styles.headerSubtitle, typography.caption]} numberOfLines={1}>
            {title || "Practice"}
          </Text>
        </View>
        {!showSetup ? (
          <View style={styles.scorePill}>
            <Clock3 size={14} color={colors.primary} />
            <Text style={[styles.scorePillText, typography.mono]}>{formattedTime}</Text>
          </View>
        ) : (
          <View style={styles.scorePill}>
            <ClipboardList size={14} color={colors.primary} />
            <Text style={[styles.scorePillText, typography.mono]}>{questionCount} Qs</Text>
          </View>
        )}
      </View>

      {showSetup ? (
        <ScrollView contentContainerStyle={styles.setupContent} showsVerticalScrollIndicator={false}>
          <View style={styles.setupHeader}>
            <Text style={[styles.setupTitle, typography.h2]}>Configure Practice</Text>
            <Text style={[styles.setupText, typography.bodySmall]}>
              Customize your CBT session format below.
            </Text>
          </View>

          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            <View style={styles.optionHeader}>
              <Target size={16} color={colors.primary} />
              <Text style={[styles.optionLabel, typography.mono]}>QUESTION COUNT</Text>
            </View>
            <View style={styles.segmentTrack}>
              {QUESTION_COUNT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.segmentButton, questionCount === option && styles.segmentButtonActive]}
                  onPress={() => setQuestionCount(option)}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      questionCount === option && styles.segmentButtonTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>

          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            <View style={styles.optionHeader}>
              <Timer size={16} color={colors.primary} />
              <Text style={[styles.optionLabel, typography.mono]}>TOTAL CBT TIME</Text>
            </View>
            <View style={styles.segmentTrack}>
              {DURATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.segmentButton, durationMinutes === option && styles.segmentButtonActive]}
                  onPress={() => setDurationMinutes(option)}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      durationMinutes === option && styles.segmentButtonTextActive,
                    ]}
                  >
                    {option}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>

          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            <View style={styles.optionHeader}>
              <BookOpen size={16} color={colors.primary} />
              <Text style={[styles.optionLabel, typography.mono]}>MATERIAL COVERAGE</Text>
            </View>
            <View style={styles.segmentTrack}>
              <TouchableOpacity
                style={[styles.segmentButton, !useCustomRange && styles.segmentButtonActive]}
                onPress={() => {
                  setUseCustomRange(false);
                  setRangeError("");
                }}
              >
                <Text
                  style={[styles.segmentButtonText, !useCustomRange && styles.segmentButtonTextActive]}
                >
                  Full material
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, useCustomRange && styles.segmentButtonActive]}
                onPress={() => {
                  setUseCustomRange(true);
                  setRangeError("");
                }}
              >
                <Text
                  style={[styles.segmentButtonText, useCustomRange && styles.segmentButtonTextActive]}
                >
                  Page range
                </Text>
              </TouchableOpacity>
            </View>

            {useCustomRange && (
              <View style={styles.pageRangeContainer}>
                <View style={styles.pageRangeRow}>
                  <View style={styles.pageRangeField}>
                    <Text style={[styles.pageRangeLabel, typography.bodySmall]}>From</Text>
                    <TextInput
                      style={styles.pageRangeInput}
                      value={pageFrom}
                      onChangeText={(value) => {
                        setPageFrom(value.replace(/[^0-9]/g, ""));
                        setRangeError("");
                      }}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.pageRangeField}>
                    <Text style={[styles.pageRangeLabel, typography.bodySmall]}>To</Text>
                    <TextInput
                      style={styles.pageRangeInput}
                      value={pageTo}
                      onChangeText={(value) => {
                        setPageTo(value.replace(/[^0-9]/g, ""));
                        setRangeError("");
                      }}
                      keyboardType="number-pad"
                      placeholder={totalPages ? String(totalPages) : "40"}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <Text style={[styles.pageRangeHint, typography.bodySmall]}>
                  {totalPages
                    ? `Pick a range within 1-${totalPages}.`
                    : "Enter the page range you just read."}
                </Text>
              </View>
            )}

            {!!rangeError && (
              <Text style={[styles.pageRangeError, typography.bodySmall]}>{rangeError}</Text>
            )}
          </BlurView>

          <View style={styles.setupFooter}>
            <View style={styles.setupSummaryWrap}>
              <Text style={[styles.setupSummaryTitle, typography.bodySmall]}>
                {useCustomRange && hasValidRangeInputs
                  ? `Loading ${questionCount} questions from pages ${parsedPageFrom}-${parsedPageTo} (Auto-submits in ${durationMinutes} mins).`
                  : `Loading ${questionCount} questions covering the entire material (Auto-submits in ${durationMinutes} mins).`}
              </Text>
            </View>

            {!!passStatus && (
              <Text style={[styles.setupStatus, typography.bodySmall]}>
                {passStatus}
              </Text>
            )}

            {!!setupError && (
              <View style={styles.setupErrorWrap}>
                <Text style={[styles.setupErrorText, typography.bodySmall]}>
                  {setupError}
                </Text>
                <TouchableOpacity onPress={checkPass} style={styles.retryLink}>
                  <Text style={[styles.retryLinkText, typography.bodySmall]}>Retry access check</Text>
                </TouchableOpacity>
              </View>
            )}

            <Button
              label={
                setupLoading
                  ? "Preparing..."
                  : setupReady
                    ? "Start CBT"
                    : "CBT not ready yet"
              }
              onPress={startPractice}
              disabled={setupLoading || !canStart}
              style={styles.startButton}
            />
          </View>
        </ScrollView>
      ) : questions.length === 0 ? (
        <View style={styles.emptyState}>
          <ClipboardList size={40} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, typography.h3]}>No CBT yet</Text>
          <Text style={[styles.emptyText, typography.bodySmall]}>
            This material has no generated questions yet. Try the selected-text CBT action while
            the question bank is prepared.
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
                  <Text style={[styles.resultScore, typography.h1]}>
                    {score}/{questions.length}
                  </Text>
                  <Text style={[styles.resultText, typography.bodySmall]}>
                    {Math.round((score / questions.length) * 100)}% aggregate
                  </Text>
                </Card>

                {questions.map((question, index) => {
                  const chosen = answers[question.id] || "Not answered";
                  const correct = question.correct_answer || "Not available";
                  const isCorrect =
                    chosen.trim().toLowerCase() === correct.trim().toLowerCase();

                  return (
                    <Card key={question.id} style={styles.reviewCard}>
                      <Text style={[styles.questionCountLabel, typography.mono]}>
                        QUESTION {index + 1}
                      </Text>
                      <RichMathText content={question.question_text} />
                      <Text
                        style={[
                          styles.answerLine,
                          typography.bodySmall,
                          { color: isCorrect ? colors.success : colors.error },
                        ]}
                      >
                        Your answer: {chosen}
                      </Text>
                      {!isCorrect && (
                        <Text
                          style={[
                            styles.answerLine,
                            typography.bodySmall,
                            { color: colors.success },
                          ]}
                        >
                          Correct: {correct}
                        </Text>
                      )}
                      <View style={styles.explanation}>
                        <RichMathText
                          content={
                            question.explanation ||
                            question.approach_guide ||
                            "Review the selected material section again."
                          }
                          textColor={colors.textSecondary}
                          fontSize={14}
                          lineHeight={1.45}
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            ) : (
              <View>
                <Text style={[styles.questionCountLabel, typography.mono]}>
                  QUESTION {currentIndex + 1} OF {questions.length}
                </Text>
                
                <View style={styles.wwtbamQuestionWrap}>
                  <View style={styles.wwtbamQuestionInner}>
                    <RichMathText content={currentQuestion.question_text} textColor="#FFFFFF" fontSize={16} />
                  </View>
                </View>

                <View style={styles.optionsList}>
                  {getOptions(currentQuestion).map((option, index) => {
                    const selected = answers[currentQuestion.id] === option;
                    return (
                      <TouchableOpacity
                        key={`${currentQuestion.id}-opt-${index}`}
                        style={[styles.wwtbamOption, selected && styles.wwtbamOptionSelected]}
                        onPress={() =>
                          setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }))
                        }
                        activeOpacity={0.7}
                      >
                        <View style={styles.wwtbamOptionLetterWrap}>
                          <Text
                            style={[
                              styles.wwtbamOptionLetter,
                              selected && styles.wwtbamOptionLetterSelected,
                            ]}
                          >
                            {String.fromCharCode(65 + index)}:
                          </Text>
                        </View>
                        <View style={styles.wwtbamOptionTextWrap}>
                          <RichMathText
                            content={option}
                            textColor={selected ? "#000000" : "#FFFFFF"}
                            fontSize={15}
                            lineHeight={1.4}
                            textAlign="center"
                          />
                        </View>
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
                label={
                  currentIndex === questions.length - 1
                    ? persistingResults
                      ? "Saving..."
                      : "Submit"
                    : "Next"
                }
                icon={<ChevronRight size={18} color="#FFFFFF" />}
                onPress={() =>
                  currentIndex === questions.length - 1
                    ? handleSubmit()
                    : setCurrentIndex((prev) => prev + 1)
                }
                disabled={persistingResults}
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
  wwtbamScreen: {
    backgroundColor: colors.background,
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
  setupContent: {
    padding: 20,
    paddingBottom: 40,
  },
  setupHeader: {
    marginBottom: 24,
  },
  setupTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  setupText: {
    color: colors.textSecondary,
    marginTop: 6,
  },
  glassCard: {
    backgroundColor: "rgba(30, 30, 30, 0.4)",
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    padding: 20,
  },
  optionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  optionLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  segmentTrack: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 12,
    flexDirection: "row",
    padding: 4,
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 10,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  segmentButtonTextActive: {
    color: "#04110A",
  },
  pageRangeContainer: {
    marginTop: 16,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 12,
    padding: 16,
  },
  pageRangeRow: {
    flexDirection: "row",
    gap: 16,
  },
  pageRangeField: {
    flex: 1,
    gap: 8,
  },
  pageRangeLabel: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  pageRangeInput: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    borderWidth: 1,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pageRangeHint: {
    color: colors.textMuted,
    marginTop: 12,
    textAlign: "center",
  },
  pageRangeError: {
    color: colors.error,
    marginTop: 12,
    textAlign: "center",
  },
  setupFooter: {
    marginTop: 8,
  },
  setupSummaryWrap: {
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  setupSummaryTitle: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  setupStatus: {
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 12,
  },
  setupErrorWrap: {
    alignItems: "center",
    backgroundColor: colors.error + "10",
    borderColor: colors.error + "33",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  setupErrorText: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryLink: {
    marginTop: 8,
  },
  retryLinkText: {
    color: colors.primary,
    fontWeight: "700",
  },
  startButton: {
    borderRadius: 16,
    height: 56,
  },
  progress: {
    borderRadius: 0,
    height: 3,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },
  questionCountLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 1,
  },
  wwtbamQuestionWrap: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 3,
    marginBottom: 16,
    elevation: 2,
  },
  wwtbamQuestionInner: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  optionsList: {
    gap: 10,
  },
  wwtbamOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  wwtbamOptionSelected: {
    backgroundColor: colors.primary + "1A",
    borderColor: colors.primary,
    elevation: 2,
  },
  wwtbamOptionLetterWrap: {
    marginRight: 10,
    marginTop: 1,
  },
  wwtbamOptionLetter: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 16,
  },
  wwtbamOptionLetterSelected: {
    color: colors.primary,
  },
  wwtbamOptionTextWrap: {
    flex: 1,
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
    flex: 1,
    flexDirection: "row",
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
