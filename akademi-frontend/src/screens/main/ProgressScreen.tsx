import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import {
  Settings,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Lock,
} from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/ui/Avatar";
import { useNavigation } from "@react-navigation/native";
import { userService, UserProfile } from "../../services/user";
import { useAuthStore } from "../../store/useAuthStore";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoursePerformance {
  id: string;
  code: string;
  name: string;
  solved: number;
  sessions: number;
  mocks: number;
  strongest: string;
  needsWork: string;
}

interface Badge {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const SOLVER_BADGES: Badge[] = [
  { id: "1", emoji: "🎯", title: "Problem Pro", description: "Solved 10 assignments", unlocked: true },
  { id: "2", emoji: "⚡", title: "Quick Thinker", description: "Finish quiz in <1 min", unlocked: true },
  { id: "3", emoji: "🧩", title: "Logic Master", description: "50 Perfect Scores", unlocked: false },
  { id: "4", emoji: "🏆", title: "Tournament King", description: "Win a weekly contest", unlocked: false },
];

const SCHOLAR_BADGES: Badge[] = [
  { id: "5", emoji: "📖", title: "Bookworm", description: "Read 20 chapters", unlocked: true },
  { id: "6", emoji: "✍️", title: "Note Taker", description: "Created 15 study sets", unlocked: false },
  { id: "7", emoji: "🧠", title: "Scholar", description: "Maintain 7-day streak", unlocked: false },
  { id: "8", emoji: "🌟", title: "Top 1%", description: "Rank high in department", unlocked: false },
];

export const ProgressScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user: authUser } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userProfile, userSessions] = await Promise.all([
        userService.getProfile(),
        userService.getSessions(),
      ]);
      setProfile(userProfile);
      setSessions(userSessions);
    } catch (error) {
      console.error("Failed to fetch progress data", error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Logic ───────────────────────────────────────────────────────────────────

  const getStreakData = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStatus: (boolean | "today")[] = [false, false, false, false, false, false, false];

    // Get days of current week (Mon-Sun)
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);

      const hasSession = sessions.some(s => {
        const sDate = new Date(s.createdAt);
        return sDate.toDateString() === dayDate.toDateString();
      });

      if (dayDate.toDateString() === today.toDateString()) {
        weekStatus[i] = hasSession ? true : "today";
      } else {
        weekStatus[i] = hasSession;
      }
    }

    return weekStatus;
  };

  const getBarData = () => {
    const today = new Date();
    const bars = [];
    const labels = ["M", "T", "W", "T", "F", "S", "S"];

    const currentDay = today.getDay();
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);

      const daySessions = sessions.filter(s => {
        const sDate = new Date(s.createdAt);
        return sDate.toDateString() === dayDate.toDateString();
      });

      // Mock value based on session count for visualization
      const value = Math.min(daySessions.length / 5, 1.0);
      bars.push({ day: labels[i], value });
    }
    return bars;
  };

  const getCoursePerformance = (): CoursePerformance[] => {
    // Group sessions by course code
    const grouped = sessions.reduce((acc: any, s) => {
      if (!acc[s.courseCode]) acc[s.courseCode] = { solved: 0, sessions: 0, mocks: 0 };
      acc[s.courseCode].sessions++;
      return acc;
    }, {});

    return Object.keys(grouped).map(code => ({
      id: code,
      code,
      name: "Course Overview",
      solved: grouped[code].solved,
      sessions: grouped[code].sessions,
      mocks: grouped[code].mocks,
      strongest: "General Concepts",
      needsWork: "Advanced Application",
    }));
  };

  const calculateStreak = () => {
    if (sessions.length === 0) return 0;

    const sorted = [...sessions].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    let streak = 0;
    let lastDate = new Date();
    lastDate.setHours(0,0,0,0);

    // If no session today, check if there was one yesterday
    const todaySession = sorted.find(s => new Date(s.createdAt).toDateString() === lastDate.toDateString());

    if (!todaySession) {
        lastDate.setDate(lastDate.getDate() - 1);
        const yesterdaySession = sorted.find(s => new Date(s.createdAt).toDateString() === lastDate.toDateString());
        if (!yesterdaySession) return 0;
    }

    const uniqueDates = Array.from(new Set(sorted.map(s => new Date(s.createdAt).toDateString())));

    let checkDate = new Date(lastDate);
    for (const dateStr of uniqueDates) {
        if (dateStr === checkDate.toDateString()) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
  };

  const weekStatus = getStreakData();
  const barData = getBarData();
  const courses = getCoursePerformance();
  const currentStreak = calculateStreak();

  // ─── Components ───────────────────────────────────────────────────────────────

  const BadgeCard = ({ badge }: { badge: Badge }) => (
    <View style={[styles.badgeCard, !badge.unlocked && styles.badgeCardLocked]}>
      {!badge.unlocked && (
        <View style={styles.lockOverlay}>
          <Lock size={12} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
      <Text style={[styles.badgeTitle, !badge.unlocked && styles.badgeTitleLocked]}>
        {badge.title}
      </Text>
      <Text style={[styles.badgeDesc, !badge.unlocked && styles.badgeDescLocked]}>
        {badge.description}
      </Text>
    </View>
  );

  return (
    <Screen style={styles.scroll}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar
              size={36}
              source={profile?.avatar_url ? { uri: profile.avatar_url } : undefined}
              style={styles.avatar}
            />
            <Text style={styles.headerBrand}>Akademi</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("AppearanceSettings")}>
            <Settings size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={[styles.center, { marginTop: 100 }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Page Title */}
            <View style={styles.pageTitleRow}>
              <Text style={styles.pageTitle}>Progress</Text>
              <Text style={styles.pageSubtitle}>
                {profile?.university?.toUpperCase() || "ACADEMIC OVERVIEW"}
              </Text>
            </View>

            {/* Streak Card */}
            <View style={styles.streakCard}>
              <Text style={styles.streakTitle}>{currentStreak} Day Streak!</Text>
              <Text style={styles.streakSubtext}>
                {currentStreak > 0
                  ? "Great job! You have an active streak. Keep it going!"
                  : "You don't have an active streak. Study today to start it up!"}
              </Text>
              <View style={styles.weekRow}>
                {WEEK_DAYS.map((day, idx) => (
                  <View key={day} style={styles.dayCol}>
                    <View
                      style={[
                        styles.dayCircle,
                        weekStatus[idx] === true && styles.dayCircleDone,
                        weekStatus[idx] === "today" && styles.dayCircleToday,
                      ]}
                    >
                      {weekStatus[idx] === true ? (
                        <Text style={styles.checkMark}>✓</Text>
                      ) : weekStatus[idx] === "today" ? (
                        <View style={styles.todayDot} />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.dayLabel,
                        weekStatus[idx] && styles.dayLabelActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Weekly Activity */}
            <View style={styles.sectionCard}>
              <View style={styles.activityHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Weekly Activity</Text>
                  <Text style={styles.activitySubtext}>Based on your sessions</Text>
                </View>
                <View style={styles.minsBadge}>
                  <View style={styles.minsDot} />
                  <Text style={styles.minsText}>{sessions.length} SESSIONS</Text>
                </View>
              </View>

              <View style={styles.barChart}>
                {barData.map((d, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={[styles.barTrack, { backgroundColor: colors.surfaceElevated }]}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${d.value * 100}%`,
                            backgroundColor: colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{d.day}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Course Breakdown */}
            <Text style={styles.sectionHeading}>Course Breakdown</Text>
            {courses.length > 0 ? (
                courses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={styles.courseCard}
                      onPress={() =>
                        setExpandedCourse(expandedCourse === course.id ? null : course.id)
                      }
                      activeOpacity={0.9}
                    >
                      <View style={styles.courseHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.courseTitle}>{course.code}</Text>
                          <Text style={styles.courseMeta}>
                            {course.sessions} sessions • {course.solved} problems solved
                          </Text>
                        </View>
                        {expandedCourse === course.id ? (
                          <ChevronUp size={20} color={colors.textMuted} />
                        ) : (
                          <ChevronDown size={20} color={colors.textMuted} />
                        )}
                      </View>

                      {expandedCourse === course.id && (
                        <View style={styles.courseExpanded}>
                          <View style={styles.performancePill}>
                            <ShieldCheck size={16} color={colors.success} />
                            <View style={styles.performanceTexts}>
                              <Text style={styles.performanceLabel}>STRONGEST AREA</Text>
                              <Text style={styles.performanceValue}>{course.strongest}</Text>
                            </View>
                          </View>
                          <View style={styles.performancePill}>
                            <AlertTriangle size={16} color={colors.warning} />
                            <View style={styles.performanceTexts}>
                              <Text style={styles.performanceLabel}>NEEDS WORK</Text>
                              <Text style={styles.performanceValue}>{course.needsWork}</Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
            ) : (
                <View style={[styles.courseCard, { alignItems: "center", paddingVertical: 32 }]}>
                    <Text style={styles.courseMeta}>No course data available yet.</Text>
                </View>
            )}

            {/* Solver Badges */}
            <View style={[styles.badgeSectionHeader, { marginTop: 24 }]}>
              <Text style={styles.badgeSectionIcon}>🎯</Text>
              <Text style={styles.badgeSectionTitle}>Solver Badges</Text>
            </View>
            <View style={styles.badgeGrid}>
              {SOLVER_BADGES.map((b) => (
                <BadgeCard key={b.id} badge={b} />
              ))}
            </View>

            {/* Scholar Badges */}
            <View style={styles.badgeSectionHeader}>
              <Text style={styles.badgeSectionIcon}>📖</Text>
              <Text style={styles.badgeSectionTitle}>Scholar Badges</Text>
            </View>
            <View style={styles.badgeGrid}>
              {SCHOLAR_BADGES.map((b) => (
                <BadgeCard key={b.id} badge={b} />
              ))}
            </View>

            {/* AI Insight */}
            <View style={styles.insightCard}>
              <View style={styles.insightLeft}>
                <Sparkles size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightLabel}>AI Insight</Text>
                <Text style={styles.insightText}>
                  "Students with a 7-day streak are 84% more likely to pass
                  their final exams. Keep the momentum!"
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerBrand: {
    ...typography.h3,
    color: colors.primary,
  },
  iconBtn: {
    padding: 6,
  },

  // Page title
  pageTitleRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 32,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
    color: "#D97706",
  },

  // Streak Card
  streakCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  streakTitle: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: "#D97706",
    marginBottom: 6,
  },
  streakSubtext: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 18,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCol: {
    alignItems: "center",
    gap: 6,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  dayCircleDone: {
    backgroundColor: "#D97706",
    borderColor: "#D97706",
  },
  dayCircleToday: {
    borderColor: "#D97706",
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  checkMark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  todayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D97706",
  },
  dayLabel: {
    fontSize: 8,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
  },
  dayLabelActive: {
    color: "#D97706",
  },

  // Weekly Activity
  sectionCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  activitySubtext: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
  },
  minsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  minsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  minsText: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.textPrimary,
  },
  barChart: {
    flexDirection: "row",
    height: 100,
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  barTrack: {
    width: 28,
    height: 80,
    justifyContent: "flex-end",
    borderRadius: 6,
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
  },

  // Section Heading
  sectionHeading: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  // Course Cards
  courseCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  courseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  courseTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  courseMeta: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
    lineHeight: 16,
  },
  courseExpanded: {
    marginTop: 14,
    gap: 8,
  },
  performancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 12,
  },
  performanceTexts: {
    flex: 1,
  },
  performanceLabel: {
    fontSize: 8,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
    marginBottom: 2,
  },
  performanceValue: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },

  // Badge Section
  badgeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  badgeSectionIcon: {
    fontSize: 18,
  },
  badgeSectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 28,
  },
  badgeCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  badgeCardLocked: {
    opacity: 0.5,
  },
  lockOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  badgeEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  badgeTitle: {
    fontSize: 13,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
    textAlign: "center",
  },
  badgeTitleLocked: {
    color: colors.textMuted,
  },
  badgeDesc: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
  },
  badgeDescLocked: {
    color: colors.textMuted,
  },

  // AI Insight
  insightCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: 20,
  },
  insightLeft: {
    paddingTop: 2,
  },
  insightLabel: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  insightText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
