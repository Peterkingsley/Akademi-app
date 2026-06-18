import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Bell,
  BookOpen,
  Bot,
  Circle,
  ChevronRight,
  Clock,
  CalendarDays,
  FileText,
  Library,
  PlayCircle,
  Sparkles,
  Swords,
  Target,
  Timer,
  TrendingUp,
  X,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Screen } from "../../components/layout/Screen";
import { Skeleton } from "../../components/ui/Skeleton";
import { notificationService } from "../../services/notificationService";
import api from "../../services/api";
import { userService, ProgressSummary } from "../../services/user";
import { competitionService, Tournament } from "../../services/competition";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { ExamPrepPlan, LearningProfile, Recommendation, Session } from "./types";

const STREAK_BANNER_HIDDEN_KEY = "streak_banner_hidden";
const HOME_TOUR_PENDING_KEY = "home_tour_pending";

const QUICK_ACTIONS = [
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
  {
    id: "compete",
    label: "Compete",
    description: "Live battles",
    icon: Swords,
    tint: "#F59E0B",
    screen: "CompetitionHub",
  },
];

const HOME_TOUR_STEPS = [
  {
    id: "solve",
    title: "Solve assignments",
    body: "Use this when you want Akademi to solve a typed question or a photo from your assignment.",
  },
  {
    id: "library",
    title: "Study from your library",
    body: "Open verified materials, ask Akademi questions, summarize passages, and practice CBT from real course content.",
  },
  {
    id: "tutor",
    title: "Meet the live tutor",
    body: "Start a guided tutor session when you want a deeper explanation or one-on-one help on a topic.",
  },
  {
    id: "exam",
    title: "Prepare for exams",
    body: "Create exam plans, take mock exams, review weak areas, and continue from your latest result.",
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

const formatDeadlineTag = (value?: string) => {
  if (!value) return "SOON";
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

type QuickAction = (typeof QUICK_ACTIONS)[number];

const getDaysLeft = (dateString?: string) => {
  if (!dateString) return null;
  return Math.max(
    0,
    Math.ceil((new Date(dateString).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
};

const QuickActionTile = ({
  action,
  onPress,
  isTourTarget = false,
}: {
  action: QuickAction;
  onPress: () => void;
  isTourTarget?: boolean;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const Icon = action.icon;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[styles.actionTile, isTourTarget && styles.actionTileTourTarget]}
    >
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const bannerWidth = Dimensions.get("window").width - 36;
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 420;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [exams, setExams] = useState<ExamPrepPlan[]>([]);
  const [campaigns, setCampaigns] = useState<Tournament[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isStreakBannerDismissed, setIsStreakBannerDismissed] = useState(false);
  const [isTourVisible, setIsTourVisible] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(0);
  const campaignScrollRef = React.useRef<ScrollView | null>(null);

  useEffect(() => {
    fetchData();
    checkStreakBanner();
    checkHomeTour();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const refreshNotifications = async () => {
        try {
          const notifications = await notificationService.list();
          setUnreadNotifications(notifications.filter((item) => !item.read).length);
        } catch (error) {
          console.error("Failed to refresh notifications:", error);
        }
      };

      refreshNotifications();
    }, [])
  );

  useEffect(() => {
    if (campaigns.length <= 1) return;

    const interval = setInterval(() => {
      setActiveCampaignIndex((current) => {
        const nextIndex = (current + 1) % campaigns.length;
        campaignScrollRef.current?.scrollTo({
          x: nextIndex * bannerWidth,
          animated: true,
        });
        return nextIndex;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [bannerWidth, campaigns.length]);

  const fetchData = async () => {
    try {
      const [sessionsRes, profileRes, progressRes, examsRes, notificationsRes, tournamentsRes] = await Promise.all([
        api.get("/users/me/sessions?limit=4"),
        api.get("/users/me/learning-profile"),
        userService.getProgress(),
        api.get("/exam-prep"),
        notificationService.list(),
        competitionService.getTournaments().catch(() => []),
      ]);

      setSessions(sessionsRes.data || []);
      setLearningProfile(profileRes.data || { session_count: 0, subject_weaknesses: [] });
      setProgress(progressRes);
      setExams(examsRes.data || []);
      setUnreadNotifications(notificationsRes.filter((item) => !item.read).length);
      const liveCampaigns = (tournamentsRes || []).filter(
        (item) => item.status === "PUBLISHED" || item.status === "LIVE"
      );
      setCampaigns(liveCampaigns);
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

  const checkHomeTour = async () => {
    const pending = await AsyncStorage.getItem(HOME_TOUR_PENDING_KEY);
    if (pending === "true") {
      setTourStepIndex(0);
      setIsTourVisible(true);
    }
  };

  const finishHomeTour = async () => {
    setIsTourVisible(false);
    await AsyncStorage.removeItem(HOME_TOUR_PENDING_KEY);
  };

  const goToNextTourStep = async () => {
    if (tourStepIndex >= HOME_TOUR_STEPS.length - 1) {
      await finishHomeTour();
      return;
    }

    setTourStepIndex((current) => current + 1);
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = user?.name?.split(" ")[0] || "Student";
  const avatarUrl = user?.avatar_url || user?.profile_photo_url || undefined;
  const nextExam = exams[0];
  const nextExamDays = getDaysLeft(nextExam?.exam_date);
  const sessionCount = progress?.summary.sessions ?? sessions.length;

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
  const activeTourStep = HOME_TOUR_STEPS[tourStepIndex];

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

  const formatCampaignTime = (value: string) =>
    new Date(value).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  const getAudienceLabel = (campaign: Tournament) => {
    if (campaign.audience_scope === "UNIVERSITY") return campaign.audience_university || "University event";
    if (campaign.audience_scope === "FACULTY") return `${campaign.audience_faculty || "Faculty"} only`;
    if (campaign.audience_scope === "DEPARTMENT") return `${campaign.audience_department || "Department"} only`;
    return "Open to all students";
  };

  const upcomingEvents = useMemo(() => exams.slice(0, 3), [exams]);

  const getContinueAccent = (session: Session, index: number) => {
    const type = session.session_type || session.type || "";
    if (type.includes("TUTOR")) return { color: "#A855F7", icon: PlayCircle };
    if (type.includes("ASSIGNMENT") || type.includes("CHALLENGE")) return { color: colors.primary, icon: FileText };
    return { color: ["#22C55E", "#3B82F6", "#A855F7"][index % 3], icon: FileText };
  };

  const getUpcomingAccent = (index: number) => {
    return ["#F59E0B", "#22C55E", "#3B82F6"][index % 3];
  };

  return (
    <Screen scrollable hideHeader style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.75}>
            <Avatar
              name={user?.name || "Student"}
              uri={avatarUrl}
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

        {campaigns.length > 0 && (
          <View style={styles.campaignSection}>
            <ScrollView
              ref={campaignScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={bannerWidth}
              decelerationRate="fast"
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / bannerWidth);
                setActiveCampaignIndex(nextIndex);
              }}
            >
              {campaigns.map((campaign) => (
                <TouchableOpacity
                  key={campaign.id}
                  activeOpacity={0.92}
                  style={[styles.campaignCard, { width: bannerWidth }]}
                  onPress={() => navigation.navigate("TournamentDetail", { tournamentId: campaign.id })}
                >
                  <ImageBackground
                    source={campaign.campaign_banner_url ? { uri: campaign.campaign_banner_url } : undefined}
                    resizeMode="cover"
                    style={styles.campaignBackground}
                    imageStyle={styles.campaignBackgroundImage}
                  >
                    <View style={styles.campaignOverlay} />
                    <View style={styles.campaignBody}>
                      <View style={styles.campaignHeaderRow}>
                        <Badge
                          label={campaign.campaign_preheader || "Live campaign"}
                          variant={campaign.status === "LIVE" ? "warning" : "success"}
                        />
                        <Text style={styles.campaignAudience}>{getAudienceLabel(campaign)}</Text>
                      </View>

                      <View style={styles.campaignCopy}>
                        <Text style={styles.campaignTitle} numberOfLines={2}>
                          {campaign.title}
                        </Text>
                        <Text style={styles.campaignSubtitle} numberOfLines={2}>
                          {campaign.description || campaign.prize_summary || "Join the live challenge and compete with other students."}
                        </Text>
                      </View>

                      <View style={styles.campaignMetaRow}>
                        <View style={styles.campaignMetaItem}>
                          <CalendarDays size={14} color="#D4D4D8" />
                          <Text style={styles.campaignMetaText}>{formatCampaignTime(campaign.scheduled_at)}</Text>
                        </View>
                        <View style={styles.campaignMetaItem}>
                          <Swords size={14} color="#D4D4D8" />
                          <Text style={styles.campaignMetaText}>{campaign.entry_count} joined</Text>
                        </View>
                      </View>

                      <View style={styles.campaignCtaWrap}>
                        <View style={styles.campaignCta}>
                          <Text style={styles.campaignCtaText}>
                            {campaign.campaign_cta_label || "Open event"}
                          </Text>
                          <ChevronRight size={16} color={colors.background} />
                        </View>
                      </View>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {campaigns.length > 1 && (
              <View style={styles.campaignDots}>
                {campaigns.map((campaign, index) => (
                  <View
                    key={campaign.id}
                    style={[
                      styles.campaignDot,
                      index === activeCampaignIndex && styles.campaignDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

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
              isTourTarget={isTourVisible && activeTourStep?.id === action.id}
              onPress={() => navigation.navigate(action.screen)}
            />
          ))}
        </View>

        <View style={[styles.dualPanels, isCompactLayout && styles.dualPanelsCompact]}>
          <View style={[styles.dualPanelCard, styles.dualPanelLeft, isCompactLayout && styles.dualPanelFullWidth]}>
            <View style={styles.dualPanelHeader}>
              <Text style={styles.dualPanelTitle}>Continue Learning</Text>
              <TouchableOpacity activeOpacity={0.82} onPress={() => navigation.navigate("Sessions")}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={62} borderRadius={10} style={styles.dualPanelSkeleton} />
                ))}
              </>
            ) : sessions.length === 0 ? (
              <Text style={styles.dualPanelEmpty}>Your recent study sessions will show here.</Text>
            ) : (
              sessions.slice(0, 3).map((item, index) => {
                const accent = getContinueAccent(item, index);
                const AccentIcon = accent.icon;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.86}
                    style={styles.continueRow}
                    onPress={() => navigation.navigate("SessionDetail", { id: item.id })}
                  >
                    <View style={[styles.continueIconWrap, { backgroundColor: `${accent.color}22` }]}>
                      <AccentIcon size={20} color={accent.color} />
                    </View>
                    <View style={styles.continueRowText}>
                      <Text style={styles.continueRowCourse}>{item.course_code || "SESSION"}</Text>
                      <Text style={styles.continueRowTitle} numberOfLines={1}>
                        {getSessionTitle(item)}
                      </Text>
                      <Text style={styles.continueRowTime}>{getTimeAgo(item.started_at || item.created_at)}</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.resumeButton}
                      onPress={() => navigation.navigate("SessionDetail", { id: item.id })}
                    >
                      <Text style={styles.resumeButtonText}>Resume</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={[styles.dualPanelCard, styles.dualPanelRight, isCompactLayout && styles.dualPanelFullWidth]}>
            <View style={styles.dualPanelHeader}>
              <Text style={styles.dualPanelTitle}>Upcoming</Text>
              <TouchableOpacity activeOpacity={0.82} onPress={() => navigation.navigate("ExamPrep")}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={62} borderRadius={10} style={styles.dualPanelSkeleton} />
                ))}
              </>
            ) : upcomingEvents.length === 0 ? (
              <Text style={styles.dualPanelEmpty}>Your upcoming exams and deadlines will show here.</Text>
            ) : (
              upcomingEvents.map((item, index) => {
                const accent = getUpcomingAccent(index);
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.86}
                    style={styles.upcomingRow}
                    onPress={() => navigation.navigate("PrepPlan", { examId: item.id })}
                  >
                    <View style={styles.timelineColumn}>
                      <Circle size={10} color={accent} fill={accent} />
                      {index < upcomingEvents.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.upcomingCopy}>
                      <Text style={[styles.upcomingDay, { color: accent }]}>
                        {formatDeadlineTag(item.exam_date)}
                      </Text>
                      <Text style={styles.upcomingTitle} numberOfLines={1}>
                        {item.course_code} Exam
                      </Text>
                    </View>
                    <View style={[styles.upcomingIconWrap, { backgroundColor: `${accent}22` }]}>
                      <CalendarDays size={18} color={accent} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

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

      <Modal transparent visible={isTourVisible} animationType="fade" onRequestClose={finishHomeTour}>
        <View style={styles.tourOverlay} pointerEvents="box-none">
          <View style={styles.tourScrim} />
          <View style={styles.tourCard}>
            <View style={styles.tourTopRow}>
              <Text style={styles.tourStep}>
                {tourStepIndex + 1} of {HOME_TOUR_STEPS.length}
              </Text>
              <TouchableOpacity onPress={finishHomeTour} style={styles.tourSkipButton}>
                <Text style={styles.tourSkipText}>Skip</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.tourTitle}>{activeTourStep.title}</Text>
            <Text style={styles.tourBody}>{activeTourStep.body}</Text>
            <View style={styles.tourDots}>
              {HOME_TOUR_STEPS.map((step, index) => (
                <View
                  key={step.id}
                  style={[styles.tourDot, index === tourStepIndex && styles.tourDotActive]}
                />
              ))}
            </View>
            <TouchableOpacity style={styles.tourNextButton} onPress={goToNextTourStep}>
              <Text style={styles.tourNextText}>
                {tourStepIndex === HOME_TOUR_STEPS.length - 1 ? "Finish tour" : "Next"}
              </Text>
              <ChevronRight size={18} color={colors.background} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
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
  campaignSection: {
    marginBottom: 14,
  },
  campaignCard: {
    borderRadius: 12,
    marginRight: 12,
    overflow: "hidden",
  },
  campaignBackground: {
    backgroundColor: "#0E1711",
    height: 198,
    justifyContent: "flex-end",
  },
  campaignBackgroundImage: {
    borderRadius: 12,
  },
  campaignOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,8,6,0.52)",
  },
  campaignBody: {
    flex: 1,
    justifyContent: "space-between",
    padding: 14,
  },
  campaignHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  campaignAudience: {
    ...typography.caption,
    color: "#D4D4D8",
    fontSize: 11,
    marginLeft: 12,
    marginTop: 4,
    textAlign: "right",
  },
  campaignCopy: {
    marginTop: 10,
  },
  campaignTitle: {
    ...typography.h1,
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 27,
    marginBottom: 6,
  },
  campaignSubtitle: {
    ...typography.body,
    color: "#E4E4E7",
    fontSize: 12,
    lineHeight: 18,
    maxWidth: "82%",
  },
  campaignMetaRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  campaignMetaItem: {
    alignItems: "center",
    flexDirection: "row",
    marginRight: 14,
  },
  campaignMetaText: {
    ...typography.caption,
    color: "#D4D4D8",
    fontSize: 11,
    marginLeft: 5,
  },
  campaignCtaWrap: {
    alignItems: "flex-start",
  },
  campaignCta: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  campaignCtaText: {
    ...typography.h4,
    color: colors.background,
    marginRight: 6,
  },
  campaignDots: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  campaignDot: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    height: 7,
    marginHorizontal: 4,
    width: 7,
  },
  campaignDotActive: {
    backgroundColor: colors.primary,
    width: 22,
  },
  streakBanner: {
    alignItems: "center",
    backgroundColor: colors.surface,
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
  actionTileTourTarget: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surface,
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
  dualPanels: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  dualPanelsCompact: {
    flexDirection: "column",
  },
  dualPanelCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  dualPanelLeft: {
    flex: 1.08,
  },
  dualPanelRight: {
    flex: 0.92,
  },
  dualPanelFullWidth: {
    flex: 0,
    width: "100%",
  },
  dualPanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dualPanelTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 16,
  },
  seeAll: {
    ...typography.h4,
    color: colors.primary,
    fontSize: 12,
  },
  dualPanelSkeleton: {
    marginBottom: 10,
  },
  dualPanelEmpty: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  continueRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  continueIconWrap: {
    alignItems: "center",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    marginRight: 10,
    width: 42,
  },
  continueRowText: {
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  continueRowCourse: {
    ...typography.caption,
    alignSelf: "flex-start",
    backgroundColor: "rgba(34,197,94,0.14)",
    borderRadius: 8,
    color: colors.primary,
    fontSize: 10,
    marginBottom: 4,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  continueRowTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 2,
  },
  continueRowTime: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 11,
  },
  resumeButton: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.16)",
    borderRadius: 10,
    justifyContent: "center",
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resumeButtonText: {
    ...typography.h4,
    color: colors.primary,
    fontSize: 12,
  },
  upcomingRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  timelineColumn: {
    alignItems: "center",
    marginRight: 10,
    width: 12,
  },
  timelineLine: {
    backgroundColor: colors.border,
    flex: 1,
    marginTop: 4,
    width: 1,
  },
  upcomingCopy: {
    flex: 1,
    marginRight: 10,
  },
  upcomingDay: {
    ...typography.h4,
    fontSize: 12,
    marginBottom: 4,
  },
  upcomingTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  upcomingIconWrap: {
    alignItems: "center",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
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
    backgroundColor: colors.surface,
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
  tourOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  tourScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  tourCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 30,
  },
  tourTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  tourStep: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 0,
  },
  tourSkipButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tourSkipText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  tourTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 8,
  },
  tourBody: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  tourDots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    marginBottom: 18,
  },
  tourDot: {
    backgroundColor: colors.border,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  tourDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  tourNextButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 52,
  },
  tourNextText: {
    ...typography.h4,
    color: colors.background,
    marginRight: 6,
  },
});
