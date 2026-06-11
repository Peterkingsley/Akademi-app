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
  ChevronLeft,
  Check,
  Play,
  Brain,
  HelpCircle,
  Book,
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
import examPrepService, { ExamPrepPlan, Task, DailyTaskGroup, MockHistoryItem } from "../../services/examPrep";
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
  const dailyTasks = plan?.daily_tasks || plan?.dailyTasks || [];
  const readinessGrade = plan?.readiness_grade || plan?.readinessGrade || "N/A";
  const readinessScore = plan?.readiness_score ?? plan?.readinessScore ?? 0;
  const aiSuggestion = useMemo(() => {
    if (!plan) return "";

    const courseLabel = plan.course_code || plan.course_name || plan.subject || "this course";
    const prepLabel = plan.assessment_label || "Exam";
    const todayGroup = dailyTasks[0];
    const pendingTask = dailyTasks
      .flatMap(group => group.tasks)
      .find(task => !task.completed);

    if (pendingTask) {
      return `AI SUGGESTION: ${courseLabel} - start with "${pendingTask.name}" (${pendingTask.duration}) before moving ahead.`;
    }

    if (todayGroup?.focus) {
      return `AI SUGGESTION: ${courseLabel} ${prepLabel} Prep - review ${todayGroup.focus} today, then unlock a course mock when ready.`;
    }

    return `AI SUGGESTION: ${courseLabel} - keep your prep streak moving and refresh readiness after each study block.`;
  }, [dailyTasks, plan]);

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

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    if (!plan) return;
    try {
      await examPrepService.updateTaskProgress(examId, taskId, !currentStatus);
      fetchPlan();
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const startMockExam = async () => {
    if (!plan) return;
    if (plan.progress < 60) {
      Alert.alert(
        "Mock exam locked",
        "Complete at least 60% of your prep tasks to unlock this mock exam."
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

  const getTaskIcon = (type: Task["type"]) => {
    switch (type) {
      case "quiz": return <HelpCircle size={18} color="white" />;
      case "practice": return <Brain size={18} color="white" />;
      case "revision": return <Book size={18} color="white" />;
      default: return <Book size={18} color="white" />;
    }
  };

  const renderProgressCard = () => {
    if (!plan) return null;

    const completedTasks = dailyTasks.reduce((acc, group) =>
      acc + group.tasks.filter(t => t.completed).length, 0) || 0;
    const totalTasks = dailyTasks.reduce((acc, group) =>
      acc + group.tasks.length, 0) || 0;

    return (
      <Card style={styles.progressCard}>
        <Text style={[styles.progressLabel, typography.caption]}>Overall Progress</Text>
        <View style={styles.progressValueRow}>
          <Text style={[styles.progressValue, typography.h2]}>
            {completedTasks} of {totalTasks} tasks complete
          </Text>
          <Text style={[styles.progressPercent, typography.h2]}>{plan.progress}%</Text>
        </View>
        <ProgressBar progress={plan.progress} style={styles.progressBar} />
      </Card>
    );
  };

  const renderTask = (task: Task) => (
    <View key={task.id} style={styles.taskItem}>
      <TouchableOpacity
        style={[styles.checkbox, task.completed && styles.checkboxChecked]}
        onPress={() => toggleTask(task.id, task.completed)}
      >
        {task.completed && <Check size={14} color="white" />}
      </TouchableOpacity>

      <View style={[styles.taskIconContainer, task.completed && styles.taskIconDimmed]}>
        {getTaskIcon(task.type)}
      </View>

      <View style={styles.taskContent}>
        <Text style={[
          styles.taskName,
          typography.body,
          task.completed && styles.taskNameCompleted
        ]}>
          {task.name}
        </Text>
        <Text style={[styles.taskDuration, typography.caption]}>{task.duration}</Text>
      </View>

      {!task.completed && (
        <TouchableOpacity style={styles.playBtn}>
          <Play size={16} color={colors.primary} fill={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderDayGroup = (group: DailyTaskGroup, index: number) => {
    const isToday = index === 0;

    return (
      <View key={group.date} style={styles.daySection}>
        <View style={styles.dayHeader}>
          <View style={[styles.dayDot, isToday && styles.dayDotToday]} />
          <Text style={[styles.dayTitle, typography.body]}>Day {index + 1} — {group.date}</Text>
          {isToday && (
            <View style={styles.todayBadge}>
              <Text style={[styles.todayBadgeText, typography.caption]}>TODAY</Text>
            </View>
          )}
        </View>
        <Text style={[styles.focusText, typography.mono]}>Focus: {group.focus}</Text>

        <View style={styles.tasksList}>
          {group.tasks.map(renderTask)}
        </View>
      </View>
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
          <TouchableOpacity>
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
            {renderProgressCard()}
            {renderMockHistory()}
            <View style={styles.timeline}>
              {dailyTasks.map((group, idx) => renderDayGroup(group, idx))}
            </View>
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
            <View style={styles.readinessContainer}>
              <Text style={[styles.readinessLabel, typography.caption]}>READINESS SCORE</Text>
              <Text style={[styles.readinessValue, typography.h2]}>
                {readinessGrade} ({readinessScore}%)
              </Text>
            </View>
            <Button
              label={`Take Mock ${plan.assessment_label || "Exam"}`}
              icon={<TrendingUp size={18} color="white" />}
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
  timeline: {
    marginTop: 8,
  },
  daySection: {
    marginBottom: 32,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  dayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "transparent",
    marginRight: 12,
  },
  dayDotToday: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginRight: 10,
  },
  todayBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayBadgeText: {
    color: colors.warning,
    fontWeight: "600",
  },
  focusText: {
    color: colors.textMuted,
    marginLeft: 24,
    marginBottom: 20,
    fontSize: 9,
  },
  tasksList: {
    marginLeft: 24,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 24,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  taskIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  taskIconDimmed: {
    opacity: 0.5,
  },
  taskContent: {
    flex: 1,
  },
  taskName: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  taskNameCompleted: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  taskDuration: {
    color: colors.textMuted,
    marginTop: 2,
  },
  playBtn: {
    padding: 8,
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
