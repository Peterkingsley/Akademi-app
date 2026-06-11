import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  GraduationCap,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Avatar } from "../../components/ui/Avatar";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { ProgressSummary, userService } from "../../services/user";
import { useAuthStore } from "../../store/useAuthStore";

const formatDate = (value?: string | null) => {
  if (!value) return "Not completed yet";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const ProgressScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user: authUser } = useAuthStore();
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await userService.getProgress();
      setProgress(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load your progress right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, []);

  const maxActivity = useMemo(() => {
    if (!progress) return 1;
    return Math.max(
      1,
      ...progress.weeklyActivity.map((day) => day.sessions + day.solved + day.mocks + day.uploads),
    );
  }, [progress]);

  const hasActivity = progress
    ? progress.summary.sessions + progress.summary.solved + progress.summary.uploads + progress.summary.mockAttempts > 0
    : false;

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={() => loadProgress(true)}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar
              size={38}
              name={authUser?.name || progress?.user.name || "Student"}
              uri={authUser?.avatar_url || undefined}
            />
            <View>
              <Text style={styles.eyebrow}>PROGRESS</Text>
              <Text style={styles.title}>Your learning pulse</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => loadProgress(true)}>
            <RotateCcw size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateText}>Loading your progress...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <AlertCircle size={34} color={colors.warning} />
            <Text style={styles.stateTitle}>Could not load progress</Text>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadProgress()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : progress ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.heroIcon}>
                  <Trophy size={24} color={colors.primary} />
                </View>
                <View style={styles.streakBadge}>
                  <Text style={styles.streakBadgeText}>{progress.summary.streak} day streak</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>
                {hasActivity ? "You are building momentum." : "Start your first tracked study action."}
              </Text>
              <Text style={styles.heroText}>{progress.insight}</Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard icon={BookOpen} label="Solved" value={progress.summary.solved} sub={`${progress.summary.accuracy}% accuracy`} />
              <StatCard icon={Clock3} label="Sessions" value={progress.summary.sessions} sub={`${progress.summary.totalTutorMinutes} tutor min`} />
              <StatCard icon={FileText} label="Uploads" value={progress.summary.uploads} sub={`${progress.summary.approvedUploads} approved`} />
              <StatCard icon={Target} label="Mocks" value={progress.summary.mockAttempts} sub={`${progress.summary.examPlans} exam plans`} />
            </View>

            <SectionCard title="This Week" subtitle="Sessions, solves, mocks, and uploads">
              <View style={styles.weekChart}>
                {progress.weeklyActivity.map((item) => {
                  const total = item.sessions + item.solved + item.mocks + item.uploads;
                  return (
                    <View key={item.date} style={styles.weekColumn}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${Math.max(8, (total / maxActivity) * 100)}%` }]} />
                      </View>
                      <Text style={styles.weekLabel}>{item.day.slice(0, 1)}</Text>
                    </View>
                  );
                })}
              </View>
            </SectionCard>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Course Breakdown</Text>
              <Text style={styles.sectionSubtitle}>Based on real activity</Text>
            </View>

            {progress.courses.length > 0 ? (
              progress.courses.map((course) => {
                const isOpen = expandedCourse === course.code;
                return (
                  <TouchableOpacity
                    key={course.code}
                    style={styles.courseCard}
                    activeOpacity={0.9}
                    onPress={() => setExpandedCourse(isOpen ? null : course.code)}
                  >
                    <View style={styles.courseTop}>
                      <View style={styles.courseIcon}>
                        <GraduationCap size={18} color={colors.primary} />
                      </View>
                      <View style={styles.courseInfo}>
                        <Text style={styles.courseCode}>{course.code}</Text>
                        <Text style={styles.courseName}>{course.name || "Course activity"}</Text>
                      </View>
                      {isOpen ? (
                        <ChevronUp size={20} color={colors.textMuted} />
                      ) : (
                        <ChevronDown size={20} color={colors.textMuted} />
                      )}
                    </View>

                    {isOpen && (
                      <View style={styles.courseDetails}>
                        <Metric label="Sessions" value={course.sessions} />
                        <Metric label="Solved" value={course.solved} />
                        <Metric label="Mocks" value={course.mocks} />
                        <Metric label="Uploads" value={course.uploads} />
                        <Metric label="Accuracy" value={course.solved ? `${Math.round((course.correct / course.solved) * 100)}%` : "-"} />
                        <Metric label="Avg mock" value={course.averageMockScore === null ? "-" : `${course.averageMockScore}%`} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <EmptyCard
                title="No course activity yet"
                text="Solve a question, start a tutor session, upload a material, or take a mock exam to see course progress here."
              />
            )}

            <SectionCard title="Recent Activity" subtitle="Latest tracked work">
              {progress.recent.sessions.length === 0 && progress.recent.mocks.length === 0 ? (
                <Text style={styles.emptyInline}>Nothing tracked yet.</Text>
              ) : (
                <>
                  {progress.recent.sessions.map((session) => (
                    <ActivityRow
                      key={session.id}
                      icon={Clock3}
                      title={session.topic || "Tutor session"}
                      meta={`${session.courseCode || "General"} - ${session.messageCount} messages - ${formatDate(session.createdAt)}`}
                    />
                  ))}
                  {progress.recent.mocks.map((mock) => (
                    <ActivityRow
                      key={mock.id}
                      icon={CheckCircle2}
                      title={`Mock result: ${Math.round(mock.score)}%`}
                      meta={`${mock.courseCode || "General"} - ${formatDate(mock.completedAt)}`}
                    />
                  ))}
                </>
              )}
            </SectionCard>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
};

const StatCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number; sub: string }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.statCard}>
      <Icon size={18} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
};

const SectionCard = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <BarChart3 size={18} color={colors.textMuted} />
      </View>
      {children}
    </View>
  );
};

const Metric = ({ label, value }: { label: string; value: string | number }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
};

const ActivityRow = ({ icon: Icon, title, meta }: { icon: any; title: string; meta: string }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}>
        <Icon size={16} color={colors.primary} />
      </View>
      <View style={styles.activityText}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityMeta}>{meta}</Text>
      </View>
    </View>
  );
};

const EmptyCard = ({ title, text }: { title: string; text: string }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.emptyCard}>
      <Sparkles size={22} color={colors.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 36,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 0,
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
    marginBottom: 2,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  centerState: {
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  stateText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  retryText: {
    color: colors.background,
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.12)",
    padding: 20,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  streakBadgeText: {
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
  },
  heroTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    minHeight: 122,
  },
  statValue: {
    fontSize: 27,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
    marginTop: 12,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
    marginTop: 2,
  },
  statSub: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 3,
  },
  weekChart: {
    height: 112,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  weekColumn: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  barTrack: {
    width: 24,
    height: 82,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  weekLabel: {
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 4,
  },
  courseCard: {
    backgroundColor: colors.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    marginBottom: 12,
  },
  courseTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  courseIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  courseInfo: {
    flex: 1,
  },
  courseCode: {
    fontSize: 15,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
  },
  courseName: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 3,
  },
  courseDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  metric: {
    width: "30%",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 10,
  },
  metricValue: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 8,
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
  },
  emptyInline: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
  },
  activityRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  activityMeta: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 3,
  },
});
