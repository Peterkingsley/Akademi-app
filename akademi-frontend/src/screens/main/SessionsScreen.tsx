import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Camera,
  MessageSquare,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Search,
  Bookmark,
  Sparkles,
} from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";

type FilterTab = "All" | "Assignments" | "Tutor" | "Study Mode";

interface Session {
  id: string;
  course: string;
  type: "SOLVE ASSIGNMENT" | "TUTOR" | "STUDY";
  title: string;
  date: string;
  duration: string;
  bookmarked?: boolean;
}

const MOCK_SESSIONS: Session[] = [
  {
    id: "1",
    course: "EEE 301",
    type: "SOLVE ASSIGNMENT",
    title: "Calculation of Electromagnetic Field...",
    date: "Oct 24",
    duration: "45m duration",
    bookmarked: true,
  },
  {
    id: "2",
    course: "MTH 202",
    type: "TUTOR",
    title: "One-on-one session with Dr. Arinze: Advanced Linea...",
    date: "Oct 22",
    duration: "1h 15m duration",
  },
  {
    id: "3",
    course: "PHY 101",
    type: "STUDY",
    title: "Deep Focus: Fundamentals of Newtonian Mechanics & ...",
    date: "Oct 20",
    duration: "2h 30m duration",
    bookmarked: true,
  },
  {
    id: "4",
    course: "CSC 405",
    type: "SOLVE ASSIGNMENT",
    title: "Debugging Memory Leaks in Multi-threaded C++...",
    date: "Oct 18",
    duration: "1h 05m duration",
  },
  {
    id: "5",
    course: "CHM 101",
    type: "STUDY",
    title: "Thermodynamics: Understanding Gibbs Free...",
    date: "Oct 15",
    duration: "55m duration",
  },
];

const TYPE_COLORS: Record<Session["type"], string> = {
  "SOLVE ASSIGNMENT": "#6366F1",
  TUTOR: "#7C3AED",
  STUDY: "#D97706",
};

const SessionIcon: React.FC<{ type: Session["type"] }> = ({ type }) => {
  const bg = TYPE_COLORS[type];
  return (
    <View style={[styles.sessionIcon, { backgroundColor: bg + "22" }]}>
      {type === "SOLVE ASSIGNMENT" && <Camera size={20} color={bg} />}
      {type === "TUTOR" && <MessageSquare size={20} color={bg} />}
      {type === "STUDY" && <BookOpen size={20} color={bg} />}
    </View>
  );
};

const TypeBadge: React.FC<{ type: Session["type"]; course: string }> = ({ type, course }) => (
  <View style={styles.badgeRow}>
    <View style={[styles.courseBadge, { backgroundColor: TYPE_COLORS[type] + "22" }]}>
      <Text style={[styles.courseText, { color: TYPE_COLORS[type] }]}>{course}</Text>
    </View>
    <Text style={styles.typeText}>{type}</Text>
  </View>
);

export const SessionsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  // Hide the bottom tab bar on this screen
  useFocusEffect(
    React.useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.getParent()?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  const filteredSessions = MOCK_SESSIONS.filter((s) => {
    if (activeTab === "All") return true;
    if (activeTab === "Assignments") return s.type === "SOLVE ASSIGNMENT";
    if (activeTab === "Tutor") return s.type === "TUTOR";
    if (activeTab === "Study Mode") return s.type === "STUDY";
    return true;
  });

  const isEmpty = filteredSessions.length === 0;

  return (
    <Screen hideHeader style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sessions</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <Search size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsRow}>
          {(["All", "Assignments", "Tutor", "Study Mode"] as FilterTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.activeTabLabel]}>
                {tab}
              </Text>
              {activeTab === tab && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Empty State */}
        {isEmpty ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIllustration}>
              <View style={styles.emptyDoc}>
                <View style={styles.emptyLine} />
                <View style={[styles.emptyLine, { width: "60%" }]} />
                <View style={[styles.emptyLine, { width: "80%" }]} />
                <View style={styles.emptyCircle} />
              </View>
              <View style={styles.emptyBadge}>
                <MessageSquare size={18} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySubtext}>
              Solve your first assignment and it'll show up here.
            </Text>
            <TouchableOpacity
              style={styles.solveBtn}
              onPress={() => navigation.navigate("Solve")}
              activeOpacity={0.8}
            >
              <Text style={styles.solveBtnText}>Solve Assignment</Text>
            </TouchableOpacity>

            <View style={styles.aiBanner}>
              <Sparkles size={14} color={colors.primary} />
              <Text style={styles.aiBannerText}>
                AI READY: START A LESSON TO ANALYZE PROGRESS
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Session Cards */}
            <View style={styles.sessionsList}>
              {filteredSessions.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={styles.sessionCard}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigation.navigate("SessionDetail", { id: session.id })
                  }
                >
                  <SessionIcon type={session.type} />
                  <View style={styles.sessionInfo}>
                    <TypeBadge type={session.type} course={session.course} />
                    <Text style={styles.sessionTitle} numberOfLines={2}>
                      {session.title}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {session.date} • {session.duration}
                    </Text>
                  </View>
                  <View style={styles.sessionActions}>
                    {session.bookmarked && (
                      <Bookmark
                        size={16}
                        color={colors.primary}
                        fill={colors.primary}
                        style={styles.bookmark}
                      />
                    )}
                    <ChevronRight size={20} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* AI Insight Card */}
            <View style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Sparkles size={14} color={colors.primary} />
                <Text style={styles.insightLabel}>ACADEMIC INSIGHT</Text>
              </View>
              <Text style={styles.insightText}>
                "You tend to perform 15% better on morning sessions. Consider
                scheduling your next EEE 301 session before 11 AM."
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.primary,
  },
  iconBtn: {
    padding: 6,
  },

  // Tabs
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 24,
  },
  tabItem: {
    paddingBottom: 12,
    position: "relative",
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: colors.textSecondary,
  },
  activeTabLabel: {
    color: colors.textPrimary,
    fontFamily: "Inter-SemiBold",
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },

  // Session Cards
  sessionsList: {
    paddingHorizontal: 16,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 10,
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sessionInfo: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  courseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  courseText: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    fontWeight: "700",
  },
  typeText: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  sessionTitle: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 18,
  },
  sessionMeta: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
  },
  sessionActions: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  bookmark: {
    marginBottom: 4,
  },

  // AI Insight
  insightCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
    letterSpacing: 0.8,
  },
  insightText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  emptyIllustration: {
    width: 160,
    height: 160,
    marginBottom: 32,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyDoc: {
    width: 130,
    height: 140,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 10,
    justifyContent: "center",
  },
  emptyLine: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    width: "100%",
  },
  emptyCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    marginTop: 4,
    alignSelf: "center",
  },
  emptyBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  solveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 50,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  solveBtnText: {
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
  },
  aiBannerText: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
});