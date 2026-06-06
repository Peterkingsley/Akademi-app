import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Bell,
  BookOpen,
  Bot,
  Camera,
  ChevronRight,
  Clock,
  GraduationCap,
  Library,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  X,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Screen } from "../../components/layout/Screen";
import { Skeleton } from "../../components/ui/Skeleton";
import { notificationService } from "../../services/notificationService";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { ExamPrepPlan, LearningProfile, Recommendation, Session } from "./types";

const STREAK_BANNER_HIDDEN_KEY = "streak_banner_hidden";

const QUICK_ACTIONS = [
  {
    id: "solve",
    label: "Solve",
    description: "Scan assignment",
    icon: Camera,
    tint: "#38BDF8",
    screen: "Solve",
  },
  {
    id: "library",
    label: "Library",
    description: "Study materials",
    icon: Library,
    tint: colors.primary,
    screen: "Library",
  },
  {
    id: "tutor",
    label: "Tutor",
    description: "Live support",
    icon: Bot,
    tint: "#A78BFA",
    screen: "LiveTutorEntry",
  },
  {
    id: "exam",
    label: "Exam Prep",
    description: "Mock tests",
    icon: Target,
    tint: colors.warning,
    screen: "ExamPrep",
  },
];

const AI_TIPS = [
  "Review one weak topic before starting a new one today.",
  "Use a short CBT round after reading to lock the idea in.",
  "Ask Akademi to explain a confusing paragraph before moving on.",
  "Turn one material into practice questions after each study session.",
  "End each session by writing the one thing you now understand better.",
];

const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
};

const getDaysLeft = (dateString?: string) => {
  if (!dateString) return null;
  return Math.max(
    0,
    Math.ceil((new Date(dateString).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
};

type QuickAction = (typeof QUICK_ACTIONS)[number];

const QuickActionTile = ({
  action,
  onPress,
}: {
  action: QuickAction;
  onPress: () => void;
}) => {
  const Icon = action.icon;

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.actionTile}>
      <View style={[styles.actionIcon, { backgroundColor: `${action.tint}22` }]}>
        <Icon size={22} color={action.tint} />
      </View>
      <View style={styles.actionTextBlock}>
        <Text style={styles.actionLabel}>{action.label}</Text>
        <Text style={styles.actionDescription} numberOfLines={1}>
          {action.description}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [exams, setExams] = useState<ExamPrepPlan[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isStreakBannerDismissed, setIsStreakBannerDismissed] = useState(false);

  useEffect(() => {
    fetchData();
    checkStreakBanner();
  }, []);

  const fetchData = async () => {
    try {
      const [sessionsRes, profileRes, examsRes, notificationsRes] = await Promise.all([
        api.get("/users/me/sessions?limit=4"),
        api.get("/users/me/learning-profile"),
        api.get("/exam-prep"),
        notificationService.list(),
      ]);

      setSessions(sessionsRes.data || []);
      setLearningProfile(profileRes.data || { session_count: 0, subject_weaknesses: [] });
      setExams(examsRes.data || []);
      setUnreadNotifications(notificationsRes.filter((item) => !item.read).length);
    } catch (error) {
      console.error("Error fetching home data:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkStreakBanner = async () => {
    const hidden = await AsyncStorage.getItem(STREAK_BANNER_HIDDEN_KEY);
    if (hidden === "true") setIsStreakBannerDismissed(true);
  };

  const dismissStreakBanner = async () => {
    setIsStreakBannerDismissed(true);
    await AsyncStorage.setItem(STREAK_BANNER_HIDDEN_KEY, "true");
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = user?.name?.split(" ")[0] || "Student";
  const nextExam = exams[0];
  const nextExamDays = getDaysLeft(nextExam?.exam_date);
  const sessionCount = learningProfile?.session_count || 0;

  const heroSubtext = useMemo(() => {
    if (nextExam && nextExamDays !== null) {
      return `${nextExam.course_code} is ${nextExamDays === 0 ? "today" : `in ${nextExamDays} day${nextExamDays === 1 ? "" : "s"}`}.`;
    }
    return "Pick one learning flow and keep moving.";
  }, [nextExam, nextExamDays]);

  const recommendations: Recommendation[] = useMemo(() => {
    const recs: Recommendation[] = [];
    const weakness = learningProfile?.subject_weaknesses?.[0] as any;

    if (weakness?.subject || weakness?.topic) {
      recs.push({
        id: "rec-weakness",
        title: `Strengthen ${weakness.topic || weakness.subject}`,
        description: `Use a focused tutor session to close this gap before your next test.`,
        type: "weakness",
        color: "#A78BFA",
        metadata: {
          duration: "25m",
          sections: 1,
          course_code: weakness.course_code || weakness.subject,
        },
      });
    }

    if (nextExam) {
      recs.push({
        id: `rec-exam-${nextExam.id}`,
        title: `Prepare for ${nextExam.course_code}`,
        description:
          nextExamDays === 0
            ? "This exam is today. Open your prep plan and review the latest mock result."
            : `Your exam is ${nextExamDays} day${nextExamDays === 1 ? "" : "s"} away. Continue the plan from where you stopped.`,
        type: "exam",
        color: colors.warning,
        metadata: {
          duration: nextExamDays === null ? "Plan" : `${nextExamDays}d`,
          sections: nextExam.tasks?.length || 0,
          course_code: nextExam.course_code,
        },
      });
    }

    const latestTutorSession = sessions.find(
      (session) => session.session_type === "TUTOR" || session.type === "TUTOR"
    );

    if (latestTutorSession) {
      recs.push({
        id: `rec-session-${latestTutorSession.id}`,
        title: `Resume ${latestTutorSession.topic || latestTutorSession.course_code || "your tutor session"}`,
        description: "Continue from your latest live tutor session or review what was covered.",
        type: "material",
        color: colors.primary,
        metadata: {
          duration: latestTutorSession.duration ? `${latestTutorSession.duration}m` : "Recent",
          sections: 1,
          course_code: latestTutorSession.course_code,
        },
      });
    }

    return recs;
  }, [learningProfile, nextExam, nextExamDays, sessions]);

  const dailyTip = useMemo(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return AI_TIPS[dayOfYear % AI_TIPS.length];
  }, []);

  const showStreakBanner =
    !loading && sessionCount > 0 && !isStreakBannerDismissed;

  const getSessionTitle = (item: Session) =>
    item.title || item.topic || item.course_code || `${item.session_type || item.type || "Study"} session`;

  const getSessionTypeLabel = (item: Session) =>
    (item.session_type || item.type || "study").replace(/_/g, " ").toLowerCase();

  const openRecommendation = (item: Recommendation) => {
    if (item.id.startsWith("rec-exam-")) {
      navigation.navigate("PrepPlan", { examId: item.id.replace("rec-exam-", "") });
      return;
    }

    if (item.id.startsWith("rec-session-")) {
      navigation.navigate("SessionDetail", { id: item.id.replace("rec-session-", "") });
      return;
    }

    navigation.navigate("LiveTutorEntry", {
      courseCode: item.metadata.course_code,
      topic: item.title.replace(/^Strengthen\s+/i, ""),
    });
  };

  const renderSessionCard = ({ item, index }: { item: Session; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 80)} style={styles.sessionItem}>
      <TouchableOpacity
        activeOpacity={0.82}
        style={styles.sessionCard}
        onPress={() => navigation.navigate("SessionDetail", { id: item.id })}
      >
        <View style={styles.sessionHeader}>
          <Text style={styles.coursePill}>{item.course_code || "SESSION"}</Text>
          <Text style={styles.sessionTime}>{getTimeAgo(item.started_at || item.created_at)}</Text>
        </View>
        <Text style={styles.sessionTitle} numberOfLines={2}>
          {getSessionTitle(item)}
        </Text>
        <View style={styles.sessionFooter}>
          <Text style={styles.sessionType}>{getSessionTypeLabel(item)}</Text>
          <ChevronRight size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderRecommendationCard = (item: Recommendation, index: number) => (
    <Animated.View key={item.id} entering={FadeInUp.delay(index * 80 + 240)}>
      <TouchableOpacity
        activeOpacity={0.86}
        style={styles.recommendationCard}
        onPress={() => openRecommendation(item)}
      >
        <View style={[styles.recommendationRail, { backgroundColor: item.color }]} />
        <View style={styles.recommendationBody}>
          <View style={styles.recommendationTop}>
            <Text style={styles.recommendationTitle}>{item.title}</Text>
            <Badge
              label={item.type === "weakness" ? "AI Pick" : "Practice"}
              variant={item.type === "weakness" ? "purple" : "blue"}
            />
          </View>
          <Text style={styles.recommendationDescription}>{item.description}</Text>
          <View style={styles.recommendationMeta}>
            <View style={styles.metaItem}>
              <Timer size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>{item.metadata.duration}</Text>
            </View>
            {!!item.metadata.sections && (
              <View style={styles.metaItem}>
                <BookOpen size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>
                  {item.metadata.sections} section{item.metadata.sections === 1 ? "" : "s"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <Screen scrollable hideHeader style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.75}>
            <Avatar
              name={user?.name || "Student"}
              uri={user?.avatar_url || undefined}
              size={44}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{greeting}</Text>
            <Text style={styles.studentName} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.75}
          >
            <Bell size={22} color={colors.textPrimary} />
            {unreadNotifications > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <GraduationCap size={24} color={colors.primary} />
            </View>
            <Text style={styles.heroStatus}>MVP beta</Text>
          </View>
          <Text style={styles.heroTitle}>Your study command center</Text>
          <Text style={styles.heroSubtitle}>{heroSubtext}</Text>
          <View style={styles.heroStats}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{sessionCount}</Text>
              <Text style={styles.statLabel}>sessions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{exams.length}</Text>
              <Text style={styles.statLabel}>exam plans</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{nextExamDays ?? "-"}</Text>
              <Text style={styles.statLabel}>days left</Text>
            </View>
          </View>
        </View>

        {showStreakBanner && (
          <Animated.View entering={FadeInUp} style={styles.streakBanner}>
            <TrendingUp size={18} color={colors.warning} />
            <Text style={styles.streakText}>
              You have completed {sessionCount} learning session{sessionCount === 1 ? "" : "s"}. Keep the rhythm today.
            </Text>
            <TouchableOpacity onPress={dismissStreakBanner} style={styles.dismissButton}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.quickActionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <QuickActionTile
              key={action.id}
              action={action}
              onPress={() => navigation.navigate(action.screen)}
            />
          ))}
        </View>

        {(loading || sessions.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Continue learning</Text>
              <Clock size={17} color={colors.textMuted} />
            </View>
            {loading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    width={190}
                    height={132}
                    borderRadius={10}
                    style={styles.sessionSkeleton}
                  />
                ))}
              </ScrollView>
            ) : (
              <FlatList
                data={sessions}
                renderItem={renderSessionCard}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              />
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended next</Text>
            <Sparkles size={17} color={colors.primary} />
          </View>
          {loading ? (
            <View>
              {[1, 2].map((i) => (
                <Skeleton key={i} height={116} borderRadius={10} style={styles.recommendationSkeleton} />
              ))}
            </View>
          ) : recommendations.length === 0 ? (
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.emptyRecommendationCard}
              onPress={() => navigation.navigate("Library")}
            >
              <BookOpen size={20} color={colors.primary} />
              <View style={styles.emptyRecommendationText}>
                <Text style={styles.recommendationTitle}>Start from your library</Text>
                <Text style={styles.recommendationDescription}>
                  Open a real material to study, ask Akademi, or practice CBT questions.
                </Text>
              </View>
              <ChevronRight size={17} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            recommendations.map(renderRecommendationCard)
          )}
        </View>

        <View style={styles.tipPanel}>
          <View style={styles.tipIcon}>
            <Sparkles size={16} color={colors.primary} />
          </View>
          <Text style={styles.tipText}>{dailyTip}</Text>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 18,
  },
  avatar: {
    borderColor: colors.border,
    borderWidth: 1,
  },
  headerCopy: {
    flex: 1,
    marginLeft: 12,
  },
  eyebrow: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 0,
  },
  studentName: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: 2,
  },
  notificationButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    position: "relative",
    width: 42,
  },
  unreadDot: {
    backgroundColor: colors.error,
    borderColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    height: 8,
    position: "absolute",
    right: 10,
    top: 9,
    width: 8,
  },
  heroPanel: {
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  heroStatus: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 0,
  },
  heroTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 25,
    lineHeight: 31,
    marginBottom: 8,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  heroStats: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 18,
    paddingVertical: 12,
  },
  statBlock: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 20,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  statDivider: {
    backgroundColor: colors.border,
    height: 28,
    width: 1,
  },
  streakBanner: {
    alignItems: "center",
    backgroundColor: "#181510",
    borderColor: "rgba(245,158,11,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 14,
    padding: 12,
  },
  streakText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 10,
  },
  dismissButton: {
    padding: 4,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  actionTile: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 10,
    minHeight: 76,
    padding: 12,
    width: "48.5%",
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    marginRight: 10,
    width: 38,
  },
  actionTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  actionLabel: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 3,
  },
  actionDescription: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
  },
  horizontalList: {
    paddingRight: 18,
  },
  sessionItem: {
    marginRight: 12,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 132,
    padding: 14,
    width: 190,
  },
  sessionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  coursePill: {
    ...typography.mono,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 5,
    color: colors.primary,
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  sessionTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  sessionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  sessionFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  sessionType: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    textTransform: "capitalize",
  },
  sessionSkeleton: {
    marginRight: 12,
  },
  recommendationCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    overflow: "hidden",
  },
  recommendationRail: {
    width: 4,
  },
  recommendationBody: {
    flex: 1,
    padding: 14,
  },
  recommendationTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  recommendationTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    marginRight: 10,
  },
  recommendationDescription: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 12,
  },
  recommendationMeta: {
    alignItems: "center",
    flexDirection: "row",
  },
  metaItem: {
    alignItems: "center",
    flexDirection: "row",
    marginRight: 16,
  },
  metaText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginLeft: 5,
  },
  recommendationSkeleton: {
    marginBottom: 12,
  },
  emptyRecommendationCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 14,
  },
  emptyRecommendationText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  tipPanel: {
    alignItems: "center",
    backgroundColor: "#0D1520",
    borderColor: "rgba(56,189,248,0.16)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 13,
  },
  tipIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 7,
    height: 32,
    justifyContent: "center",
    marginRight: 10,
    width: 32,
  },
  tipText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
