import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Platform,
} from "react-native";
import {
  History, Calendar,
  Zap,
  Shield,
  PlusCircle,
  BookOpen,
  Flame,
  ChevronLeft,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Screen } from "../../components/layout/Screen";
import { SafeArea } from "../../components/layout/SafeArea";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Skeleton } from "../../components/ui/Skeleton";
import { AIInsightBanner } from "../../components/ui/AIInsightBanner";
import { Badge } from "../../components/ui/Badge";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import examPrepService, { ExamPrepPlan } from "../../services/examPrep";

const { width } = Dimensions.get("window");

export const ExamPrepScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState<ExamPrepPlan[]>([]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await examPrepService.getAllPlans();
      setPlans(data);
    } catch (error) {
      console.error("Error fetching exam plans:", error);
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

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <ChevronLeft size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, typography.h3]}>Exam Prep</Text>
      <TouchableOpacity onPress={() => navigation.navigate("AcademicTimeline")} style={styles.timelineBtn}>
        <Calendar size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderUrgentBanner = () => {
    const urgentPlan = plans.find((p) => p.days_left <= 5);
    if (!urgentPlan) return null;

    return (
      <View style={styles.urgentBanner}>
        <View style={styles.urgentContent}>
          <Flame size={20} color={colors.warning} style={styles.urgentIcon} />
          <Text style={[styles.urgentText, typography.bodySmall]}>
            {urgentPlan.course_code} {urgentPlan.assessment_label || "Exam"} in {urgentPlan.days_left} days!
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("PrepPlan", { examId: urgentPlan.id })
          }
        >
          <Text style={[styles.viewPlanLink, typography.caption]}>VIEW PLAN</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPrimaryExamCard = (plan: ExamPrepPlan) => {
    const mockActive = plan.progress >= 60;

    return (
      <Animated.View key={plan.id} entering={FadeInUp.delay(100)}>
        <Card style={styles.examCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.courseCode, typography.h3]}>
                {plan.course_code}
              </Text>
              <Text style={[styles.examDate, typography.caption]}>
                {(plan.assessment_label || "Exam").toUpperCase()} ON {new Date(plan.exam_date).toLocaleDateString()}
              </Text>
            </View>
            <Badge label={`${plan.days_left}D LEFT`} variant="warning" />
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressLabel, typography.caption]}>
                Mastery Level
              </Text>
              <Text style={[styles.progressValue, typography.bodySmall]}>
                {plan.progress}%
              </Text>
            </View>
            <ProgressBar progress={plan.progress} color={colors.primary} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, typography.body]}>
                {plan.readiness_grade}
              </Text>
              <Text style={[styles.statLabel, typography.caption]}>GRADE</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, typography.body]}>
                {plan.readiness_score}/100
              </Text>
              <Text style={[styles.statLabel, typography.caption]}>SCORE</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Button
              label="Study Now"
              style={styles.actionBtn}
              onPress={() => navigation.navigate("PrepPlan", { examId: plan.id })}
            />
            <Button
              label="Mock Exam"
              variant="outline"
              style={styles.actionBtn}
              disabled={!mockActive}
              onPress={() => navigation.navigate("MockExam", { examId: plan.id })}
            />
          </View>
          {!mockActive && (
            <Text style={[styles.lockText, typography.caption]}>
              *Reach 60% Mastery to unlock Mock Exam
            </Text>
          )}
        </Card>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <History size={48} color={colors.textMuted} style={styles.emptyIcon} />
      <Text style={[styles.emptyTitle, typography.h3]}>No Active Plans</Text>
      <Text style={[styles.emptySubtitle, typography.body]}>
        Choose a course, then prepare for a test or exam using all materials available for that course.
      </Text>
      <Button
        label="Plan Course Prep"
        icon={<PlusCircle size={20} color="white" />}
        onPress={() => navigation.navigate("AddExam")}
        style={styles.addBtnLarge}
      />
    </View>
  );

  return (
    <SafeArea style={styles.container}>
      <Screen hideHeader>
        {renderHeader()}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {loading ? (
            <View style={styles.skeletonContainer}>
              <Skeleton height={200} width="100%" borderRadius={16} style={{ marginBottom: 16 }} />
              <Skeleton height={200} width="100%" borderRadius={16} />
            </View>
          ) : plans.length > 0 ? (
            <>
              {renderUrgentBanner()}
              <View style={styles.insight}>
        <AIInsightBanner text="Exam Prep works by course. Akademi uses all available materials and questions for the selected course." />
              </View>
              <Text style={[styles.sectionTitle, typography.mono]}>
                ACTIVE PREP PLANS
              </Text>
              {plans.map(renderPrimaryExamCard)}

              <TouchableOpacity
                style={styles.addNewCard}
                onPress={() => navigation.navigate("AddExam")}
              >
                <PlusCircle size={24} color={colors.primary} />
                <Text style={[styles.addNewText, typography.bodySmall]}>
                    Plan another course prep
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            renderEmptyState()
          )}
        </ScrollView>
      </Screen>
    </SafeArea>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    padding: 4,
  },
  timelineBtn: {
    padding: 4,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  urgentBanner: {
    backgroundColor: "#2D1D16",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.warning + "40",
  },
  urgentContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  urgentIcon: {
    marginRight: 8,
  },
  urgentText: {
    color: colors.warning,
    fontWeight: "700",
  },
  viewPlanLink: {
    color: colors.warning,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  insight: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 16,
    letterSpacing: 1,
  },
  examCard: {
    padding: 20,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  courseCode: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  examDate: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    color: colors.textSecondary,
  },
  progressValue: {
    color: colors.primary,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textMuted,
    marginTop: 4,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 44,
  },
  lockText: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 12,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyIcon: {
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 22,
    marginBottom: 32,
  },
  addBtnLarge: {
    paddingHorizontal: 32,
  },
  skeletonContainer: {
    gap: 16,
  },
  addNewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      marginTop: 8,
      gap: 12
  },
  addNewText: {
      color: colors.textSecondary,
      fontWeight: '600'
  }
});
