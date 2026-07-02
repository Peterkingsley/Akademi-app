import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowUpRight, BookOpen, CalendarDays, Clock3, CreditCard, MapPin, Signal, Sparkles, Target, Upload, Users } from "lucide-react-native";

import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { adminService } from "../../../services/adminService";
import { useTheme } from "../../../theme/ThemeContext";

const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString() : "N/A";

const formatRelativeTime = (value?: string | null) => {
  if (!value) return "No activity yet";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "No activity yet";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(value);
};

const Stat = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.statBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[typography.h3, { color: colors.textPrimary }]}>{value ?? 0}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{label}</Text>
    </View>
  );
};

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => {
  const { colors, typography } = useTheme();
  return (
    <Card style={StyleSheet.flatten([styles.sectionCard, { borderColor: colors.border }])}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={[typography.h4, { color: colors.textPrimary, marginLeft: 8 }]}>{title}</Text>
      </View>
      {children}
    </Card>
  );
};

export const AdminUserDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const userId = route.params?.userId;

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getUserProfile(userId);
      setProfile(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load user analytics.");
    } finally {
      setLoading(false);
    }
  };

  const user = profile?.user;
  const analytics = profile?.analytics;
  const featureUsage = analytics?.featureUsage || {};
  const usage = analytics?.usageFrequency || {};
  const performance = analytics?.performance || {};

  const topFeature = useMemo(() => {
    const entries = Object.entries(featureUsage) as Array<[string, number]>;
    return entries.sort((a, b) => b[1] - a[1])[0];
  }, [featureUsage]);

  if (loading) {
    return (
      <Screen title="User Details" onBack={() => navigation.goBack()}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error || !user) {
    return (
      <Screen title="User Details" onBack={() => navigation.goBack()}>
        <View style={styles.center}>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>{error || "User not found"}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="User Details" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={StyleSheet.flatten([styles.heroCard, { borderColor: colors.border }])}>
          <View style={styles.heroTop}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>{user.name?.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>{user.name}</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{user.email}</Text>
            </View>
            <Badge label={analytics?.onlineStatus === "online" ? "Online" : "Offline"} variant={analytics?.onlineStatus === "online" ? "success" : "warning"} />
          </View>
          <View style={styles.metaLine}>
            <MapPin size={14} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 6, flex: 1 }]}>
              {[user.university, user.department, user.level ? `${user.level}L` : null].filter(Boolean).join(" / ")}
            </Text>
          </View>
          <View style={styles.metaLine}>
            <CalendarDays size={14} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 6 }]}>Registered {formatDate(user.created_at)}</Text>
          </View>
          <View style={styles.metaLine}>
            <Clock3 size={14} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 6 }]}>Last activity {formatRelativeTime(analytics?.lastActivityAt)}</Text>
          </View>
        </Card>

        <View style={styles.statGrid}>
          <Stat label="Active days" value={usage.activeDays} />
          <Stat label="7d sessions" value={usage.sessionsLast7Days} />
          <Stat label="30d sessions" value={usage.sessionsLast30Days} />
          <Stat label="Avg/week" value={usage.avgSessionsPerWeek} />
        </View>

        <Section title="Feature Usage" icon={<Sparkles size={18} color={colors.primary} />}>
          <View style={styles.statGridCompact}>
            <Stat label="Assignments" value={featureUsage.assignmentSolving} />
            <Stat label="Study" value={featureUsage.studyMode} />
            <Stat label="Exam prep" value={featureUsage.examPrep} />
            <Stat label="Uploads" value={featureUsage.materialUploads} />
            <Stat label="CBT" value={featureUsage.cbtPractice} />
          </View>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 12 }]}>
            Top signal: {topFeature ? `${topFeature[0]} (${topFeature[1]})` : "No feature activity yet"}.
          </Text>
        </Section>

        <Section title="Performance" icon={<Target size={18} color={colors.primary} />}>
          <View style={styles.statGridCompact}>
            <Stat label="Solved" value={performance.solvedQuestions} />
            <Stat label="Accuracy" value={`${performance.accuracy || 0}%`} />
            <Stat label="Avg mock" value={performance.averageMockScore !== null ? `${performance.averageMockScore}%` : "N/A"} />
            <Stat label="AI replies" value={performance.aiMessages} />
          </View>
        </Section>

        <Section title="Course Signals" icon={<BookOpen size={18} color={colors.primary} />}>
          {(analytics?.courseUsage || []).length === 0 ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>No course activity yet.</Text>
          ) : (
            analytics.courseUsage.map((course: any) => (
              <View key={course.course} style={[styles.row, { borderBottomColor: colors.border }]}>
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{course.course}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {course.sessions} sessions / {course.solves} solves / {course.mocks} mocks
                </Text>
              </View>
            ))
          )}
        </Section>

        <Section title="Access & Payments" icon={<CreditCard size={18} color={colors.primary} />}>
          <View style={styles.statGridCompact}>
            <Stat label="Total spent" value={`NGN ${(analytics?.payments?.totalSpent || 0).toLocaleString()}`} />
            <Stat label="Payments" value={analytics?.payments?.successfulTransactions || 0} />
            <Stat label="Active passes" value={(analytics?.access || []).length} />
            <Stat label="Devices" value={(analytics?.devices || []).length} />
          </View>
        </Section>

        <Section title="Recent Activity" icon={<Signal size={18} color={colors.primary} />}>
          {(analytics?.recentActivity || []).length === 0 ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>No activity yet.</Text>
          ) : (
            analytics.recentActivity.map((item: any) => (
              <View key={`${item.type}-${item.id}`} style={[styles.row, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.type} / {item.meta}</Text>
                </View>
                <View style={styles.activityTime}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{formatRelativeTime(item.timestamp)}</Text>
                  <ArrowUpRight size={13} color={colors.textMuted} />
                </View>
              </View>
            ))
          )}
        </Section>

        <Section title="Marketing Notes" icon={<Users size={18} color={colors.primary} />}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, lineHeight: 20 }]}>
            Track which feature this user repeats, how often they return, which course creates the most activity, and whether usage converts into payment. Those four signals tell us what to improve, what to market, and what to remove.
          </Text>
        </Section>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: { borderWidth: 1, padding: 16 },
  heroTop: { alignItems: "center", flexDirection: "row" },
  avatar: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", marginRight: 12, width: 48 },
  heroCopy: { flex: 1, minWidth: 0 },
  metaLine: { alignItems: "center", flexDirection: "row", marginTop: 10 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  statGridCompact: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statBox: { borderRadius: 10, borderWidth: 1, minWidth: "47%", padding: 12 },
  sectionCard: { borderWidth: 1, marginTop: 14, padding: 16 },
  sectionHeader: { alignItems: "center", flexDirection: "row", marginBottom: 14 },
  row: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", paddingVertical: 11 },
  activityTime: { alignItems: "center", flexDirection: "row", gap: 4, marginLeft: 8 },
});
