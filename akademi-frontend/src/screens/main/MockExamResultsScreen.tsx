import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
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
import examPrepService, { MockResult, MockResultQuestion } from "../../services/examPrep";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuthStore } from "../../store/useAuthStore";
import { Skeleton } from "../../components/ui/Skeleton";
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
  const { examId } = route.params;
  const { user } = useAuthStore();

  const [results, setResults] = useState<MockResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const ringProgress = useSharedValue(0);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const data = await examPrepService.getMockResults(examId, "mock-1");
        setResults(data);
        ringProgress.value = withTiming(data.score / 100, {
          duration: 1500,
          easing: Easing.out(Easing.exp),
        });
      } catch (error) {
        console.error("Failed to fetch results:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [examId]);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - ringProgress.value),
  }));

  const renderScoreCard = () => {
    if (!results) return null;

    return (
      <LinearGradient
        colors={["#4338CA", "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.scoreCard}
      >
        <Text style={[styles.scoreTitle, typography.h2]}>Mock Exam Complete! 🎓</Text>
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
                  <Text style={[styles.fullQuestionText, typography.bodySmall]}>{q.text}</Text>

                  <View style={styles.answerRow}>
                    <View style={[styles.answerStatus, q.isCorrect ? styles.correctBg : styles.incorrectBg]}>
                      {q.isCorrect ? <Check size={12} color="white" /> : <X size={12} color="white" />}
                    </View>
                    <Text style={[styles.userAnswer, typography.bodySmall, { color: q.isCorrect ? colors.success : colors.error }]}>
                      Your Answer: {q.userAnswer}
                    </Text>
                  </View>

                  {!q.isCorrect && (
                    <Text style={[styles.correctAnswerLabel, typography.caption]}>
                      Correct Answer: <Text style={{ color: colors.success }}>{q.correctAnswer}</Text>
                    </Text>
                  )}

                  <View style={styles.aiExplanationCard}>
                    <Text style={[styles.aiLabel, typography.mono]}>AI EXPLANATION</Text>
                    <Text style={[styles.aiText, typography.bodySmall]}>{q.aiExplanation}</Text>
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
      <Text style={[styles.headerTitle, typography.h3]}>Akademi</Text>
      <TouchableOpacity>
        <Settings size={24} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeArea style={styles.safeArea}>
      {renderHeader()}
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <Skeleton height={250} borderRadius={16} />
        ) : (
          <Animated.View entering={FadeInUp}>
            {renderScoreCard()}
            {renderBreakdown()}
            {renderQuestionReview()}

            <View style={styles.actionButtons}>
              <Button
                label="Study Weak Areas"
                icon={<ArrowRight size={18} color="white" />}

                onPress={() => {}}
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

      {/* Bottom Nav Placeholder */}
      {!loading && (
        <View style={styles.bottomNav}>
           {['Tutor', 'Hub', 'Timeline', 'Exams'].map((tab) => (
             <TouchableOpacity key={tab} style={styles.navItem}>
               <Text style={[
                 typography.caption,
                 { color: tab === 'Exams' ? colors.primary : colors.textMuted }
               ]}>
                 {tab}
               </Text>
               {tab === 'Exams' && <View style={styles.activeDot} />}
             </TouchableOpacity>
           ))}
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
    paddingBottom: 120,
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
    fontSize: 48,
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
    fontSize: 10,
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
  userAnswer: {
    fontWeight: "600",
  },
  correctAnswerLabel: {
    color: colors.textMuted,
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
    fontSize: 10,
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
  bottomNav: {
    flexDirection: "row",
    height: Platform.OS === 'ios' ? 88 : 64,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 24 : 0,
  },
  navItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  activeDot: {
    position: "absolute",
    top: 10,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
