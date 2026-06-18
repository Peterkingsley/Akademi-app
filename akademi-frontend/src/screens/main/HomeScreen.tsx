import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Flame,
  GraduationCap,
  Menu,
  Play,
  Sparkles,
  Swords,
  Target,
  Users,
} from "lucide-react-native";

import api from "../../services/api";
import { notificationService } from "../../services/notificationService";
import { competitionService, CompetitionSummary } from "../../services/competition";
import { userService, ProgressSummary } from "../../services/user";
import { useAuthStore } from "../../store/useAuthStore";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import { Screen } from "../../components/layout/Screen";
import { Skeleton } from "../../components/ui/Skeleton";
import { BrandWordmark } from "../../components/ui/BrandWordmark";
import { Badge } from "../../components/ui/Badge";
import { ExamPrepPlan, LearningProfile, Session } from "./types";

type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  tint: string;
  icon: any;
  onPress: () => void;
};

type ContinueLearningCard = {
  id: string;
  course: string;
  title: string;
  subtitle: string;
  percent: number;
  tint: string;
  onPress: () => void;
};

const formatTimeAgo = (value?: string) => {
  if (!value) return "Today";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatDeadlineTag = (value?: string) => {
  if (!value) return "SOON";
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return "TODAY";
  if (target.getTime() === tomorrow.getTime()) return "TOMORROW";
  return date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
};

const formatDeadlineTime = (value?: string) => {
  if (!value) return "Any time";
  const date = new Date(value);
  const hours = date.getHours();
  const mins = date.getMinutes();
  if (hours === 0 && mins === 0) return "All day";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const parseDurationMinutes = (value?: string) => {
  if (!value) return 0;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

const clampPercent = (value: number) => Math.max(8, Math.min(100, value));

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [exams, setExams] = useState<ExamPrepPlan[]>([]);
  const [competitionSummary, setCompetitionSummary] = useState<CompetitionSummary | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHome = async () => {
      try {
        const [sessionsRes, profileRes, progressRes, examsRes, notificationsRes, competitionRes] =
          await Promise.all([
            api.get("/users/me/sessions?limit=6"),
            api.get("/users/me/learning-profile"),
            userService.getProgress(),
            api.get("/exam-prep"),
            notificationService.list(),
            competitionService.getSummary().catch(() => null),
          ]);

        setSessions(sessionsRes.data || []);
        setLearningProfile(profileRes.data || { session_count: 0, subject_weaknesses: [] });
        setProgress(progressRes);
        setExams(examsRes.data || []);
        setUnreadNotifications((notificationsRes || []).filter((item) => !item.read).length);
        setCompetitionSummary(competitionRes || null);
      } catch (error) {
        console.error("Error fetching updated home screen data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHome();
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = user?.name?.split(" ")[0] || "Student";
  const sortedExams = useMemo(
    () =>
      [...exams].sort(
        (a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
      ),
    [exams]
  );
  const nextExam = sortedExams[0];

  const nextExamDays = useMemo(() => {
    if (!nextExam?.exam_date) return null;
    const diff = new Date(nextExam.exam_date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }, [nextExam]);

  const activeWeakTopic = useMemo(() => {
    const raw = (learningProfile?.subject_weaknesses?.[0] as any) || null;
    if (!raw) return null;
    if (typeof raw === "string") {
      return { topic: raw, course_code: raw.split(" ")[0] || "COURSE" };
    }
    return raw;
  }, [learningProfile]);

  const nextExamTasksSource = nextExam as
    | (ExamPrepPlan & {
        daily_tasks?: Array<{ tasks: Array<{ completed: boolean; duration?: string }> }>;
        dailyTasks?: Array<{ tasks: Array<{ completed: boolean; duration?: string }> }>;
      })
    | undefined;
  const todayTasks =
    nextExamTasksSource?.daily_tasks?.[0]?.tasks ||
    nextExamTasksSource?.dailyTasks?.[0]?.tasks ||
    [];
  const topicsLeft = todayTasks.length
    ? todayTasks.filter((task: { completed: boolean }) => !task.completed).length
    : Math.max(1, (progress?.summary.examPlans || 1) + (activeWeakTopic ? 1 : 0));
  const mockPending = nextExam ? 1 : 0;
  const minsEstimate = todayTasks.length
    ? todayTasks.reduce(
        (sum: number, task: { duration?: string }) => sum + parseDurationMinutes(task.duration),
        0
      )
    : nextExamDays === 0
      ? 42
      : 24;

  const heroCourse = nextExam?.course_code || activeWeakTopic?.course_code || "Start learning";
  const heroTitleSuffix = nextExam
    ? nextExamDays === 0
      ? "Exam is today"
      : `Exam in ${nextExamDays} day${nextExamDays === 1 ? "" : "s"}`
    : "Keep learning strong";
  const heroBody = nextExamDays === 0
    ? "You're almost ready! Let's finish strong."
    : activeWeakTopic
      ? `Let's close the gap in ${activeWeakTopic.topic || activeWeakTopic.course_code} today.`
      : "Pick one smart step and keep your momentum moving.";

  const sessionCount = progress?.summary.sessions ?? sessions.length;
  const streak = progress?.summary.streak ?? 0;
  const accuracy = progress?.summary.accuracy ?? 0;

  const continueLearningCards: ContinueLearningCard[] = useMemo(() => {
    return sessions.slice(0, 3).map((session, index) => ({
      id: session.id,
      course: session.course_code || "STUDY",
      title:
        session.title ||
        session.topic ||
        `${(session.session_type || session.type || "Study").replace(/_/g, " ")} session`,
      subtitle: formatTimeAgo(session.started_at || session.created_at),
      percent: clampPercent(
        accuracy
          ? accuracy - index * 9
          : 65 - index * 11 + Math.min(20, sessionCount)
      ),
      tint: ["#22C55E", "#3B82F6", "#A855F7"][index % 3],
      onPress: () => navigation.navigate("SessionDetail", { id: session.id }),
    }));
  }, [accuracy, navigation, sessionCount, sessions]);

  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        id: "solve",
        title: "Solve",
        subtitle: "Scan & solve",
        tint: "#2563EB",
        icon: Camera,
        onPress: () => navigation.navigate("Solve"),
      },
      {
        id: "learn",
        title: "Learn",
        subtitle: "Study materials",
        tint: "#16A34A",
        icon: BookOpen,
        onPress: () => navigation.navigate("Library"),
      },
      {
        id: "exams",
        title: "Exams",
        subtitle: "Mock tests",
        tint: "#F59E0B",
        icon: Target,
        onPress: () => navigation.navigate("ExamPrep"),
      },
      {
        id: "tutor",
        title: "Tutor",
        subtitle: "Live support",
        tint: "#8B5CF6",
        icon: Bot,
        onPress: () => navigation.navigate("LiveTutorEntry"),
      },
      {
        id: "battle",
        title: "Battle",
        subtitle: "Live battles",
        tint: "#EAB308",
        icon: Swords,
        onPress: () => navigation.navigate("CompetitionHub"),
      },
      {
        id: "groups",
        title: "Groups",
        subtitle: "Study together",
        tint: "#2563EB",
        icon: Users,
        onPress: () => navigation.navigate("Sessions"),
      },
    ],
    [navigation]
  );

  const recommendationItems = useMemo(() => {
    if (nextExam) {
      return [
        `Revise ${nextExam.course_code}`,
        `Take ${Math.min(15, Math.max(10, minsEstimate))} min mock test`,
        "Review latest session",
      ];
    }

    return [
      `Review ${activeWeakTopic?.topic || "your weak topic"}`,
      "Take one short practice round",
      "Open your latest study material",
    ];
  }, [activeWeakTopic, minsEstimate, nextExam]);

  const deadlines = useMemo(() => sortedExams.slice(0, 3), [sortedExams]);

  const communityStats = useMemo(
    () => [
      {
        id: "community",
        label: "Akademi community today",
        value: undefined as number | undefined,
        icon: Users,
        tint: colors.primary,
      },
      {
        id: "solved",
        label: "Questions solved",
        value: progress?.summary.solved ?? 0,
        icon: Sparkles,
        tint: "#22C55E",
      },
      {
        id: "mocks",
        label: "Mock tests taken",
        value: progress?.summary.mockAttempts ?? 0,
        icon: ClipboardList,
        tint: "#F59E0B",
      },
      {
        id: "battles",
        label: "Live battles",
        value: competitionSummary?.matchesPlayed ?? 0,
        icon: Swords,
        tint: "#A855F7",
      },
    ],
    [colors.primary, competitionSummary?.matchesPlayed, progress?.summary.mockAttempts, progress?.summary.solved]
  );

  const openHeroPrimary = () => {
    if (nextExam) {
      navigation.navigate("PrepPlan", { examId: nextExam.id });
      return;
    }
    if (continueLearningCards[0]) {
      continueLearningCards[0].onPress();
      return;
    }
    navigation.navigate("Library");
  };

  return (
    <View style={styles.root}>
      <Screen scrollable hideHeader style={styles.screen}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => navigation.navigate("Profile")}
              style={styles.menuButton}
            >
              <Menu size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerCopy}>
              <Text style={styles.greeting}>
                {greeting}, {firstName} <Text>{String.fromCodePoint(0x1F44B)}</Text>
              </Text>
              <View style={styles.logoRow}>
                <View style={styles.logoMark}>
                  <GraduationCap size={16} color={colors.primary} />
                </View>
                <BrandWordmark style={styles.wordmark} />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => navigation.navigate("Notifications")}
              style={styles.notificationButton}
            >
              <Bell size={22} color={colors.textPrimary} />
              {unreadNotifications > 0 && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          </View>

          <Animated.View entering={FadeInUp.duration(280)} style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroCopyBlock}>
                <View style={styles.focusPill}>
                  <Text style={styles.focusPillText}>Today's focus</Text>
                </View>
                <Text style={styles.heroCourse}>{heroCourse}</Text>
                <Text style={styles.heroTitle}>{heroTitleSuffix}</Text>
                <Text style={styles.heroBody}>{heroBody} <Text>{String.fromCodePoint(0x1F4AA)}</Text></Text>
              </View>

              <View style={styles.heroArtwork}>
                <View style={styles.glowRing} />
                <View style={styles.bookStackTop} />
                <View style={styles.bookStackMid} />
                <View style={styles.bookStackBottom} />
                <View style={styles.capBase}>
                  <GraduationCap size={72} color="#0B0B0B" />
                </View>
              </View>
            </View>

            <View style={styles.heroMetrics}>
              <View style={styles.heroMetricItem}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#10351C" }]}>
                  <CheckCircle2 size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.metricValue}>{topicsLeft}</Text>
                  <Text style={styles.metricLabel}>topics left</Text>
                </View>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.heroMetricItem}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#3C2410" }]}>
                  <ClipboardList size={18} color={colors.warning} />
                </View>
                <View>
                  <Text style={styles.metricValue}>{mockPending}</Text>
                  <Text style={styles.metricLabel}>mock pending</Text>
                </View>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.heroMetricItem}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#102647" }]}>
                  <Clock3 size={18} color="#3B82F6" />
                </View>
                <View>
                  <Text style={styles.metricValue}>{minsEstimate}</Text>
                  <Text style={styles.metricLabel}>mins estimate</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.86} style={styles.heroCta} onPress={openHeroPrimary}>
              <View style={styles.heroCtaIcon}>
                <Play size={14} color={colors.primaryDark} fill={colors.primaryDark} />
              </View>
              <Text style={styles.heroCtaText}>Continue studying</Text>
              <ArrowRight size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(60)} style={styles.streakCard}>
            <View style={styles.streakLeft}>
              <View style={styles.flameBadge}>
                <Flame size={22} color={colors.warning} fill={colors.warning} />
              </View>
              <View style={styles.sessionMetric}>
                <Text style={styles.streakValue}>{sessionCount}</Text>
                <View>
                  <Text style={styles.sessionMetricLabel}>Learning sessions</Text>
                  <Text style={styles.sessionMetricHint}>Keep the rhythm!</Text>
                </View>
              </View>
            </View>

            <View style={styles.streakRight}>
              <View style={styles.streakValueRow}>
                <Text style={styles.streakValue}>{streak}</Text>
                <Text style={styles.streakUnit}>day streak</Text>
              </View>
              <View style={styles.streakDots}>
                {Array.from({ length: 7 }).map((_, index) => (
                  <View
                    key={`streak-${index}`}
                    style={[
                      styles.streakDot,
                      index < Math.min(streak, 6) && styles.streakDotActive,
                      index === 6 && streak >= 7 && styles.streakDotOutline,
                    ]}
                  />
                ))}
              </View>
            </View>
          </Animated.View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("Solve")}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickGrid}>
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Animated.View key={action.id} entering={FadeInUp.delay(100 + index * 35)} style={styles.quickCell}>
                  <TouchableOpacity activeOpacity={0.85} style={styles.quickCard} onPress={action.onPress}>
                    <View style={[styles.quickIconWrap, { backgroundColor: `${action.tint}22` }]}>
                      <Icon size={24} color={action.tint} />
                    </View>
                    <View style={styles.quickCardText}>
                      <Text style={styles.quickTitle}>{action.title}</Text>
                      <Text style={styles.quickSubtitle}>{action.subtitle}</Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Continue learning</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("Sessions")}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} width={174} height={130} borderRadius={14} style={styles.cardSkeleton} />
              ))}
            </ScrollView>
          ) : (
            <FlatList
              data={continueLearningCards}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInUp.delay(150 + index * 40)}>
                  <TouchableOpacity activeOpacity={0.84} style={styles.continueCard} onPress={item.onPress}>
                    <View style={styles.continueCardTop}>
                      <Text style={styles.courseTag}>{item.course}</Text>
                      <TouchableOpacity activeOpacity={0.8} onPress={item.onPress} style={styles.inlinePlay}>
                        <Play size={13} color="#FFFFFF" fill="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.continueTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.continueSubtitle}>{item.subtitle}</Text>
                    <View style={styles.progressRow}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${item.percent}%`, backgroundColor: item.tint }]} />
                      </View>
                      <Text style={styles.progressText}>{item.percent}%</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}
            />
          )}

          <View style={styles.dualSection}>
            <Animated.View entering={FadeInUp.delay(260)} style={styles.recommendCard}>
              <View style={styles.recommendHeader}>
                <View style={styles.recommendTitleRow}>
                  <Sparkles size={18} color={colors.primary} />
                  <Text style={styles.recommendTitle}>Akademi recommends</Text>
                </View>
                <Badge label="NEW" variant="success" />
              </View>

              <View style={styles.recommendList}>
                {recommendationItems.map((item, index) => (
                  <TouchableOpacity
                    key={`${item}-${index}`}
                    activeOpacity={0.82}
                    style={styles.recommendRow}
                    onPress={openHeroPrimary}
                  >
                    <View style={[styles.recommendBullet, { backgroundColor: ["#22C55E", "#F59E0B", "#3B82F6"][index % 3] }]} />
                    <Text style={styles.recommendRowText}>{item}</Text>
                    <ChevronRight size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity activeOpacity={0.86} style={styles.startPlanButton} onPress={openHeroPrimary}>
                <Text style={styles.startPlanText}>Start plan</Text>
                <ArrowRight size={18} color={colors.primary} />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(300)} style={styles.deadlinesCard}>
              <View style={styles.deadlinesHeader}>
                <View style={styles.recommendTitleRow}>
                  <Clock3 size={18} color={colors.textPrimary} />
                  <Text style={styles.deadlinesTitle}>Upcoming deadlines</Text>
                </View>
              </View>

              {deadlines.length === 0 ? (
                <Text style={styles.deadlineEmpty}>No deadlines yet. Add an exam plan to see what is next.</Text>
              ) : (
                deadlines.map((deadline) => (
                  <TouchableOpacity
                    key={deadline.id}
                    activeOpacity={0.84}
                    style={styles.deadlineRow}
                    onPress={() => navigation.navigate("PrepPlan", { examId: deadline.id })}
                  >
                    <View style={styles.deadlineTagWrap}>
                      <Text style={styles.deadlineTag}>{formatDeadlineTag(deadline.exam_date)}</Text>
                    </View>
                    <View style={styles.deadlineCopy}>
                      <Text style={styles.deadlineCourse}>{deadline.course_code}</Text>
                      <Text style={styles.deadlineTime}>{formatDeadlineTime(deadline.exam_date)}</Text>
                    </View>
                    <ChevronRight size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </Animated.View>
          </View>

          <Animated.View entering={FadeInUp.delay(330)} style={styles.communityStrip}>
            {communityStats.map((item, index) => {
              const Icon = item.icon;
              return (
                <React.Fragment key={item.id}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={styles.communityItem}
                    onPress={() =>
                      item.id === "battles"
                        ? navigation.navigate("CompetitionHub")
                        : navigation.navigate("Progress")
                    }
                  >
                    <View style={[styles.communityIcon, { backgroundColor: `${item.tint}18` }]}>
                      <Icon size={16} color={item.tint} />
                    </View>
                    <View style={styles.communityCopy}>
                      {typeof item.value === "number" ? (
                        <Text style={styles.communityValue}>{item.value}</Text>
                      ) : (
                        <Text style={styles.communityLabel}>{item.label}</Text>
                      )}
                      {typeof item.value === "number" && (
                        <Text style={styles.communityLabel}>{item.label}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {index < communityStats.length - 1 && <View style={styles.communityDivider} />}
                </React.Fragment>
              );
            })}
          </Animated.View>
        </View>
      </Screen>

      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.askAkademiOrb}
        onPress={() => navigation.navigate("AskAI")}
      >
        <View style={styles.askOrbInner}>
          <Sparkles size={22} color="#FFFFFF" />
          <Text style={styles.askOrbText}>Ask{"\n"}Akademi</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.background,
      flex: 1,
      position: "relative",
    },
    screen: {
      backgroundColor: colors.background,
    },
    container: {
      paddingBottom: 140,
      paddingHorizontal: 16,
      paddingTop: 6,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    menuButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    headerCopy: {
      flex: 1,
      justifyContent: "center",
    },
    greeting: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 2,
    },
    logoRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    logoMark: {
      alignItems: "center",
      justifyContent: "center",
    },
    wordmark: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      fontWeight: "700",
    },
    notificationButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    unreadDot: {
      backgroundColor: colors.error,
      borderColor: colors.surface,
      borderRadius: 4,
      borderWidth: 1,
      height: 8,
      position: "absolute",
      right: 10,
      top: 10,
      width: 8,
    },
    heroCard: {
      backgroundColor: "#0D1510",
      borderColor: "rgba(34,197,94,0.35)",
      borderRadius: 22,
      borderWidth: 1,
      marginBottom: 14,
      overflow: "hidden",
      padding: 16,
    },
    heroTop: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
      marginBottom: 14,
      minHeight: 152,
    },
    heroCopyBlock: {
      flex: 1,
      maxWidth: "60%",
      paddingRight: 8,
    },
    focusPill: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(34,197,94,0.18)",
      borderRadius: 10,
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    focusPillText: {
      ...typography.h4,
      color: colors.primary,
      fontSize: 12,
    },
    heroCourse: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 28,
      fontWeight: "700",
      lineHeight: 32,
      marginBottom: 2,
    },
    heroTitle: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 28,
      marginBottom: 8,
    },
    heroBody: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    heroArtwork: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      minHeight: 150,
      position: "relative",
    },
    glowRing: {
      backgroundColor: "rgba(34,197,94,0.08)",
      borderColor: "rgba(34,197,94,0.35)",
      borderRadius: 70,
      borderWidth: 1,
      height: 118,
      position: "absolute",
      right: 8,
      top: 12,
      width: 118,
    },
    bookStackBottom: {
      backgroundColor: "#1F2937",
      borderRadius: 10,
      bottom: 28,
      height: 18,
      position: "absolute",
      right: 18,
      transform: [{ rotate: "-6deg" }],
      width: 90,
    },
    bookStackMid: {
      backgroundColor: "#F8FAFC",
      borderRadius: 10,
      bottom: 46,
      height: 18,
      position: "absolute",
      right: 22,
      transform: [{ rotate: "4deg" }],
      width: 86,
    },
    bookStackTop: {
      backgroundColor: "#4ADE80",
      borderRadius: 12,
      bottom: 64,
      height: 20,
      position: "absolute",
      right: 20,
      width: 92,
    },
    capBase: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 26,
      bottom: 82,
      height: 64,
      justifyContent: "center",
      position: "absolute",
      right: 30,
      transform: [{ rotate: "-12deg" }],
      width: 64,
    },
    heroMetrics: {
      backgroundColor: "rgba(17,17,17,0.92)",
      borderColor: "rgba(255,255,255,0.08)",
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    heroMetricItem: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
    },
    metricIconWrap: {
      alignItems: "center",
      borderRadius: 18,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    metricValue: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 28,
      fontWeight: "700",
      lineHeight: 28,
    },
    metricLabel: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
    },
    metricDivider: {
      backgroundColor: "rgba(255,255,255,0.08)",
      width: 1,
    },
    heroCta: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 18,
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    heroCtaIcon: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.88)",
      borderRadius: 11,
      height: 22,
      justifyContent: "center",
      width: 22,
    },
    heroCtaText: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 17,
      fontWeight: "700",
    },
    streakCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    streakLeft: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 1,
      gap: 12,
    },
    flameBadge: {
      alignItems: "center",
      backgroundColor: "rgba(245,158,11,0.16)",
      borderRadius: 18,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    sessionMetric: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    sessionMetricLabel: {
      color: colors.textPrimary,
      fontFamily: "Inter-SemiBold",
      fontSize: 16,
      fontWeight: "600",
    },
    sessionMetricHint: {
      ...typography.body,
      color: colors.primary,
      fontSize: 12,
      marginTop: 2,
    },
    streakRight: {
      alignItems: "flex-end",
      gap: 8,
    },
    streakValueRow: {
      alignItems: "baseline",
      flexDirection: "row",
      gap: 4,
    },
    streakValue: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 20,
      fontWeight: "700",
    },
    streakUnit: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 14,
    },
    streakDots: {
      flexDirection: "row",
      gap: 6,
    },
    streakDot: {
      backgroundColor: "rgba(255,255,255,0.14)",
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    streakDotActive: {
      backgroundColor: colors.primary,
    },
    streakDotOutline: {
      borderColor: colors.primary,
      borderWidth: 1,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
      marginTop: 8,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 17,
      fontWeight: "700",
    },
    seeAll: {
      ...typography.h4,
      color: colors.primary,
      fontSize: 14,
    },
    quickGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 8,
    },
    quickCell: {
      width: "31.8%",
    },
    quickCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      minHeight: 102,
      padding: 12,
    },
    quickIconWrap: {
      alignItems: "center",
      borderRadius: 14,
      height: 42,
      justifyContent: "center",
      marginBottom: 12,
      width: 42,
    },
    quickCardText: {
      flex: 1,
    },
    quickTitle: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 2,
    },
    quickSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
    },
    horizontalList: {
      paddingBottom: 6,
    },
    continueCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      marginRight: 10,
      minHeight: 128,
      padding: 12,
      width: 170,
    },
    continueCardTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    courseTag: {
      ...typography.h4,
      backgroundColor: "rgba(34,197,94,0.18)",
      borderRadius: 8,
      color: colors.primary,
      overflow: "hidden",
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    inlinePlay: {
      alignItems: "center",
      backgroundColor: "#2563EB",
      borderRadius: 18,
      height: 30,
      justifyContent: "center",
      width: 30,
    },
    continueTitle: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 10,
    },
    continueSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 14,
    },
    progressRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: "auto",
    },
    progressTrack: {
      backgroundColor: "rgba(255,255,255,0.08)",
      borderRadius: 999,
      flex: 1,
      height: 5,
      overflow: "hidden",
    },
    progressFill: {
      borderRadius: 999,
      height: 5,
    },
    progressText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
    },
    cardSkeleton: {
      marginRight: 10,
    },
    dualSection: {
      flexDirection: "row",
      gap: 10,
      marginTop: 10,
    },
    recommendCard: {
      backgroundColor: "#0E1711",
      borderColor: "rgba(34,197,94,0.25)",
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      minHeight: 220,
      padding: 14,
    },
    recommendHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    recommendTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    recommendTitle: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      fontWeight: "700",
    },
    recommendList: {
      gap: 10,
      marginBottom: 14,
    },
    recommendRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    recommendBullet: {
      borderRadius: 999,
      height: 12,
      width: 12,
    },
    recommendRowText: {
      ...typography.body,
      color: colors.textPrimary,
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    startPlanButton: {
      alignItems: "center",
      borderColor: "rgba(34,197,94,0.4)",
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "center",
      marginTop: "auto",
      paddingVertical: 12,
    },
    startPlanText: {
      color: colors.primary,
      fontFamily: "Inter-SemiBold",
      fontSize: 15,
      fontWeight: "600",
      marginRight: 8,
    },
    deadlinesCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      minHeight: 220,
      padding: 14,
    },
    deadlinesHeader: {
      marginBottom: 12,
    },
    deadlinesTitle: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      fontWeight: "700",
    },
    deadlineEmpty: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    deadlineRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      marginBottom: 12,
    },
    deadlineTagWrap: {
      backgroundColor: "rgba(245,158,11,0.18)",
      borderRadius: 8,
      minWidth: 66,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    deadlineTag: {
      ...typography.label,
      color: colors.warning,
      fontSize: 10,
      textAlign: "center",
    },
    deadlineCopy: {
      flex: 1,
    },
    deadlineCourse: {
      color: colors.textPrimary,
      fontFamily: "Inter-SemiBold",
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 2,
    },
    deadlineTime: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
    },
    communityStrip: {
      alignItems: "stretch",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      marginTop: 14,
      overflow: "hidden",
    },
    communityItem: {
      alignItems: "center",
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 12,
    },
    communityIcon: {
      alignItems: "center",
      borderRadius: 12,
      height: 28,
      justifyContent: "center",
      marginBottom: 8,
      width: 28,
    },
    communityCopy: {
      alignItems: "center",
    },
    communityValue: {
      color: colors.textPrimary,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 2,
    },
    communityLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 14,
      textAlign: "center",
    },
    communityDivider: {
      backgroundColor: "rgba(255,255,255,0.06)",
      width: 1,
    },
    askAkademiOrb: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderColor: "rgba(255,255,255,0.2)",
      borderRadius: 40,
      borderWidth: 2,
      bottom: 82,
      elevation: 8,
      height: 84,
      justifyContent: "center",
      position: "absolute",
      right: 16,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 18,
      width: 84,
    },
    askOrbInner: {
      alignItems: "center",
      gap: 3,
      justifyContent: "center",
    },
    askOrbText: {
      color: "#FFFFFF",
      fontFamily: "Inter-Bold",
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 15,
      textAlign: "center",
    },
  });
