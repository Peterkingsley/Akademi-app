import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import {
  Settings,
  Sparkles,
  TrendingUp,
  RotateCcw,
} from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { SafeArea } from "../../components/layout/SafeArea";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Badge } from "../../components/ui/Badge";
import examPrepService, { ExamPrepPlan, MockHistoryItem } from "../../services/examPrep";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Skeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import Animated, { FadeInUp } from "react-native-reanimated";

export const PrepPlanScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { examId } = route.params;

  const [plan, setPlan] = useState<ExamPrepPlan | null>(null);
  const [mockHistory, setMockHistory] = useState<MockHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const readinessGrade = plan?.readiness_grade || plan?.readinessGrade || "N/A";
  const readinessScore = plan?.readiness_score ?? plan?.readinessScore ?? 0;
  const aiSuggestion = useMemo(() => {
    if (!plan) return "";

    const courseLabel = plan.course_code || plan.course_name || plan.subject || "this course";
    const prepLabel = plan.assessment_label || "Exam";

    if (plan.progress < 60) {
      return `AI SUGGESTION: ${courseLabel} - keep practicing in the Library to raise your Mastery Level above 60% and unlock the mock ${prepLabel.toLowerCase()}.`;
    }

    return `AI SUGGESTION: ${courseLabel} - your Mastery Level is strong. Take a mock ${prepLabel.toLowerCase()} to check your readiness.`;
  }, [plan]);

  const fetchPlan = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError("");
      const data = await examPrepService.getPlanDetails(examId);
      setPlan(data);
      try {
        const history = await examPrepService.getMockHistory(examId);
        setMockHistory(history);
      } catch (historyFetchError) {
        console.error("Failed to fetch mock history:", historyFetchError);
        setMockHistory([]);
        setHistoryError("Mock history could not load. Pull to refresh or try again later.");
      } finally {
        setHistoryLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch plan details:", error);
      setHistoryLoading(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlan();
  };

  const startMockExam = async () => {
    if (!plan) return;
    if (plan.progress < 60) {
      Alert.alert(
        "Mock exam locked",
        "Reach at least 60% Mastery Level to unlock this mock exam."
      );
      return;
    }
    try {
      const mockExam = await examPrepService.startMockExam(examId);
      navigation.navigate("MockExam", { examId, mockExamId: mockExam.id });
    } catch (error: any) {
      console.error("Failed to start mock exam:", error);
      Alert.alert(
        "Mock exam unavailable",
        error?.response?.data?.message || "No scored questions are available for this course yet."
      );
    }
  };

  const renderProgressCard = () => {
    if (!plan) return null;

    return (
      <Card style={styles.progressCard}>
        <Text style={[styles.progressLabel, typography.caption]}>Mastery Level</Text>
        <View style={styles.progressValueRow}>
          <Text style={[styles.progressValue, typography.h2]}>
            {readinessGrade} grade
          </Text>
          <Text style={[styles.progressPercent, typography.h2]}>{plan.progress}%</Text>
        </View>
        <ProgressBar progress={plan.progress} style={styles.progressBar} />
      </Card>
    );
  };

  const renderMockFormatCard = () => {
    if (!plan) return null;

    const durationMinutes = plan.duration_minutes || 120;
    const objectiveCount = plan.objective_question_count || 40;
    const theoryCount = plan.theory_question_count || 5;

    return (
      <Card style={styles.mockFormatCard}>
        <View style={styles.mockFormatHeader}>
          <View>
            <Text style={[styles.mockFormatLabel, typography.caption]}>MOCK FORMAT</Text>
            <Text style={[styles.mockFormatTitle, typography.h3]}>
              What this {plan.assessment_label || "exam"} will look like
            </Text>
          </View>
          <Badge
            label={`${durationMinutes} mins`}
            variant="blue"
            style={styles.mockFormatBadge}
          />
        </View>

        <Text style={[styles.mockFormatDescription, typography.bodySmall]}>
          Akademi will pull questions from all approved materials in {plan.course_code} and build the mock in this format. Once you answer a question, it will never repeat.
        </Text>

        <View style={styles.mockStatsRow}>
          <View style={styles.mockStatPill}>
            <Text style={[styles.mockStatValue, typography.h3]}>{objectiveCount}</Text>
            <Text style={[styles.mockStatLabel, typography.caption]}>Objective</Text>
          </View>
          <View style={styles.mockStatPill}>
            <Text style={[styles.mockStatValue, typography.h3]}>{theoryCount}</Text>
            <Text style={[styles.mockStatLabel, typography.caption]}>Theory</Text>
          </View>
          <View style={styles.mockStatPill}>
            <Text style={[styles.mockStatValue, typography.h3]}>{objectiveCount + theoryCount}</Text>
            <Text style={[styles.mockStatLabel, typography.caption]}>Total</Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderMockHistory = () => {
    return (
      <View style={styles.historySection}>
        <Text style={[styles.historyTitle, typography.h3]}>Mock Exam History</Text>
        {historyLoading ? (
          <Skeleton height={64} borderRadius={12} />
        ) : historyError ? (
          <Card style={styles.historyStateCard}>
            <Text style={[styles.historyStateTitle, typography.bodySmall]}>History unavailable</Text>
            <Text style={[styles.historyStateText, typography.caption]}>{historyError}</Text>
          </Card>
        ) : mockHistory.length === 0 ? (
          <Card style={styles.historyStateCard}>
            <Text style={[styles.historyStateTitle, typography.bodySmall]}>No completed mocks yet</Text>
            <Text style={[styles.historyStateText, typography.caption]}>
              Once you submit a mock exam, your scores and review links will appear here.
            </Text>
          </Card>
        ) : (
          mockHistory.map((attempt) => {
          const mockExamId = attempt.mockExamId || attempt.mock_exam_id;
          const completedAt = attempt.completedAt || attempt.completed_at;
          const questionCount = attempt.questionCount || attempt.question_count || 0;

          return (
            <Card
              key={attempt.id}
              style={styles.historyCard}
              onPress={() => mockExamId && navigation.navigate("MockExamResults", { examId, mockExamId })}
            >
              <View style={styles.historyMeta}>
                <View style={styles.historyText}>
                  <Text style={[styles.historyAttemptTitle, typography.bodySmall]} numberOfLines={1}>
                    {attempt.title || "Completed Mock Exam"}
                  </Text>
                  <Text style={[styles.historyDate, typography.caption]}>
                    {completedAt ? new Date(completedAt).toLocaleDateString() : "Completed"} • {questionCount} questions
                  </Text>
                </View>
              </View>
              <Text style={[styles.historyScore, typography.h3]}>{attempt.score}%</Text>
            </Card>
          );
          })
        )}
      </View>
    );
  };

  return (
    <SafeArea style={styles.safeArea}>
      <Header
        title={`${plan?.course_code || ""} ${plan?.assessment_label || "Exam"} Prep`}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={() => navigation.navigate("AddExam", { courseCode: plan?.course_code })}>
            <Settings size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View>
            <Skeleton height={120} borderRadius={12} style={{ marginBottom: 24 }} />
            <Skeleton height={300} borderRadius={12} />
          </View>
        ) : (
          <Animated.View entering={FadeInUp}>
            {renderProgressCard()}
            {renderMockFormatCard()}
            {renderMockHistory()}
          </Animated.View>
        )}
      </ScrollView>

      {plan && (
        <View style={styles.stickyFooter}>
          <View style={styles.aiSuggestion}>
             <Text style={[styles.suggestionText, typography.mono]}>{aiSuggestion}</Text>
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.readinessContainer}>
              <Text style={[styles.readinessLabel, typography.caption]}>MASTERY LEVEL</Text>
              <Text style={[styles.readinessValue, typography.h2]}>
                {readinessGrade} ({readinessScore}%)
              </Text>
            </View>
            <Button
              label={`Take Mock ${plan.assessment_label || "Exam"} →`}
              onPress={startMockExam}
              disabled={plan.progress < 60}
              style={StyleSheet.flatten([styles.mockBtn, plan.progress < 60 ? styles.disabledBtn : undefined])}
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
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 160,
  },
  progressCard: {
    padding: 20,
    marginBottom: 32,
  },
  progressLabel: {
    color: colors.textSecondary,
    marginBottom: 8,
  },
  progressValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
  },
  progressValue: {
    color: colors.textPrimary,
    flex: 1,
  },
  progressPercent: {
    color: colors.primary,
    marginLeft: 8,
  },
  progressBar: {
    height: 8,
  },
  mockFormatCard: {
    padding: 18,
    marginBottom: 24,
    backgroundColor: colors.surface,
  },
  mockFormatHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  mockFormatLabel: {
    color: colors.textSecondary,
    marginBottom: 4,
  },
  mockFormatTitle: {
    color: colors.textPrimary,
    flexShrink: 1,
  },
  mockFormatBadge: {
    alignSelf: "flex-start",
  },
  mockFormatDescription: {
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  mockStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  mockStatPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  mockStatValue: {
    color: colors.primary,
    fontWeight: "700",
    marginBottom: 4,
  },
  mockStatLabel: {
    color: colors.textSecondary,
  },
  historySection: {
    marginBottom: 32,
  },
  historyTitle: {
    color: colors.textPrimary,
    marginBottom: 12,
  },
  historyCard: {
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  historyText: {
    flex: 1,
  },
  historyAttemptTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  historyDate: {
    color: colors.textMuted,
    marginTop: 2,
  },
  historyScore: {
    color: colors.primary,
    fontWeight: "700",
  },
  historyStateCard: {
    padding: 14,
  },
  historyStateTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  historyStateText: {
    color: colors.textMuted,
    lineHeight: 18,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 0,
  },
  aiSuggestion: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: "#0D1526",
  },
  sparkleIcon: {
    marginRight: 12,
  },
  suggestionText: {
    color: colors.textSecondary,
    fontSize: 8.25,
    flex: 1,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  readinessContainer: {
    flex: 1,
    marginRight: 20,
  },
  readinessLabel: {
    color: colors.textSecondary,
    marginBottom: 4,
  },
  readinessValue: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  mockBtn: {
    flex: 1,
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
