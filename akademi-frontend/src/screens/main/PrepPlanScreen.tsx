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
import examPrepService, { ExamPrepPlan, MockHistoryItem } from "../../services/examPrep";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Skeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import Animated, { FadeInUp } from "react-native-reanimated";

// This is the course's detail/history view - reached by tapping a course card on the Exam Prep
// hub. Study Now and Mock Exam are both directly usable from the hub card itself; this screen
// exists for the extra detail (full mock format + history) that doesn't fit on the compact card.
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
  const [starting, setStarting] = useState(false);
  const aiSuggestion = useMemo(() => {
    if (!plan) return "";

    const courseLabel = plan.course_code || plan.course_name || plan.subject || "this course";
    const prepLabel = plan.assessment_label || "Exam";

    if (plan.last_mock_score !== null && plan.last_mock_score !== undefined) {
      return `AI SUGGESTION: ${courseLabel} - your last mock scored ${plan.last_mock_score}%. Practice in the Library, then try again to beat it.`;
    }

    return `AI SUGGESTION: ${courseLabel} - take a mock ${prepLabel.toLowerCase()} anytime to see where you stand, or study the materials first in the Library.`;
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
    setStarting(true);
    try {
      const mockExam = await examPrepService.startMockExam(examId);
      navigation.navigate("MockExam", { examId, mockExamId: mockExam.id });
    } catch (error: any) {
      console.error("Failed to start mock exam:", error);
      Alert.alert(
        "Mock exam unavailable",
        error?.response?.data?.message || "No scored questions are available for this course yet."
      );
    } finally {
      setStarting(false);
    }
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
          <View style={styles.durationPill}>
            <Text style={[styles.durationPillText, typography.bodySmall]}>{durationMinutes} mins</Text>
          </View>
        </View>

        <Text style={[styles.mockFormatDescription, typography.bodySmall]}>
          Akademi pulls questions from every approved material in {plan.course_code}. Once you answer a question, it will never repeat.
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
                <View style={styles.historyIcon}>
                  <RotateCcw size={16} color={colors.primary} />
                </View>
                <View style={styles.historyText}>
                  <Text style={[styles.historyAttemptTitle, typography.bodySmall]} numberOfLines={1}>
                    {attempt.title || "Completed mock exam"}
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
            <Settings size={24} color={colors.textSecondary} />
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
            {renderMockFormatCard()}
            {renderMockHistory()}
          </Animated.View>
        )}
      </ScrollView>

      {plan && (
        <View style={styles.stickyFooter}>
          <View style={styles.aiSuggestion}>
             <Sparkles size={16} color={colors.primary} style={styles.sparkleIcon} />
             <Text style={[styles.suggestionText, typography.mono]}>{aiSuggestion}</Text>
          </View>

          <View style={styles.bottomBar}>
            <Button
              label={`Take Mock ${plan.assessment_label || "Exam"}`}
              icon={<TrendingUp size={18} color="white" />}
              onPress={startMockExam}
              loading={starting}
              style={styles.mockBtn}
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
  durationPill: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  durationPillText: {
    color: colors.textSecondary,
    fontWeight: "600",
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
    padding: 20,
  },
  mockBtn: {
    width: "100%",
  },
});
