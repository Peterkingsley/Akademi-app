import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Bell,
  BookOpen,
  Clock,
  Layout,
  Zap,
  Compass,
  X,
  Sparkles,
  Layers,
} from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../theme/ThemeContext";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { Screen } from "../../components/layout/Screen";
import { useAuthStore } from "../../store/useAuthStore";
import { sessionService, Session, LearningProfile } from "../../services/session";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  screen: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: "simulation" | "weakness";
  metadata: {
    duration: string;
    sections: number;
  };
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "1", label: "Solve", icon: <Zap size={24} color="#FFFFFF" />, color: "#22C55E", screen: "Solve" },
  { id: "2", label: "Library", icon: <BookOpen size={24} color="#FFFFFF" />, color: "#3B82F6", screen: "Library" },
  { id: "3", label: "Mock Exam", icon: <Layout size={24} color="#FFFFFF" />, color: "#F59E0B", screen: "MockExam" },
  { id: "4", label: "Socratic", icon: <Compass size={24} color="#FFFFFF" />, color: "#8B5CF6", screen: "Socratic" },
];

const AI_TIPS = [
  "Use the active recall method to boost retention by 50%.",
  "Spaced repetition is the key to mastering complex engineering concepts.",
  "Taking a 5-minute break every 25 minutes keeps your focus sharp.",
  "Analyzing your mock exam errors is more valuable than doing new questions.",
];

export const HomeScreen: React.FC = () => {
  const { colors, typography, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isStreakBannerDismissed, setIsStreakBannerDismissed] = useState(false);

  useEffect(() => {
    loadData();
    checkStreakBanner();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsData, profileData] = await Promise.all([
        sessionService.getRecentSessions(),
        sessionService.getLearningProfile(),
      ]);
      setSessions(sessionsData.slice(0, 5));
      setLearningProfile(profileData);

      setRecommendations([
        {
          id: "r1",
          title: "GST 111 Final Simulation",
          description: "Based on last year's pattern. 50 questions.",
          type: "simulation",
          metadata: { duration: "45m", sections: 3 },
          color: "#3B82F6"
        },
        {
          id: "r2",
          title: "Calculus Weakness Drill",
          description: "AI identified gaps in integration by parts.",
          type: "weakness",
          metadata: { duration: "15m", sections: 1 },
          color: "#F59E0B"
        }
      ]);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const checkStreakBanner = async () => {
    const dismissed = await AsyncStorage.getItem("streak_banner_dismissed");
    if (dismissed === "true") {
      setIsStreakBannerDismissed(true);
    }
  };

  const dismissStreakBanner = async () => {
    setIsStreakBannerDismissed(true);
    await AsyncStorage.setItem("streak_banner_dismissed", "true");
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h`;
    return `${Math.floor(diffInHours / 24)}d`;
  };

  const QuickActionTile = ({ action, onPress }: { action: QuickAction; onPress: () => void }) => (
    <TouchableOpacity
      key={action.id}
      style={styles.tileWrapper}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.iconContainer, { backgroundColor: action.color }]}>
          {action.icon}
        </View>
        <Text style={[styles.tileLabel, typography.body, { color: colors.textPrimary }]}>{action.label}</Text>
      </View>
    </TouchableOpacity>
  );

  const examSubtitle = useMemo(() => {
    return "Ready to excel today?";
  }, []);

  const dailyTip = useMemo(() => {
    const dayOfYear = Math.floor(new Date().getTime() / 8.64e7);
    return AI_TIPS[dayOfYear % AI_TIPS.length];
  }, []);

  const showStreakBanner = !loading &&
    learningProfile &&
    learningProfile.streak > 0 &&
    !isStreakBannerDismissed;

  const renderSessionCard = ({ item, index }: { item: Session, index: number }) => (
    <Animated.View key={item.id} entering={FadeInUp.delay(index * 100)}>
      <Card style={styles.sessionCard} onPress={() => {}}>
        <View style={styles.sessionTop}>
          <View style={[styles.courseTag, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.courseText, typography.mono, { color: colors.primary }]}>{item.courseCode}</Text>
          </View>
          <Text style={[styles.timeAgo, typography.mono, { color: colors.textMuted }]}>
            {getTimeAgo(item.createdAt)} ago
          </Text>
        </View>
        <Text style={[styles.sessionTitle, typography.body, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.topic}
        </Text>
        <Text style={[styles.sessionType, typography.bodySmall, { color: colors.textSecondary }]}>{item.sessionType}</Text>
        <Text style={[styles.resumeLink, typography.bodySmall, { color: colors.primary }]}>Resume →</Text>
      </Card>
    </Animated.View>
  );

  const renderRecommendationCard = ({ item, index }: { item: Recommendation, index: number }) => (
    <Animated.View key={item.id} entering={FadeInUp.delay(index * 100 + 400)}>
      <Card style={StyleSheet.flatten([styles.recCard, { borderLeftWidth: 3, borderLeftColor: item.color }])} onPress={() => {}}>
        <View style={styles.recTop}>
          <Text style={[styles.recTitle, typography.body, { color: colors.textPrimary }]}>{item.title}</Text>
          <Badge
            label={item.type === "weakness" ? "AI Recommended" : "New Simulation"}
            variant={item.type === "weakness" ? "purple" : "blue"}
          />
        </View>
        <Text style={[styles.recDescription, typography.bodySmall, { color: colors.textSecondary }]}>{item.description}</Text>
        <View style={styles.recMeta}>
          <View style={styles.metaItem}>
            <Clock size={14} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaText, typography.caption, { color: colors.textMuted }]}>{item.metadata.duration}</Text>
          </View>
          <View style={styles.metaItem}>
            <Layers size={14} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaText, typography.caption, { color: colors.textMuted }]}>{item.metadata.sections} sections</Text>
          </View>
        </View>
      </Card>
    </Animated.View>
  );

  return (
    <Screen scrollable style={{ backgroundColor: colors.background }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={[typography.h2, { color: colors.textPrimary }]}>
              {greeting}, {user?.name?.split(" ")[0] || "Student"}
            </Text>
            <Text style={[styles.subtitle, typography.mono, { color: colors.textSecondary }]}>
              {examSubtitle}
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Bell size={24} color={colors.textSecondary} />
            <View style={[styles.unreadDot, { backgroundColor: colors.error, borderColor: colors.background }]} />
          </TouchableOpacity>
        </View>

        {showStreakBanner && (
          <Animated.View entering={FadeInUp} style={[styles.streakBanner, { backgroundColor: isDark ? "#1C1A10" : "#FEFCE8" }]}>
            <View style={styles.streakContent}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={[styles.streakText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: "700", color: isDark ? "#FFFFFF" : colors.textPrimary }}>{learningProfile?.streak}-day streak!</Text>
                {" "}Keep it up — study something today.
              </Text>
            </View>
            <TouchableOpacity onPress={dismissStreakBanner} style={styles.dismissBtn}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action, index) => (
            <QuickActionTile
              key={action.id}
              action={action}
              onPress={() => navigation.navigate(action.screen)}
            />
          ))}
        </View>

        {(loading || sessions.length > 0) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, typography.h3, { color: colors.textPrimary }]}>Continue where you left off</Text>
            {loading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} width={180} height={140} borderRadius={12} style={{ marginRight: 16 }} />
                ))}
              </ScrollView>
            ) : (
              <FlatList
                data={sessions}
                renderItem={renderSessionCard}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              />
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, typography.h3, { color: colors.textPrimary }]}>Recommended for you</Text>
            <Sparkles size={20} color={colors.primary} style={styles.sparkleIcon} />
          </View>
          {loading ? (
            <View>
              {[1, 2].map((i) => (
                <Skeleton key={i} height={120} borderRadius={12} style={{ marginBottom: 16 }} />
              ))}
            </View>
          ) : (
            <View>
              {recommendations.map((item, index) => renderRecommendationCard({ item, index }))}
            </View>
          )}
        </View>

        <View style={styles.aiTipContainer}>
          <View style={[styles.aiTipBanner, { backgroundColor: isDark ? "#0D1526" : "#F0F9FF" }]}>
            <Compass size={18} color={colors.primary} style={styles.aiTipIcon} />
            <Text style={[styles.aiTipText, typography.mono, { color: colors.textSecondary }]}>{dailyTip}</Text>
          </View>
        </View>

      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 0,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 10.5,
    marginTop: 4,
  },
  notificationBtn: {
    position: "relative",
    padding: 4,
  },
  unreadDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  streakBanner: {
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  streakContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  streakEmoji: {
    fontSize: 15,
    marginRight: 12,
  },
  streakText: {
    fontSize: 10.5,
    flex: 1,
  },
  dismissBtn: {
    padding: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  tileWrapper: {
    width: "48%",
    marginBottom: 16,
  },
  tile: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  tileLabel: {
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  horizontalScroll: {
    paddingRight: 20,
  },
  sessionCard: {
    width: 180,
    marginRight: 16,
    padding: 14,
  },
  sessionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  courseTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  courseText: {
    fontSize: 7.5,
    textTransform: "uppercase",
  },
  timeAgo: {
    fontSize: 7.5,
  },
  sessionTitle: {
    fontWeight: "700",
    marginBottom: 4,
  },
  sessionType: {
    marginBottom: 12,
  },
  resumeLink: {
    fontWeight: "600",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sparkleIcon: {
    marginLeft: 8,
    marginTop: -16,
  },
  recCard: {
    marginBottom: 16,
    padding: 16,
  },
  recTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recTitle: {
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  recDescription: {
    marginBottom: 16,
  },
  recMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
  },
  aiTipContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  aiTipBanner: {
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  aiTipIcon: {
    marginRight: 12,
  },
  aiTipText: {
    fontSize: 9,
    flex: 1,
  },
});
