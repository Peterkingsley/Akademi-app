import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ViewStyle } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminDashboardStats, AdminDashboardActivity, AdminSystemHealth } from "../../../services/adminService";
import { Users, FileText, AlertTriangle, Cpu, DollarSign, ChevronRight, Activity, Database, Server, Globe, MessageSquare, HardDrive, Clock } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Avatar } from "../../../components/ui/Avatar";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

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
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<StackNavigationProp<AdminStackParamList>>();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [activity, setActivity] = useState<AdminDashboardActivity | null>(null);
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

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
      setTimeout(() => setLoading(false), 500);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card style={StyleSheet.flatten([styles.statCard, { width: CARD_WIDTH, borderColor: colors.border }])}>
      <View style={[styles.iconContainer, { backgroundColor: color + "15" }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.sm }]}>{title}</Text>
      <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs, fontWeight: "700" }]}>{value ?? 0}</Text>
    </Card>
  );

  const StatSkeleton = () => (
    <View style={styles.statsGrid}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={[styles.statCard, { width: CARD_WIDTH, height: 120, backgroundColor: colors.surface, borderRadius: 12, padding: 16 }]}>
          <Skeleton width={36} height={36} borderRadius={8} />
          <Skeleton width="60%" height={14} style={{ marginTop: 16 }} />
          <Skeleton width="40%" height={24} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );

  const HealthItem = ({ name, status }: { name: string, status: 'online' | 'offline' }) => {
    return (
      <View style={styles.healthItem}>
        <View style={[styles.statusDot, { backgroundColor: status === "online" ? "#304000" : "#EF4444" }]} />
        <Text style={[typography.bodySmall, { textTransform: "capitalize", color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
      </View>
    );
  };

  const ActivityRow = ({ user, type, time }: any) => (
    <TouchableOpacity
      style={[styles.activityItem, { borderBottomColor: colors.border }]}
      onPress={() => navigation.navigate("UserManagement")}
    >
      <View style={styles.activityIcon}>
        <Avatar name={user.name} size={32} />
      </View>
      <View style={styles.activityContent}>
        <Text style={[typography.body, { fontWeight: "600", color: colors.textPrimary }]}>
          {type}: {user.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <Clock size={12} color={colors.textSecondary} />
          <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>{time}</Text>
        </View>
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <Screen title="Command Center" scrollable>
      <View style={styles.section}>
        <Text style={[typography.label, { marginBottom: spacing.md, color: colors.textMuted }]}>LIVE PLATFORM STATS - TODAY</Text>
        {loading ? (
          <StatSkeleton />
        ) : (
          <View style={styles.statsGrid}>
            <StatCard title="Total Users" value={stats?.totalUsers} icon={Users} color={colors.primary} />
            <StatCard title="Active Today" value={stats?.activeUsersToday} icon={Activity} color="#10B981" />
            <StatCard title="New Signups" value={stats?.newRegistrations} icon={Users} color="#38BDF8" />
            <StatCard title="Revenue" value={`NGN ${(stats?.revenueToday || 0).toLocaleString()}`} icon={DollarSign} color="#F59E0B" />
            <StatCard title="Pending Review" value={stats?.materialsPending} icon={FileText} color="#6366F1" />
            <StatCard title="Flagged Content" value={stats?.flaggedContent} icon={AlertTriangle} color="#EF4444" />
            <StatCard title="AI Requests" value={stats?.aiRequestsToday} icon={Cpu} color="#8B5CF6" />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[typography.label, { marginBottom: spacing.md, color: colors.textMuted }]}>SYSTEM HEALTH</Text>
        <Card style={styles.healthCard}>
          {loading ? (
            <View style={styles.healthGrid}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.healthItem}>
                   <Skeleton width={8} height={8} borderRadius={4} style={{ marginRight: 8 }} />
                   <Skeleton width={50} height={12} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.healthGrid}>
              {health && Object.entries(health).map(([service, status]) => (
                <HealthItem key={service} name={service} status={status as any} />
              ))}
            </View>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.label, { color: colors.textMuted }]}>RECENT ACTIVITY</Text>
          <TouchableOpacity onPress={() => navigation.navigate("UserManagement")} style={styles.viewAllButton}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: "600" }]}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>
        <Card style={styles.activityCard}>
          {loading ? (
            [1, 2, 3].map((i) => (
              <View key={i} style={[styles.activityItem, { borderBottomWidth: i === 3 ? 0 : 1, borderBottomColor: colors.border }]}>
                <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="70%" height={14} />
                  <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
                </View>
              </View>
            ))
          ) : (
            activity?.recentRegistrations.slice(0, 5).map((user: any, index: number) => (
              <TouchableOpacity
                key={user.id || index}
                style={[styles.activityItem, { borderBottomColor: colors.border }]}
                onPress={() => navigation.navigate("UserManagement")}
              >
                <View style={styles.activityIcon}>
                  <Avatar name={user.name} size={32} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={[typography.body, { fontWeight: "600", color: colors.textPrimary }]}>
                    New signup: {user.name}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                    <Clock size={12} color={colors.textSecondary} />
                    <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
                      {formatRelativeTime(user.created_at)}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  healthCard: {
    padding: 16,
    elevation: 0,
    shadowOpacity: 0,
    borderWidth: 1,
  },
  healthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  healthItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "33.3%",
    marginBottom: 16,
    minHeight: 44, // Accessibility
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  activityCard: {
    padding: 0,
    overflow: "hidden",
    elevation: 0,
    shadowOpacity: 0,
    borderWidth: 1,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  activityIcon: {
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  viewAllButton: {
    padding: 4,
    minHeight: 44,
    justifyContent: "center",
  }
});

