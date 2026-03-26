import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, FlatList } from "react-native";
import { Bell, Sparkles, Camera, Book, Bot, Target, X, Clock, Layers, Compass } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  FadeInUp
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Skeleton } from "../../components/ui/Skeleton";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { Session, LearningProfile, ExamPrepPlan, Recommendation } from "./types";

const STREAK_BANNER_HIDDEN_KEY = "streak_banner_hidden";
const { width } = Dimensions.get("window");

const QUICK_ACTIONS = [
  {
    id: "solve",
    label: "Solve Assignment",
    icon: Camera,
    color: colors.primary,
    screen: "Solve"
  },
  {
    id: "study",
    label: "Study Materials",
    icon: Book,
    color: colors.accentPurple,
    screen: "Library"
  },
  {
    id: "tutor",
    label: "Live Tutor",
    icon: Bot,
    color: colors.success,
    screen: "LiveTutorEntry"
  },
  {
    id: "exam",
    label: "Exam Prep",
    icon: Target,
    color: colors.warning,
    screen: "ExamPrep"
  }
];

const AI_TIPS = [
  "AI TIP: Study between 6-8 AM for maximum retention today.",
  "AI TIP: Take a 5-minute break every 25 minutes of studying.",
  "AI TIP: Explain a concept to someone else to solidify your understanding.",
  "AI TIP: Use mnemonics to remember complex academic terms.",
  "AI TIP: Stay hydrated while studying to maintain focus and energy."
];

// Helper to avoid date-fns dependency
const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d`;
};

const QuickActionTile = ({ action, onPress }: { action: typeof QUICK_ACTIONS[0], onPress: () => void }) => {
  const scale = useSharedValue(1);
  const Icon = action.icon;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={styles.tileWrapper}
    >
      <Animated.View style={[styles.tile, animatedStyle]}>
        <View style={[styles.iconContainer, { backgroundColor: `${action.color}26` }]}>
          <Icon size={24} color={action.color} />
        </View>
        <Text style={[styles.tileLabel, typography.bodySmall]}>{action.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [exams, setExams] = useState<ExamPrepPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStreakBannerDismissed, setIsStreakBannerDismissed] = useState(false);

  useEffect(() => {
    fetchData();
    checkStreakBanner();
  }, []);

  const fetchData = async () => {
    try {
      const [sessionsRes, profileRes, examsRes] = await Promise.all([
        api.get("/users/me/sessions?limit=4"),
        api.get("/users/me/learning-profile"),
        api.get("/exam-prep")
      ]);

      setSessions(sessionsRes.data);
      setLearningProfile(profileRes.data || { session_count: 0, subject_weaknesses: [] });
      setExams(examsRes.data);
    } catch (error) {
      console.error("Error fetching home data:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkStreakBanner = async () => {
    const isHidden = await AsyncStorage.getItem(STREAK_BANNER_HIDDEN_KEY);
    if (isHidden === "true") {
      setIsStreakBannerDismissed(true);
    }
  };

  const dismissStreakBanner = async () => {
    await AsyncStorage.setItem(STREAK_BANNER_HIDDEN_KEY, "true");
    setIsStreakBannerDismissed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const nextExam = useMemo(() => {
    if (!exams.length) return null;
    return exams.sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime())[0];
  }, [exams]);

  const examSubtitle = useMemo(() => {
    if (!nextExam) return "Ready to learn something new today?";
    const diff = new Date(nextExam.exam_date).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return `Exam today for ${nextExam.course_code} — good luck!`;
    return `Exam in ${days} days — your prep plan is ready`;
  }, [nextExam]);

  const recommendations: Recommendation[] = useMemo(() => {
    const recs: Recommendation[] = [];

    if (learningProfile?.subject_weaknesses?.length) {
      recs.push({
        id: "weakness_1",
        title: "Mastering " + learningProfile.subject_weaknesses[0],
        type: "weakness",
        description: "Focus on your weak areas with targeted AI questions.",
        metadata: { duration: "15m", sections: 4 },
        color: colors.primary
      });
    }

    if (nextExam) {
      const diff = new Date(nextExam.exam_date).getTime() - new Date().getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days < 7) {
        recs.push({
          id: "exam_reminder",
          title: `Mock Exam: ${nextExam.course_code}`,
          type: "exam",
          description: "Simulate the real exam and get predicted scores.",
          metadata: { duration: "45m", sections: 20 },
          color: colors.accentPurple
        });
      }
    }

    // Default recommendation
    if (recs.length < 2) {
      recs.push({
        id: "default_rec",
        title: "Daily Study: " + (user?.department || "Academic Prep"),
        type: "material",
        description: "New verified materials added for your course today.",
        metadata: { duration: "10m", sections: 2 },
        color: colors.success
      });
    }

    return recs;
  }, [learningProfile, nextExam, user]);

  const dailyTip = useMemo(() => {
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    return AI_TIPS[dayOfYear % AI_TIPS.length];
  }, []);

  const showStreakBanner = !loading &&
    learningProfile &&
    learningProfile.session_count > 0 &&
    !isStreakBannerDismissed;

  const renderSessionCard = ({ item, index }: { item: Session, index: number }) => (
    <Animated.View key={item.id} entering={FadeInUp.delay(index * 100)}>
      <Card style={styles.sessionCard} onPress={() => {}}>
        <View style={styles.sessionTop}>
          <View style={styles.courseTag}>
            <Text style={[styles.courseText, typography.mono]}>{item.course_code}</Text>
          </View>
          <Text style={[styles.timeAgo, typography.mono]}>
            {getTimeAgo(item.created_at)} ago
          </Text>
        </View>
        <Text style={[styles.sessionTitle, typography.body]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.sessionType, typography.bodySmall]}>{item.type}</Text>
        <Text style={[styles.resumeLink, typography.bodySmall]}>Resume →</Text>
      </Card>
    </Animated.View>
  );

  const renderRecommendationCard = ({ item, index }: { item: Recommendation, index: number }) => (
    <Animated.View key={item.id} entering={FadeInUp.delay(index * 100 + 400)}>
      <Card style={StyleSheet.flatten([styles.recCard, { borderLeftWidth: 3, borderLeftColor: item.color }])} onPress={() => {}}>
        <View style={styles.recTop}>
          <Text style={[styles.recTitle, typography.body]}>{item.title}</Text>
          <Badge
            label={item.type === "weakness" ? "AI Recommended" : "New Simulation"}
            variant={item.type === "weakness" ? "purple" : "blue"}
          />
        </View>
        <Text style={[styles.recDescription, typography.bodySmall]}>{item.description}</Text>
        <View style={styles.recMeta}>
          <View style={styles.metaItem}>
            <Clock size={14} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaText, typography.caption]}>{item.metadata.duration}</Text>
          </View>
          <View style={styles.metaItem}>
            <Layers size={14} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaText, typography.caption]}>{item.metadata.sections} sections</Text>
          </View>
        </View>
      </Card>
    </Animated.View>
  );

  return (
    <Screen scrollable style={styles.screen}>
      <View style={styles.container}>
        {/* Section 1: Greeting Header */}
        <View style={styles.header}>
          <View>
            <Text style={[typography.h2, { color: colors.textPrimary }]}>
              {greeting}, {user?.name?.split(" ")[0] || "Student"} 👋
            </Text>
            <Text style={[styles.subtitle, typography.mono]}>
              {examSubtitle}
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Bell size={24} color={colors.textSecondary} />
            <View style={styles.unreadDot} />
          </TouchableOpacity>
        </View>

        {/* Section 2: Streak Banner */}
        {showStreakBanner && (
          <Animated.View entering={FadeInUp} style={styles.streakBanner}>
            <View style={styles.streakContent}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakText}>
                <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>{learningProfile?.session_count}-day streak!</Text>
                {" "}Keep it up — study something today.
              </Text>
            </View>
            <TouchableOpacity onPress={dismissStreakBanner} style={styles.dismissBtn}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Section 3: Quick Action Grid */}
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action, index) => (
            <QuickActionTile
              key={action.id}
              action={action}
              onPress={() => navigation.navigate(action.screen)}
            />
          ))}
        </View>

        {/* Section 4: Continue where you left off */}
        {(loading || sessions.length > 0) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, typography.h3]}>Continue where you left off</Text>
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

        {/* Section 5: Recommended for you */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, typography.h3]}>Recommended for you</Text>
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

        {/* Section 6: AI Tip Banner */}
        <View style={styles.aiTipContainer}>
          <View style={styles.aiTipBanner}>
            <Compass size={18} color={colors.primary} style={styles.aiTipIcon} />
            <Text style={[styles.aiTipText, typography.mono]}>{dailyTip}</Text>
          </View>
        </View>

      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
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
    color: colors.textSecondary,
    fontSize: 14,
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
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  streakBanner: {
    backgroundColor: "#1C1A10",
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
    fontSize: 20,
    marginRight: 12,
  },
  streakText: {
    color: colors.textSecondary,
    fontSize: 14,
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
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: colors.textPrimary,
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
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  courseText: {
    color: colors.primary,
    fontSize: 10,
    textTransform: "uppercase",
  },
  timeAgo: {
    color: colors.textMuted,
    fontSize: 10,
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  sessionType: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  resumeLink: {
    color: colors.primary,
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
    color: colors.textPrimary,
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  recDescription: {
    color: colors.textSecondary,
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
    color: colors.textMuted,
  },
  aiTipContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  aiTipBanner: {
    backgroundColor: "#0D1526",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  aiTipIcon: {
    marginRight: 12,
  },
  aiTipText: {
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
});
