import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  Settings,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Lock,
  ArrowRight,
  RotateCcw,
} from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { SafeArea } from "../../components/layout/SafeArea";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LinearGradient as LinearGradient } from "expo-linear-gradient";
import examPrepService, { ExamPrepPlan, MockResult, MockResultQuestion } from "../../services/examPrep";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuthStore } from "../../store/useAuthStore";
import { Skeleton } from "../../components/ui/Skeleton";
import { BrandWordmark } from "../../components/ui/BrandWordmark";
import { RichMathText } from "../../components/ui/RichMathText";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeInUp,
  useAnimatedProps
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const MockExamResultsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { examId, mockExamId } = route.params;
  const { user } = useAuthStore();

  const [results, setResults] = useState<MockResult | null>(null);
  const [plan, setPlan] = useState<ExamPrepPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [weakStudyVisible, setWeakStudyVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const ringProgress = useSharedValue(0);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const [resultData, planData] = await Promise.all([
          examPrepService.getMockResults(examId, mockExamId),
          examPrepService.getPlanDetails(examId),
        ]);
        setResults(resultData);
        setPlan(planData);
        ringProgress.value = withTiming(resultData.score / 100, {
          duration: 1500,
          easing: Easing.out(Easing.exp),
        });
      } catch (error: any) {
        console.error("Failed to fetch results:", error);
        setErrorMessage(error?.response?.data?.message || "We could not load your mock exam results.");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [examId, mockExamId]);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - ringProgress.value),
  }));

  const weakTopics = results?.breakdown.filter(item => item.questions > 0 && item.correct / item.questions < 0.7) || [];
  const missedQuestions = results?.questions.filter(
    q => q.responseType !== "THEORY" && !q.isCorrect && !q.isLocked,
  ) || [];
  const topicsToReview = results
    ? (weakTopics.length > 0
      ? weakTopics
      : results.breakdown.filter(item => item.questions > 0).slice(0, 2))
    : [];

  const buildTutorContext = () => {
    if (!results) return "";

    const topicLines = topicsToReview.length > 0
      ? topicsToReview.map(topic => {
        const score = Math.round((topic.correct / topic.questions) * 100);
        return `- ${topic.topic}: ${score}% (${topic.correct}/${topic.questions})`;
      }).join("\n")
      : "- No weak topic rows were returned. Use the missed questions as the study guide.";

    const missedLines = missedQuestions.slice(0, 4).map((question, index) =>
      `${index + 1}. ${question.text}\nStudent answered: ${question.userAnswer}\nCorrect answer: ${question.correctAnswer}\nExplanation: ${question.aiExplanation}`
    ).join("\n\n");

    return `Mock exam score: ${results.score}%.\nCourse: ${plan?.course_code || "Exam prep"} ${plan?.course_name ? `- ${plan.course_name}` : ""}.\n\nWeak topics:\n${topicLines}\n\nMissed questions to reteach:\n${missedLines || "No missed unlocked questions were returned."}\n\nTutor instruction: reteach these weak areas simply, ask one diagnostic question at a time, and help the student build exam-ready confidence.`;
  };

  const handleStudyWeakAreas = () => {
    if (!results) return;

    setWeakStudyVisible(true);
    if (missedQuestions[0]) {
      setExpandedQuestion(missedQuestions[0].id);
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 430, animated: true });
    });
  };

  const renderScoreCard = () => {
    if (!results) return null;

    return (
      <LinearGradient
        colors={["#4338CA", "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.scoreCard}
      >
        <Text style={[styles.scoreTitle, typography.h2]}>Mock Exam Complete</Text>
        <Text style={[styles.scoreSubtitle, typography.bodySmall]}>{results.subtitle}</Text>

        <View style={styles.datePill}>
          <Check size={14} color="white" style={{ marginRight: 6 }} />
          <Text style={[styles.dateText, typography.caption]}>
            COMPLETED: {results.date.toUpperCase()}
          </Text>
        </View>

        <View style={styles.ringContainer}>
          <Svg width={150} height={150} viewBox="0 0 150 150">
            <Circle
              cx="75"
              cy="75"
              r={radius}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="10"
              fill="transparent"
            />
            <AnimatedCircle
              cx="75"
              cy="75"
              r={radius}
              stroke="white"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={circumference}
              animatedProps={animatedCircleProps}
              strokeLinecap="round"
              transform="rotate(-90 75 75)"
            />
          </Svg>
          <View style={styles.scoreTextContainer}>
            <Text style={[styles.scorePercent, typography.h1]}>{results.score}%</Text>
            <Text style={[styles.scoreLabel, typography.caption]}>AGGREGATE</Text>
          </View>
        </View>
      </LinearGradient>
    );
  };

  const renderBreakdown = () => {
    if (!results) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, typography.h3]}>Performance Breakdown</Text>
          <Text style={[styles.sectionSubtitle, typography.caption]}>Topic-wise score distribution</Text>
        </View>

        <Card style={styles.breakdownCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCol, styles.colTopic, typography.mono]}>TOPIC</Text>
            <Text style={[styles.tableCol, styles.colQuestions, typography.mono]}>QUESTIONS</Text>
            <Text style={[styles.tableCol, styles.colCorrect, typography.mono]}>CORRECT</Text>
          </View>
          {results.breakdown.map((item, idx) => {
            const isWeak = (item.correct / item.questions) < 0.5;
            return (
              <View key={idx} style={styles.tableRow}>
                <Text style={[
                  styles.tableCol,
                  styles.colTopic,
                  typography.bodySmall,
                  isWeak && { color: colors.warning }
                ]}>
                  {item.topic}
                </Text>
                <Text style={[styles.tableCol, styles.colQuestions, typography.bodySmall]}>
                  {item.questions}
                </Text>
                <Text style={[styles.tableCol, styles.colCorrect, typography.bodySmall]}>
                  {item.correct}
                </Text>
              </View>
            );
          })}
        </Card>
      </View>
    );
  };

  const renderWeakStudyPath = () => {
    if (!results || !weakStudyVisible) return null;

    return (
      <Card style={styles.weakStudyCard}>
        <Text style={[styles.weakStudyLabel, typography.mono]}>WEAK AREA STUDY PATH</Text>
        <Text style={[styles.weakStudyTitle, typography.h3]}>
          {missedQuestions.length > 0 ? "Review missed questions first" : "Keep strengthening this course"}
        </Text>
        <Text style={[styles.weakStudyText, typography.bodySmall]}>
          {missedQuestions.length > 0
            ? `Start with ${missedQuestions.length} missed question${missedQuestions.length === 1 ? "" : "s"}, then revisit the lowest-scoring topics below.`
            : "No missed unlocked questions were found, so use this pass to reinforce your lowest topic scores."}
        </Text>

        <View style={styles.weakTopicList}>
          {topicsToReview.map(topic => {
            const score = Math.round((topic.correct / topic.questions) * 100);
            return (
              <View key={topic.topic} style={styles.weakTopicRow}>
                <View style={styles.weakTopicDot} />
                <Text style={[styles.weakTopicText, typography.bodySmall]}>
                  {topic.topic}: {score}% ({topic.correct}/{topic.questions})
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.weakActionRow}>
          <Button
            label="Live Tutor"
            onPress={() => navigation.navigate("LiveTutorEntry", {
              courseCode: plan?.course_code,
              topic: topicsToReview[0]?.topic || plan?.course_name || "Mock exam weak areas",
              materialTitle: `${plan?.course_code || "Mock Exam"} Weak Areas`,
              materialContext: buildTutorContext(),
            })}
            style={styles.weakActionBtn}
          />
          <Button
            label="Review Questions"
            onPress={() => {
              if (missedQuestions[0]) setExpandedQuestion(missedQuestions[0].id);
              scrollRef.current?.scrollToEnd({ animated: true });
            }}
            style={styles.weakActionBtn}
          />
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("PrepPlan", { examId })} style={styles.prepTasksLink}>
          <Text style={[styles.prepTasksText, typography.bodySmall]}>Back to prep tasks</Text>
        </TouchableOpacity>
      </Card>
    );
  };

  const renderQuestionReview = () => {
    if (!results) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, typography.h3, { marginBottom: 16 }]}>Question Review</Text>
        {results.questions.map((q, idx) => {
          const isExpanded = expandedQuestion === q.id;
          return (
            <Card key={q.id} style={styles.questionReviewCard} onPress={() => setExpandedQuestion(isExpanded ? null : q.id)}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewNumberCircle}>
                  <Text style={[styles.reviewNumber, typography.bodySmall]}>{(idx + 1).toString().padStart(2, '0')}</Text>
                </View>
                <Text style={[styles.reviewTitle, typography.bodySmall, { color: colors.textPrimary }]} numberOfLines={1}>
                  {q.title}
                </Text>
                {q.isLocked ? (
                  <Lock size={16} color={colors.textMuted} />
                ) : (
                  isExpanded ? <ChevronUp size={20} color={colors.textMuted} /> : <ChevronDown size={20} color={colors.textMuted} />
                )}
              </View>

              {isExpanded && !q.isLocked && (
                <View style={styles.expandedContent}>
                  <RichMathText
                    content={q.text}
                    textColor={colors.textSecondary}
                    fontSize={14}
                    lineHeight={1.45}
                  />

                  <View style={styles.answerRow}>
                    <View
                      style={[
                        styles.answerStatus,
                        q.responseType === "THEORY"
                          ? styles.theoryBg
                          : q.isCorrect
                            ? styles.correctBg
                            : styles.incorrectBg,
                      ]}
                    >
                      {q.responseType === "THEORY" ? (
                        <Text style={[styles.theoryBadgeText, typography.caption]}>T</Text>
                      ) : q.isCorrect ? (
                        <Check size={12} color="white" />
                      ) : (
                        <X size={12} color="white" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.userAnswer,
                        typography.bodySmall,
                        {
                          color: q.responseType === "THEORY"
                            ? colors.warning
                            : q.isCorrect
                              ? colors.success
                              : colors.error,
                        },
                      ]}
                    >
                      {q.responseType === "THEORY" ? "Your Theory Answer:" : "Your Answer:"} {q.userAnswer}
                    </Text>
                  </View>

                  {q.responseType !== "THEORY" && !q.isCorrect && (
                    <View style={styles.correctAnswerWrap}>
                      <Text style={[styles.correctAnswerLabel, typography.caption]}>Correct Answer:</Text>
                      <RichMathText
                        content={q.correctAnswer}
                        textColor={colors.success}
                        fontSize={13}
                        lineHeight={1.35}
                      />
                    </View>
                  )}

                  <View style={styles.aiExplanationCard}>
                    <Text style={[styles.aiLabel, typography.mono]}>
                      {q.responseType === "THEORY" ? "AI FEEDBACK" : "AI EXPLANATION"}
                    </Text>
                    <RichMathText
                      content={q.aiExplanation}
                      textColor={colors.textSecondary}
                      fontSize={14}
                      lineHeight={1.45}
                    />
                  </View>
                </View>
              )}
            </Card>
          );
        })}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Avatar name={user?.name || "Student"} size={36} />
      <BrandWordmark style={[styles.headerTitle, typography.h3]} />
      <TouchableOpacity>
        <Settings size={24} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeArea style={styles.safeArea}>
      {renderHeader()}
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <Skeleton height={250} borderRadius={16} />
        ) : errorMessage ? (
          <View style={styles.errorState}>
            <Text style={[styles.errorTitle, typography.h3]}>Results unavailable</Text>
            <Text style={[styles.errorText, typography.bodySmall]}>{errorMessage}</Text>
            <Button
              label="Back to Prep Plan"
              onPress={() => navigation.navigate("PrepPlan", { examId })}
              style={styles.mainBtn}
            />
          </View>
        ) : (
          <Animated.View entering={FadeInUp}>
            {renderScoreCard()}
            {renderBreakdown()}
            {renderWeakStudyPath()}
            {renderQuestionReview()}

            <View style={styles.actionButtons}>
              <Button
                label="Study Weak Areas"
                icon={<ArrowRight size={18} color="white" />}

                onPress={handleStudyWeakAreas}
                style={styles.mainBtn}
              />
              <Button
                label="Retake Exam"
                variant="secondary"
                icon={<RotateCcw size={18} color={colors.textPrimary} />}
                onPress={() => navigation.navigate("MockExam", { examId })}
                style={styles.secondaryBtn}
              />
              <TouchableOpacity onPress={() => navigation.navigate("PrepPlan", { examId })} style={styles.ghostLink}>
                <Text style={[styles.ghostText, typography.bodySmall]}>Back to Prep Plan</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>
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
    height: 56,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  scoreCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 40,
  },
  scoreTitle: {
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  scoreSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    marginBottom: 20,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  dateText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  ringContainer: {
    position: "relative",
    width: 150,
    height: 150,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreTextContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  scorePercent: {
    color: "#FFFFFF",
    fontSize: 36,
    lineHeight: 56,
    fontWeight: "700",
  },
  scoreLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 1,
  },
  section: {
    marginBottom: 40,
  },
  errorState: {
    alignItems: "center",
    paddingTop: 80,
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
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: colors.textMuted,
  },
  breakdownCard: {
    padding: 0,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCol: {
    color: colors.textMuted,
    fontSize: 7.5,
  },
  colTopic: {
    flex: 3,
  },
  colQuestions: {
    flex: 1,
    textAlign: "center",
  },
  colCorrect: {
    flex: 1,
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weakStudyCard: {
    padding: 18,
    marginBottom: 40,
    borderColor: colors.warning + "66",
  },
  weakStudyLabel: {
    color: colors.warning,
    fontSize: 8,
    marginBottom: 10,
  },
  weakStudyTitle: {
    color: colors.textPrimary,
    marginBottom: 8,
  },
  weakStudyText: {
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  weakTopicList: {
    gap: 10,
    marginBottom: 18,
  },
  weakTopicRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  weakTopicDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.warning,
    marginRight: 10,
  },
  weakTopicText: {
    color: colors.textPrimary,
    flex: 1,
  },
  weakActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  weakActionBtn: {
    flex: 1,
  },
  prepTasksLink: {
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 6,
  },
  prepTasksText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  questionReviewCard: {
    marginBottom: 12,
    padding: 14,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reviewNumber: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
  reviewTitle: {
    flex: 1,
    marginRight: 8,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fullQuestionText: {
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  answerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  answerStatus: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  correctBg: {
    backgroundColor: colors.success,
  },
  incorrectBg: {
    backgroundColor: colors.error,
  },
  theoryBg: {
    backgroundColor: colors.warning,
  },
  theoryBadgeText: {
    color: colors.background,
    fontWeight: "700",
  },
  userAnswer: {
    fontWeight: "600",
  },
  correctAnswerLabel: {
    color: colors.textMuted,
    marginBottom: 6,
  },
  correctAnswerWrap: {
    marginLeft: 30,
    marginBottom: 16,
  },
  aiExplanationCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  aiLabel: {
    color: colors.primary,
    fontSize: 7.5,
    marginBottom: 8,
  },
  aiText: {
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actionButtons: {
    marginTop: 8,
    gap: 12,
  },
  mainBtn: {
    width: "100%",
  },
  secondaryBtn: {
    width: "100%",
  },
  ghostLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
  ghostText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
});
