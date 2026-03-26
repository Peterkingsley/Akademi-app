import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform,
} from "react-native";
import {
  Settings,
  PlusCircle,
  Calendar,
  GraduationCap,
  Flame,
  Shield,
  Zap,
  BookOpen,
  Bell,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  History,
  TrendingUp,
} from "lucide-react-native";
import { SafeArea } from "../../components/layout/SafeArea";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/ui/Avatar";
import { useAuthStore } from "../../store/useAuthStore";
import examPrepService, { ExamPrepPlan } from "../../services/examPrep";
import { Skeleton } from "../../components/ui/Skeleton";
import { useNavigation } from "@react-navigation/native";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Badge } from "../../components/ui/Badge";
import { AIInsightBanner } from "../../components/ui/AIInsightBanner";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";

const { width } = Dimensions.get("window");

export const ExamPrepScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<ExamPrepPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await examPrepService.getAllPlans();
      setPlans(data || []);
    } catch (error) {
      console.error("Failed to fetch exam prep plans:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlans();
  };

  const urgentExam = useMemo(() => {
    return plans.find(plan => plan.daysLeft >= 0 && plan.daysLeft <= 5);
  }, [plans]);

  const renderHeader = () => (
    <View style={styles.header}>
      <Avatar name={user?.name || "Student"} size={36} />
      <Text style={[styles.headerTitle, typography.h3]}>Akademi</Text>
      <TouchableOpacity onPress={() => navigation.navigate("NotificationsSettings")}>
        <Settings size={24} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  const renderUrgentBanner = () => {
    if (!urgentExam) return null;

    return (
      <Animated.View entering={FadeInUp} style={styles.urgentBanner}>
        <View style={styles.urgentContent}>
          <Bell size={18} color={colors.warning} style={styles.urgentIcon} />
          <Text style={[styles.urgentText, typography.bodySmall]}>
            {urgentExam.courseCode} exam in {urgentExam.daysLeft} days
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("PrepPlan", { examId: urgentExam.id })}>
          <Text style={[styles.viewPlanLink, typography.bodySmall]}>View Plan →</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderPrimaryExamCard = (plan: ExamPrepPlan) => {
    const mockActive = plan.progress >= 60;

    return (
      <Card key={plan.id} style={styles.primaryCard} onPress={() => navigation.navigate("PrepPlan", { examId: plan.id })}>
        <View style={styles.cardHeader}>
          <Text style={[styles.subjectTag, typography.caption]}>{plan.subject}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.examTitle, typography.h2]}>{plan.courseCode}</Text>
          <View style={styles.examMeta}>
            <Text style={[styles.examDate, typography.bodySmall]}>{plan.examDate}</Text>
            <View style={styles.dot} />
            <View style={styles.daysLeftContainer}>
              <Flame size={14} color={colors.warning} style={styles.flameIcon} />
              <Text style={[styles.daysLeftText, typography.bodySmall]}>{plan.daysLeft} days away</Text>
            </View>
          </View>

          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, typography.mono]}>PREPARATION PROGRESS</Text>
            <Text style={[styles.progressPercentage, typography.mono]}>{plan.progress}%</Text>
          </View>
          <ProgressBar progress={plan.progress} style={styles.progressBar} />

          <View style={styles.cardActions}>
            <Button
              label="Continue Prep"
              onPress={() => navigation.navigate("PrepPlan", { examId: plan.id })}
              style={styles.actionBtn}
            />
            <Button
              label="Mock Exam"
              variant="secondary"
              disabled={!mockActive}
              onPress={() => navigation.navigate("MockExam", { examId: plan.id })}
              style={StyleSheet.flatten([styles.actionBtn, !mockActive ? styles.disabledBtn : undefined])}
            />
          </View>

          <AIInsightBanner text="Based on last 3 mocks, focus 40% more on Alkanes nomenclature." />
        </View>
      </Card>
    );
  };

  const renderSecondaryExamCard = (plan: ExamPrepPlan) => (
    <Card key={plan.id} style={styles.secondaryCard} onPress={() => navigation.navigate("PrepPlan", { examId: plan.id })}>
      <View style={styles.secondaryHeader}>
        <Text style={[styles.subjectTag, typography.caption]}>{plan.subject}</Text>
        <Text style={[styles.secondaryPercentage, typography.mono]}>{plan.progress}%</Text>
      </View>
      <Text style={[styles.secondaryTitle, typography.h3]}>{plan.courseCode}</Text>
      <Text style={[styles.secondaryDays, typography.bodySmall]}>{plan.daysLeft} days left</Text>
      <ProgressBar progress={plan.progress} style={styles.secondaryProgressBar} />
      <Button
        label="Resume Study"
        variant="secondary"

        onPress={() => navigation.navigate("PrepPlan", { examId: plan.id })}
        style={styles.secondaryBtn}
      />
    </Card>
  );

  const renderStats = () => {
    const stats = [
      { id: 'mock', label: 'Mock History', value: '14 Completed', icon: History, color: colors.primary },
      { id: 'score', label: 'Average Score', value: '78.4%', icon: Zap, color: colors.warning },
      { id: 'confidence', label: 'Confidence Level', value: 'High', icon: Shield, color: colors.success },
    ];

    return (
      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <View key={stat.id} style={styles.statTile}>
            <View style={[styles.statIconContainer, { backgroundColor: stat.color + '20' }]}>
              <stat.icon size={18} color={stat.color} />
            </View>
            <Text style={[styles.statValue, typography.bodySmall]}>{stat.value}</Text>
            <Text style={[styles.statLabel, typography.caption]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeArea style={styles.safeArea}>
      {renderHeader()}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Animated.View entering={FadeInUp.duration(600)}>
          <Text style={[styles.pageTitle, typography.h1]}>Exam Prep</Text>
          <Text style={[styles.subtitle, typography.bodySmall]}>
            Plan, practice, and show up ready
          </Text>
        </Animated.View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <Skeleton height={60} borderRadius={10} style={{ marginBottom: 16 }} />
            <Skeleton height={200} borderRadius={12} style={{ marginBottom: 16 }} />
            <Skeleton height={100} borderRadius={12} style={{ marginBottom: 16 }} />
          </View>
        ) : (
          <View>
            {renderUrgentBanner()}

            {plans.length > 0 ? (
              <View>
                {renderPrimaryExamCard(plans[0])}
                {plans.slice(1).map(renderSecondaryExamCard)}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <BookOpen size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, typography.body]}>No active exams yet.</Text>
              </View>
            )}

            {renderStats()}

            <TouchableOpacity
              style={styles.addExamLink}
              onPress={() => navigation.navigate("AddExam")}
            >
              <PlusCircle size={20} color={colors.primary} />
              <Text style={[styles.addExamText, typography.body]}>Add Exam</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom Nav Placeholder */}
      <View style={styles.bottomNav}>
         {['Tutor', 'Hub', 'Timeline', 'Exams'].map((tab) => (
           <TouchableOpacity key={tab} style={styles.navItem} onPress={() => {}}>
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
    paddingBottom: 100,
  },
  pageTitle: {
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 24,
  },
  loadingContainer: {
    marginTop: 20,
  },
  urgentBanner: {
    backgroundColor: "#1C1A10",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    marginBottom: 24,
  },
  urgentContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  urgentIcon: {
    marginRight: 10,
  },
  urgentText: {
    color: colors.warning,
    fontWeight: "600",
  },
  viewPlanLink: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  primaryCard: {
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  subjectTag: {
    color: colors.textSecondary,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    textTransform: "uppercase",
  },
  cardBody: {},
  examTitle: {
    color: colors.textPrimary,
    marginBottom: 4,
  },
  examMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  examDate: {
    color: colors.textSecondary,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
    marginHorizontal: 8,
  },
  daysLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  flameIcon: {
    marginRight: 4,
  },
  daysLeftText: {
    color: colors.warning,
    fontWeight: "600",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  progressPercentage: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  progressBar: {
    marginBottom: 24,
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  secondaryCard: {
    padding: 16,
    marginBottom: 16,
  },
  secondaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  secondaryPercentage: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryTitle: {
    color: colors.textPrimary,
    marginBottom: 4,
  },
  secondaryDays: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  secondaryProgressBar: {
    marginBottom: 16,
    height: 4,
  },
  secondaryBtn: {
    alignSelf: "flex-start",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 24,
  },
  statTile: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    width: (width - 64) / 3,
    alignItems: "center",
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 2,
  },
  statLabel: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  addExamLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  addExamText: {
    color: colors.primary,
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    color: colors.textMuted,
    marginTop: 12,
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
