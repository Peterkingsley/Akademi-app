import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
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
} from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { SafeArea } from "../../components/layout/SafeArea";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Badge } from "../../components/ui/Badge";
import examPrepService, { ExamPrepPlan, Task, DailyTaskGroup } from "../../services/examPrep";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Skeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import Animated, { FadeInUp } from "react-native-reanimated";

export const PrepPlanScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { examId } = route.params;

  const [plan, setPlan] = useState<ExamPrepPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dailyTasks = plan?.daily_tasks || plan?.dailyTasks || [];
  const readinessGrade = plan?.readiness_grade || plan?.readinessGrade || "N/A";
  const readinessScore = plan?.readiness_score ?? plan?.readinessScore ?? 0;

  const fetchPlan = useCallback(async () => {
    try {
      const data = await examPrepService.getPlanDetails(examId);
      setPlan(data);
    } catch (error) {
      console.error("Failed to fetch plan details:", error);
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
    if (!plan || plan.progress < 60) return;
    try {
      const mockExam = await examPrepService.startMockExam(examId);
      navigation.navigate("MockExam", { examId, mockExamId: mockExam.id });
    } catch (error) {
      console.error("Failed to start mock exam:", error);
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

  return (
    <SafeArea style={styles.safeArea}>
      <Header
        title={`${plan?.course_code || ""} Prep Plan`}
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
             <Text style={[styles.suggestionText, typography.mono]}>
               AI SUGGESTION: Focus on integration by parts.
             </Text>
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.readinessContainer}>
              <Text style={[styles.readinessLabel, typography.caption]}>READINESS SCORE</Text>
              <Text style={[styles.readinessValue, typography.h2]}>
                {readinessGrade} ({readinessScore}%)
              </Text>
            </View>
            <Button
              label="Take Mock Exam"
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
