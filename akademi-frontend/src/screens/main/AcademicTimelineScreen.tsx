import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import {
  ChevronLeft,
  Calendar,
  Clock,
  BookOpen,
  RotateCcw,
} from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import examPrepService, { ExamPrepPlan, MockHistoryItem } from "../../services/examPrep";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import Animated, { FadeInUp } from "react-native-reanimated";

export const AcademicTimelineScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState<ExamPrepPlan[]>([]);
  const [latestAttempts, setLatestAttempts] = useState<Record<string, MockHistoryItem>>({});
  const [historyErrors, setHistoryErrors] = useState<Record<string, boolean>>({});

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await examPrepService.getAllPlans();
      const historyPairs = await Promise.all(
        data.map(async (plan) => {
          try {
            const history = await examPrepService.getMockHistory(plan.id);
            return { planId: plan.id, attempt: history[0], failed: false };
          } catch (error) {
            console.error(`Error fetching mock history for ${plan.id}:`, error);
            return { planId: plan.id, attempt: undefined, failed: true };
          }
        })
      );
      // Sort by date
      const sorted = data.sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
      setPlans(sorted);
      const attemptsByPlan = historyPairs.reduce<Record<string, MockHistoryItem>>((acc, item) => {
        if (item.attempt) acc[item.planId] = item.attempt;
        return acc;
      }, {});
      const errorsByPlan = historyPairs.reduce<Record<string, boolean>>((acc, item) => {
        if (item.failed) acc[item.planId] = true;
        return acc;
      }, {});
      setLatestAttempts(attemptsByPlan);
      setHistoryErrors(errorsByPlan);
    } catch (error) {
      console.error("Error fetching timeline:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlans();
  };

  const renderTimelineItem = (plan: ExamPrepPlan, index: number) => {
    const examDate = new Date(plan.exam_date);
    const dateStr = examDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const isPast = examDate.getTime() < new Date().getTime();
    const latestAttempt = latestAttempts[plan.id];
    const latestMockExamId = latestAttempt?.mockExamId || latestAttempt?.mock_exam_id;
    const historyFailed = historyErrors[plan.id];

    return (
      <Animated.View key={plan.id} entering={FadeInUp.delay(index * 100)} style={styles.timelineItem}>
        <View style={styles.dateColumn}>
          <Text style={[styles.dateText, typography.caption, isPast && styles.pastText]}>{dateStr}</Text>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={[styles.timelineLine, isPast && styles.pastLine]} />
            <View style={[styles.timelineDot, isPast && styles.pastDot]} />
          </View>
        </View>
        <Card style={styles.planCard} onPress={() => navigation.navigate("PrepPlan", { examId: plan.id })}>
          <View style={styles.cardHeader}>
            <Text style={[styles.courseCode, typography.h4]}>{plan.course_code}</Text>
            <Badge label={isPast ? "COMPLETED" : `${plan.days_left}D LEFT`} variant={isPast ? "success" : "warning"} />
          </View>
          <Text style={[styles.courseName, typography.bodySmall]} numberOfLines={1}>{plan.course_name || plan.subject || "Exam"}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Clock size={12} color={colors.textMuted} />
              <Text style={[styles.metaText, typography.caption]}>{plan.progress}% Mastered</Text>
            </View>
            <View style={styles.metaItem}>
              <BookOpen size={12} color={colors.textMuted} />
              <Text style={[styles.metaText, typography.caption]}>{plan.readiness_grade} Readiness</Text>
            </View>
          </View>
          {latestAttempt && latestMockExamId && (
            <TouchableOpacity
              style={styles.latestResultRow}
              onPress={() => navigation.navigate("MockExamResults", { examId: plan.id, mockExamId: latestMockExamId })}
            >
              <RotateCcw size={13} color={colors.primary} />
              <Text style={[styles.latestResultText, typography.caption]}>
                Latest mock: {latestAttempt.score}% • reopen results
              </Text>
            </TouchableOpacity>
          )}
          {!latestAttempt && (
            <View style={styles.latestResultStateRow}>
              <Text style={[styles.latestResultStateText, typography.caption]}>
                {historyFailed ? "Mock history could not load" : "No completed mock yet"}
              </Text>
            </View>
          )}
        </Card>
      </Animated.View>
    );
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.h3]}>Academic Timeline</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.intro}>
          <Calendar size={32} color={colors.primary} style={styles.introIcon} />
          <Text style={[styles.introTitle, typography.h2]}>Your Exam Roadmap</Text>
          <Text style={[styles.introSubtitle, typography.body]}>
            Stay ahead of your schedule. Here's your chronological overview of upcoming exams and prep progress.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} height={100} width="100%" borderRadius={12} style={{ marginBottom: 16 }} />
            ))}
          </View>
        ) : plans.length > 0 ? (
          <View style={styles.timelineContainer}>
            {plans.map(renderTimelineItem)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, typography.body]}>No exam plans found. Start by adding one in the Exam Prep screen.</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  intro: {
    alignItems: "center",
    marginBottom: 32,
    textAlign: "center",
  },
  introIcon: {
    marginBottom: 12,
  },
  introTitle: {
    color: colors.textPrimary,
    marginBottom: 8,
  },
  introSubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  loadingContainer: {
    gap: 16,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 24,
  },
  dateColumn: {
    width: 80,
    alignItems: "center",
    marginRight: 16,
  },
  dateText: {
    color: colors.primary,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.primary,
    opacity: 0.3,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  planCard: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  courseCode: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  courseName: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: colors.textMuted,
  },
  latestResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  latestResultText: {
    color: colors.primary,
    fontWeight: "700",
  },
  latestResultStateRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  latestResultStateText: {
    color: colors.textMuted,
  },
  pastText: {
    color: colors.textMuted,
  },
  pastLine: {
    backgroundColor: colors.border,
  },
  pastDot: {
    backgroundColor: colors.textMuted,
  },
  emptyState: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: "center",
  },
});
