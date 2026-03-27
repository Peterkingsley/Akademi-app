import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const WEEK_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEK_STATUS = [true, true, true, true, "today", false, false] as const;

const BAR_DATA = [
  { day: "M", value: 0.75 },
  { day: "T", value: 1.0 },
  { day: "W", value: 0.55 },
  { day: "T", value: 0.65 },
  { day: "F", value: 0.35 },
  { day: "S", value: 0.1 },
  { day: "S", value: 0.05 },
];

// 30-day consistency grid (5 rows x 6 cols = 30 cells)
const CONSISTENCY_GRID = Array.from({ length: 30 }, (_, i) => {
  if (i < 7) return 0.9;
  if (i < 14) return 0.4;
  if (i < 18) return 0.7;
  if (i < 22) return 0.2;
  return 0.6;
});

const COURSES: CoursePerformance[] = [
  {
    id: "1",
    code: "EEE 301",
    name: "Circuit Analysis II",
    solved: 12,
    sessions: 4,
    mocks: 1,
    strongest: "Faraday's Law",
    needsWork: "Maxwell's Equations",
  },
  {
    id: "2",
    code: "MAT 202",
    name: "Advanced Calculus",
    solved: 45,
    sessions: 12,
    mocks: 3,
    strongest: "Integration",
    needsWork: "Series Convergence",
  },
];

const SOLVER_BADGES: Badge[] = [
  { id: "1", emoji: "🎯", title: "Problem Pro", description: "Solved 10 assignments", unlocked: true },
  { id: "2", emoji: "⚡", title: "Quick Thinker", description: "Finish quiz in <1 min", unlocked: true },
  { id: "3", emoji: "🧩", title: "Logic Master", description: "50 Perfect Scores", unlocked: false },
  { id: "4", emoji: "🏆", title: "Tournament King", description: "Win a weekly contest", unlocked: false },
];

const SCHOLAR_BADGES: Badge[] = [
  { id: "5", emoji: "📖", title: "Bookworm", description: "Read 20 chapters", unlocked: true },
  { id: "6", emoji: "🦉", title: "Night Owl", description: "Study after midnight", unlocked: false },
];

const ACHIEVEMENTS = [
  { id: "1", emoji: "✨", label: "Fast Learner", color: "#6366F1" },
  { id: "2", emoji: "🏅", label: "Top Streak", color: "#D97706" },
  { id: "3", emoji: "🎓", label: "Finalist", color: colors.surface },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StreakCard: React.FC = () => (
  <View style={styles.streakCard}>
    <Text style={styles.streakTitle}>🔥 7-day streak!</Text>
    <Text style={styles.streakSubtext}>
      You've studied every day this week. Don't break the chain.
    </Text>
    <View style={styles.weekRow}>
      {WEEK_DAYS.map((day, i) => {
        const status = WEEK_STATUS[i];
        const isDone = status === true;
        const isToday = status === "today";
        return (
          <View key={day} style={styles.dayCol}>
            <View
              style={[
                styles.dayCircle,
                isDone && styles.dayCircleDone,
                isToday && styles.dayCircleToday,
              ]}
            >
              {isDone && <Text style={styles.checkMark}>✓</Text>}
              {isToday && <View style={styles.todayDot} />}
            </View>
            <Text style={[styles.dayLabel, isToday && styles.dayLabelActive]}>
              {day}
            </Text>
          </View>
        );
      })}
    </View>
  </View>
);

const WeeklyActivityCard: React.FC = () => (
  <View style={styles.sectionCard}>
    <View style={styles.activityHeader}>
      <View>
        <Text style={styles.sectionTitle}>Weekly Activity</Text>
        <Text style={styles.activitySubtext}>This week's average: 32 mins/day</Text>
      </View>
      <View style={styles.minsBadge}>
        <View style={styles.minsDot} />
        <Text style={styles.minsText}>MINS</Text>
      </View>
    </View>
    <View style={styles.barChart}>
      {BAR_DATA.map((item, i) => (
        <View key={i} style={styles.barCol}>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.bar,
                {
                  height: `${item.value * 100}%`,
                  backgroundColor: item.value >= 0.6 ? colors.primary : colors.primary + "55",
                },
              ]}
            />
          </View>
          <Text style={styles.barLabel}>{item.day}</Text>
        </View>
      ))}
    </View>
  </View>
);

const CourseCard: React.FC<{ course: CoursePerformance }> = ({ course }) => {
  const [expanded, setExpanded] = useState(course.id === "1");
  return (
    <View style={styles.courseCard}>
      <TouchableOpacity
        style={styles.courseHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.courseTitle}>
            {course.code} – {course.name}
          </Text>
          <Text style={styles.courseMeta}>
            Solved: {course.solved} questions | Sessions: {course.sessions} | Mocks:{" "}
            {course.mocks}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={20} color={colors.textMuted} />
        ) : (
          <ChevronDown size={20} color={colors.textMuted} />
        )}
      </TouchableOpacity>
      {expanded && (
        <View style={styles.courseExpanded}>
          <View style={styles.performancePill}>
            <ShieldCheck size={16} color="#22C55E" />
            <View style={styles.performanceTexts}>
              <Text style={styles.performanceLabel}>STRONGEST</Text>
              <Text style={styles.performanceValue}>{course.strongest}</Text>
            </View>
          </View>
          <View style={styles.performancePill}>
            <AlertTriangle size={16} color="#F59E0B" />
            <View style={styles.performanceTexts}>
              <Text style={styles.performanceLabel}>NEEDS WORK</Text>
              <Text style={styles.performanceValue}>{course.needsWork}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const BadgeCard: React.FC<{ badge: Badge }> = ({ badge }) => (
  <View style={[styles.badgeCard, !badge.unlocked && styles.badgeCardLocked]}>
    {!badge.unlocked && (
      <View style={styles.lockOverlay}>
        <Lock size={14} color={colors.textMuted} />
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

const StreakDetailCard: React.FC = () => (
  <View style={styles.streakDetailCard}>
    <Text style={styles.streakDetailBig}>🔥 7 days</Text>
    <View style={styles.bestBadge}>
      <Text style={styles.bestBadgeText}>BEST: 14 DAYS</Text>
    </View>
    <View style={styles.consistencyHeader}>
      <View>
        <Text style={styles.consistencyLabel}>STUDY CONSISTENCY</Text>
        <Text style={styles.consistencyLabel}>(LAST 30 DAYS)</Text>
      </View>
      <View>
        <Text style={styles.consistencyAvgLabel}>Avg:</Text>
        <Text style={styles.consistencyAvg}>42m/day</Text>
      </View>
    </View>
    <View style={styles.consistencyGrid}>
      {CONSISTENCY_GRID.map((val, i) => (
        <View
          key={i}
          style={[
            styles.consistencyCell,
            { backgroundColor: `rgba(99,102,241,${val})` },
          ]}
        />
      ))}
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const ProgressScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [showDetail, setShowDetail] = useState(false);

  return (
    <Screen hideHeader style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar name="User" size={36} style={styles.avatar} />
            <Text style={styles.headerBrand}>Akademi</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <Settings size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Page Title */}
        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>Progress</Text>
          <Text style={styles.pageSubtitle}>March 2026 · Week 3 of 14</Text>
        </View>

        {/* Streak Card */}
        <StreakCard />

        {/* Weekly Activity */}
        <WeeklyActivityCard />

        {/* Course Performance */}
        <Text style={styles.sectionHeading}>Course Performance</Text>
        {COURSES.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}

        {/* Achievements */}
        <View style={styles.achievementsHeader}>
          <Text style={styles.sectionHeading}>Achievements</Text>
          <TouchableOpacity onPress={() => setShowDetail(!showDetail)}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.achievementsRow}>
          {ACHIEVEMENTS.map((a) => (
            <View key={a.id} style={styles.achievementItem}>
              <View
                style={[
                  styles.achievementCircle,
                  { borderColor: a.color, backgroundColor: a.color + "22" },
                ]}
              >
                <Text style={styles.achievementEmoji}>{a.emoji}</Text>
              </View>
              <Text style={styles.achievementLabel}>{a.label}</Text>
            </View>
          ))}
        </View>

        {/* Detail View (See All) */}
        {showDetail && (
          <>
            <StreakDetailCard />

            {/* Solver Badges */}
            <View style={styles.badgeSectionHeader}>
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

  // Achievements
  achievementsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: colors.primary,
  },
  achievementsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  achievementItem: {
    alignItems: "center",
    gap: 8,
  },
  achievementCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  achievementEmoji: {
    fontSize: 24,
  },
  achievementLabel: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: colors.textSecondary,
    textAlign: "center",
  },

  // Streak Detail Card
  streakDetailCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  streakDetailBig: {
    fontSize: 36,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
    marginBottom: 10,
  },
  bestBadge: {
    backgroundColor: colors.surfaceElevated,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 20,
  },
  bestBadgeText: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.textSecondary,
  },
  consistencyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  consistencyLabel: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
  },
  consistencyAvgLabel: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
    textAlign: "right",
  },
  consistencyAvg: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
    textAlign: "right",
  },
  consistencyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  consistencyCell: {
    width: 18,
    height: 18,
    borderRadius: 3,
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