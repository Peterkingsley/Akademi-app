import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Platform,
} from "react-native";
import {
  Bell,
  Camera,
  Book,
  Bot,
  Target,
  Sparkles,
  Clock,
  Layers,
  Compass,
  X,
  ArrowRight,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";

import { SafeArea } from "../../components/layout/SafeArea";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";
import { useAuthStore } from "../../store/useAuthStore";
import api from "../../services/api";
import { Skeleton } from "../../components/ui/Skeleton";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";

const { width } = Dimensions.get("window");

const STREAK_BANNER_HIDDEN_KEY = "streak_banner_hidden";

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [examData, setExamData] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [learningProfile, setLearningProfile] = useState<any>(null);
  const [showStreakBanner, setShowStreakBanner] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(true);

  const fetchAllData = async () => {
    try {
      const [examsRes, sessionsRes, profileRes, hiddenBanner] = await Promise.all([
        api.get("/exam-prep").catch(() => ({ data: [] })),
        api.get("/users/me/sessions?limit=4").catch(() => ({ data: [] })),
        api.get("/users/me/learning-profile").catch(() => ({ data: null })),
        AsyncStorage.getItem(STREAK_BANNER_HIDDEN_KEY),
      ]);

      setExamData(examsRes.data);
      setSessions(sessionsRes.data);
      setLearningProfile(profileRes.data);

      if (profileRes.data?.session_count > 0 && hiddenBanner !== "true") {
        setShowStreakBanner(true);
      } else {
        setShowStreakBanner(false);
      }
    } catch (error) {
      console.error("Error fetching home data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getSubtitle = () => {
    if (examData && examData.length > 0) {
      const sortedExams = [...examData].sort(
        (a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
      );
      const nearestExam = sortedExams[0];
      const examDate = new Date(nearestExam.exam_date);
      const today = new Date();
      const diffTime = examDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        return `Exam in ${diffDays} days — your prep plan is ready`;
      }
    }
    return "Ready to learn something new today?";
  };

  const dismissStreakBanner = async () => {
    await AsyncStorage.setItem(STREAK_BANNER_HIDDEN_KEY, "true");
    setShowStreakBanner(false);
  };

  const QuickActionTile = ({ icon: Icon, label, color, onPress }: any) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      scale.value = withSpring(0.95);
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
        style={styles.actionTileWrapper}
      >
        <Animated.View style={[styles.actionTile, animatedStyle]}>
          <View style={[styles.iconContainer, { backgroundColor: `${color}26` }]}>
            <Icon size={32} color={color} />
          </View>
          <Text style={[styles.actionLabel, typography.bodySmall, { color: colors.textPrimary, fontWeight: "600" }]}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    let interval = seconds / 3600;
    if (interval >= 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    return Math.floor(interval) + " minutes ago";
  };

  const AITipBanner = () => {
    const tips = [
      "AI TIP: Study between 6-8 AM for maximum retention today.",
      "AI TIP: Take a 5-minute break every 25 minutes to stay sharp.",
      "AI TIP: Explaining a concept to the AI tutor solidifies your knowledge.",
      "AI TIP: Reviewing your weak topics before bed improves recall.",
    ];
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const tip = tips[dayOfYear % tips.length];

    return (
      <View style={styles.aiTipContainer}>
        <Compass size={16} color={colors.primary} />
        <Text style={[styles.aiTipText, typography.mono, { fontSize: 12, color: colors.textSecondary }]}>{tip}</Text>
      </View>
    );
  };

  const firstName = user?.name ? user.name.split(" ")[0] : "";

  return (
    <SafeArea style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Section 1: Greeting Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetingText, { color: colors.textPrimary }]}>
              {getGreeting()}, {firstName} 👋
            </Text>
            <Text style={[styles.subtitle, typography.mono, { color: colors.textSecondary, fontSize: 14 }]}>{getSubtitle()}</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate("NotificationsSettings")}
          >
            <Bell size={24} color={colors.textSecondary} />
            {unreadNotifications && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        </View>

        {/* Section 2: Streak Banner */}
        {showStreakBanner && (
          <Animated.View entering={FadeInUp} style={styles.streakBanner}>
            <View style={styles.streakContent}>
              <Text style={styles.fireEmoji}>🔥</Text>
              <Text style={[styles.streakText, typography.bodySmall, { color: colors.textSecondary }]}>
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                  {learningProfile?.session_count}-day streak!
                </Text>{" "}
                Keep it up — study something today.
              </Text>
            </View>
            <TouchableOpacity onPress={dismissStreakBanner}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Section 3: Quick Action Grid */}
        <View style={styles.grid}>
          <QuickActionTile
            icon={Camera}
            label="Solve Assignment"
            color={colors.primary}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("Solve");
            }}
          />
          <QuickActionTile
            icon={Book}
            label="Study Materials"
            color={colors.accentPurple}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("Library");
            }}
          />
          <QuickActionTile
            icon={Bot}
            label="Live Tutor"
            color={colors.success}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("LiveTutorEntry");
            }}
          />
          <QuickActionTile
            icon={Target}
            label="Exam Prep"
            color={colors.warning}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("ExamPrep");
            }}
          />
        </View>

        {/* Section 4: Continue Where You Left Off */}
        {(loading || (sessions && sessions.length > 0)) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: spacing.md }]}>Continue where you left off</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
              decelerationRate="fast"
              snapToInterval={192}
            >
              {loading ? (
                [1, 2, 3].map((i) => (
                  <View key={i} style={styles.sessionCardSkeleton}>
                    <Skeleton width={180} height={140} borderRadius={12} />
                  </View>
                ))
              ) : (
                sessions.map((item, index) => (
                  <Animated.View
                    key={item.id}
                    entering={FadeInUp.delay(index * 50)}
                  >
                    <Card
                      style={styles.sessionCard}
                      bordered
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (item.session_type === 'TUTOR') {
                            navigation.navigate('LiveTutorSession', { sessionId: item.id });
                        } else {
                            navigation.navigate('Library');
                        }
                      }}
                    >
                      <View style={styles.cardTop}>
                        <View style={styles.coursePill}>
                            <Text style={[styles.coursePillText, typography.mono]}>{item.course_code}</Text>
                        </View>
                        <Text style={[styles.timeAgo, typography.caption, { color: colors.textMuted }]}>
                          {getTimeAgo(item.created_at)}
                        </Text>
                      </View>
                      <Text style={[styles.sessionTitleText, { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 }]} numberOfLines={1}>
                        {item.course_code} Session
                      </Text>
                      <Text style={[styles.sessionTypeText, { color: colors.textSecondary, fontSize: 13, marginBottom: 12 }]}>
                        {item.session_type === 'ASSIGNMENT' ? 'Assignment Solving' :
                         item.session_type === 'TUTOR' ? 'Live Tutoring' :
                         item.session_type === 'EXAM_PREP' ? 'Exam Prep' : 'Study Mode'}
                      </Text>
                      <View style={styles.resumeContainer}>
                        <Text style={[styles.resumeText, { color: colors.primary, fontSize: 13, fontWeight: '600' }]}>Resume →</Text>
                      </View>
                    </Card>
                  </Animated.View>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {/* Section 5: Recommended For You */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: 18, fontWeight: '700' }]}>Recommended for you</Text>
            <Sparkles size={18} color={colors.primary} style={{ marginLeft: 8 }} />
          </View>

          {loading ? (
            [1, 2].map((i) => (
              <View key={i} style={styles.recommendationSkeleton}>
                <Skeleton width="100%" height={120} borderRadius={12} />
              </View>
            ))
          ) : (
            <View>
              {[
                {
                  id: "1",
                  title: "Weak Topic: Thermodynamics",
                  badge: "AI Recommended",
                  badgeVariant: "ai" as const,
                  body: "You've struggled with entropy lately. Here's a quick summary to bridge the gap.",
                  time: "15 min",
                  sections: "4 sections",
                  color: colors.accentPurple
                },
                {
                  id: "2",
                  title: "PHY 101: Quantum Mechanics",
                  badge: "New Simulation",
                  badgeVariant: "course" as const,
                  body: "A new interactive simulation for Wave-Particle Duality is now available for your course.",
                  time: "10 min",
                  sections: "2 sections",
                  color: colors.primary
                }
              ].map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInUp.delay(index * 100)}
                >
                  <Card style={[styles.recommendationCard, { borderLeftWidth: 3, borderLeftColor: item.color, marginBottom: 12, backgroundColor: colors.surface }]}>
                    <View style={styles.recCardHeader}>
                      <Text style={[styles.recTitle, { color: colors.textPrimary, fontSize: 16, fontWeight: '700' }]}>{item.title}</Text>
                      <Badge label={item.badge} variant={item.badgeVariant} />
                    </View>
                    <Text style={[styles.recBody, { color: colors.textSecondary, fontSize: 14, marginBottom: 16 }]}>{item.body}</Text>
                    <View style={styles.recFooter}>
                      <View style={styles.recMeta}>
                        <Clock size={14} color={colors.textMuted} />
                        <Text style={[styles.recMetaText, typography.caption, { color: colors.textMuted, marginLeft: 6 }]}>{item.time}</Text>
                      </View>
                      <View style={styles.recMeta}>
                        <Layers size={14} color={colors.textMuted} />
                        <Text style={[styles.recMetaText, typography.caption, { color: colors.textMuted, marginLeft: 6 }]}>{item.sections}</Text>
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              ))}
            </View>
          )}
        </View>

        {/* Section 6: AI Tip Banner */}
        <AITipBanner />
      </ScrollView>
    </SafeArea>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 4,
  },
  notificationButton: {
    padding: 8,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  streakBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1C1A10",
    borderRadius: 12,
    padding: 14,
    marginBottom: spacing.lg,
  },
  streakContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  fireEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  streakText: {
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  actionTileWrapper: {
    width: (width - 40 - 16) / 2,
    marginBottom: 16,
  },
  actionTile: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
    height: 120,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  actionLabel: {
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
  },
  horizontalScroll: {
    paddingRight: 20,
  },
  sessionCard: {
    width: 180,
    marginRight: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  sessionCardSkeleton: {
    marginRight: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  coursePill: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  coursePillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timeAgo: {
  },
  sessionTitleText: {
  },
  sessionTypeText: {
  },
  resumeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  resumeText: {
  },
  recommendationCard: {
  },
  recommendationSkeleton: {
    marginBottom: 12,
  },
  recCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  recTitle: {
    flex: 1,
    marginRight: 8,
  },
  recBody: {
  },
  recFooter: {
    flexDirection: "row",
  },
  recMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  recMetaText: {
  },
  aiTipContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1526",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  aiTipText: {
    marginLeft: 10,
    flex: 1,
  },
});
