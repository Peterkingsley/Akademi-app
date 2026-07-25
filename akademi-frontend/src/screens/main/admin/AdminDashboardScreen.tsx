import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, RefreshControl } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminDashboardStats, AdminDashboardActivity, AdminSystemHealth } from "../../../services/adminService";
import { 
  Users, 
  FileText, 
  AlertTriangle, 
  Cpu, 
  DollarSign, 
  ChevronRight, 
  Activity, 
  Database, 
  Server, 
  Clock, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles,
  UserCheck,
  Zap,
  TrendingUp,
  FileSpreadsheet,
  Settings
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Avatar } from "../../../components/ui/Avatar";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 52) / 2;

const formatRelativeTime = (value?: string) => {
  if (!value) return "Time unavailable";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Time unavailable";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "Just now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(value).toLocaleDateString();
};

export const AdminDashboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<StackNavigationProp<AdminStackParamList>>();

  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [activity, setActivity] = useState<AdminDashboardActivity | null>(null);
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, activityData, healthData] = await Promise.all([
        adminService.getStats(),
        adminService.getActivity(),
        adminService.getSystemHealth()
      ]);
      setStats(statsData);
      setActivity(activityData);
      setHealth(healthData);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <View style={[styles.iconContainer, { backgroundColor: color + "18" }]}>
          <Icon size={20} color={color} />
        </View>
        {trend && (
          <View style={styles.trendBadge}>
            <TrendingUp size={10} color={colors.primary} />
            <Text style={styles.trendText}>{trend}</Text>
          </View>
        )}
      </View>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  );

  const StatSkeleton = () => (
    <View style={styles.statsGrid}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={[styles.statCard, { minHeight: 124 }]}>
          <Skeleton width={38} height={38} borderRadius={10} />
          <Skeleton width="45%" height={22} style={{ marginTop: 14 }} />
          <Skeleton width="70%" height={12} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );

  const serviceIcons: Record<string, any> = {
    database: Database,
    api: Server,
    aiService: Cpu,
    storage: FileText,
    auth: ShieldCheck,
  };

  const HealthItem = ({ name, status }: { name: string; status: "online" | "offline" }) => {
    const isOnline = status === "online";
    const IconComp = serviceIcons[name] || Activity;

    return (
      <View style={styles.healthItem}>
        <View style={styles.healthItemLeft}>
          <View style={[styles.healthIconBadge, { backgroundColor: isOnline ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)" }]}>
            <IconComp size={16} color={isOnline ? "#22C55E" : "#EF4444"} />
          </View>
          <View>
            <Text style={styles.healthName}>{name.toUpperCase()}</Text>
            <Text style={styles.healthSub}>{isOnline ? "Operational" : "Degraded"}</Text>
          </View>
        </View>
        <View style={styles.healthStatusRight}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? "#22C55E" : "#EF4444" }]} />
          <Text style={[styles.statusText, { color: isOnline ? "#22C55E" : "#EF4444" }]}>
            {isOnline ? "99.9%" : "Down"}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Command Hero Header */}
        <LinearGradient colors={["#0B1E12", "#04110A"]} style={styles.heroHeader}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.statusBadge}>
                <View style={styles.livePulseDot} />
                <Text style={styles.statusBadgeText}>SYSTEM OPERATIONAL</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchData} activeOpacity={0.7}>
              <RefreshCw size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroEyebrow}>ADMIN COMMAND CENTER</Text>
          <Text style={styles.heroTitle}>Platform Dashboard</Text>
          <Text style={styles.heroSub}>Real-time system telemetry, user growth & resource metrics</Text>

          {/* Quick Shortcuts Bar */}
          <View style={styles.shortcutsRow}>
            <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigation.navigate("UserManagement")} activeOpacity={0.7}>
              <Users size={16} color={colors.primary} />
              <Text style={styles.shortcutText}>Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigation.navigate("ContentModeration")} activeOpacity={0.7}>
              <ShieldCheck size={16} color="#38BDF8" />
              <Text style={styles.shortcutText}>Moderation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigation.navigate("DisciplineDocuments")} activeOpacity={0.7}>
              <FileSpreadsheet size={16} color="#F59E0B" />
              <Text style={styles.shortcutText}>CCMAS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigation.navigate("AdminMore")} activeOpacity={0.7}>
              <Settings size={16} color="#8B5CF6" />
              <Text style={styles.shortcutText}>More</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Live Platform Stats */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Zap size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Live Platform Stats</Text>
          </View>
          {loading ? (
            <StatSkeleton />
          ) : (
            <View style={styles.statsGrid}>
              <StatCard title="Total Users" value={stats?.totalUsers} icon={Users} color={colors.primary} trend="+8.4%" />
              <StatCard title="Active Today" value={stats?.activeUsersToday} icon={Activity} color="#10B981" trend="Live" />
              <StatCard title="New Signups" value={stats?.newRegistrations} icon={UserCheck} color="#38BDF8" trend="+12" />
              <StatCard title="Today's Revenue" value={`₦${(stats?.revenueToday || 0).toLocaleString()}`} icon={DollarSign} color="#F59E0B" trend="24h" />
              <StatCard title="Pending Review" value={stats?.materialsPending} icon={FileText} color="#6366F1" />
              <StatCard title="Flagged Items" value={stats?.flaggedContent} icon={AlertTriangle} color="#EF4444" />
              <StatCard title="AI Token Usage" value={stats?.aiRequestsToday} icon={Cpu} color="#8B5CF6" trend="High" />
            </View>
          )}
        </View>

        {/* System Telemetry & Service Status */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Server size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>System Telemetry</Text>
          </View>
          <View style={styles.healthCard}>
            {loading ? (
              <View style={styles.healthList}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.healthItem}>
                    <Skeleton width={32} height={32} borderRadius={8} />
                    <Skeleton width={100} height={14} style={{ marginLeft: 12 }} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.healthList}>
                {health &&
                  Object.entries(health).map(([service, status]) => (
                    <HealthItem key={service} name={service} status={status as any} />
                  ))}
              </View>
            )}
          </View>
        </View>

        {/* Recent Registrations Feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Clock size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Recent Signups</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("UserManagement")} style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>VIEW ALL</Text>
              <ChevronRight size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.activityCard}>
            {loading ? (
              [1, 2, 3].map((i) => (
                <View key={i} style={styles.activityItem}>
                  <Skeleton width={36} height={36} borderRadius={18} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Skeleton width="60%" height={14} />
                    <Skeleton width="35%" height={10} style={{ marginTop: 6 }} />
                  </View>
                </View>
              ))
            ) : (
              activity?.recentRegistrations.slice(0, 5).map((user: any, index: number) => (
                <TouchableOpacity
                  key={user.id || index}
                  style={styles.activityItem}
                  onPress={() => navigation.navigate("UserManagement")}
                  activeOpacity={0.7}
                >
                  <View style={styles.activityIcon}>
                    <Avatar name={user.name} size={36} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityName} numberOfLines={1}>{user.name}</Text>
                    <View style={styles.activitySubRow}>
                      <Clock size={11} color={colors.textMuted} />
                      <Text style={styles.activityTime}>{formatRelativeTime(user.created_at)}</Text>
                    </View>
                  </View>
                  <View style={styles.signupTag}>
                    <Text style={styles.signupTagText}>NEW USER</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../../theme/colors").darkPalette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(34, 197, 94, 0.25)",
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    fontWeight: "700",
    color: colors.primary,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter-Regular",
    color: colors.textSecondary,
    marginBottom: 18,
  },
  shortcutsRow: {
    flexDirection: "row",
    gap: 8,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    minHeight: 115,
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  trendText: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
    marginTop: 10,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 2,
  },
  healthCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  healthList: {
    gap: 12,
  },
  healthItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  healthItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  healthIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  healthName: {
    fontSize: 12,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
  },
  healthSub: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 1,
  },
  healthStatusRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
    fontWeight: "700",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
    fontWeight: "700",
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityIcon: {
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  activitySubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  activityTime: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
  },
  signupTag: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  signupTagText: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
    fontWeight: "700",
  },
});


