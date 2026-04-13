import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminDashboardStats, AdminDashboardActivity, AdminSystemHealth } from "../../../services/adminService";
import { Users, FileText, AlertTriangle, Cpu, DollarSign, ChevronRight } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";

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
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card style={styles.statCard}>
      <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.sm }]}>{title}</Text>
      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.xs }]}>{value}</Text>
    </Card>
  );

  if (loading) {
    return (
      <Screen title="Admin Dashboard">
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Admin Dashboard" scrollable>
      <View style={styles.section}>
        <Text style={[typography.h4, { marginBottom: spacing.md }]}>Platform Stats</Text>
        <View style={styles.statsGrid}>
          <StatCard title="Active Users" value={stats?.activeUsersToday} icon={Users} color={colors.primary} />
          <StatCard title="New Signups" value={stats?.newRegistrations} icon={Users} color="#10B981" />
          <StatCard title="Revenue (N)" value={stats?.revenueToday} icon={DollarSign} color="#F59E0B" />
          <StatCard title="Pending" value={stats?.materialsPending} icon={FileText} color="#6366F1" />
          <StatCard title="Flagged" value={stats?.flaggedContent} icon={AlertTriangle} color="#EF4444" />
          <StatCard title="AI Requests" value={stats?.aiRequestsToday} icon={Cpu} color="#8B5CF6" />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={typography.h4}>Recent Registrations</Text>
          <TouchableOpacity onPress={() => navigation.navigate("UserManagement")}>
            <Text style={{ color: colors.primary }}>View All</Text>
          </TouchableOpacity>
        </View>
        {activity?.recentRegistrations.map((user: any, index: number) => (
          <TouchableOpacity key={index} style={[styles.activityItem, { borderBottomWidth: index === 4 ? 0 : 1, borderBottomColor: colors.border }]}>
            <View>
              <Text style={[typography.body, { fontWeight: "600" }]}>{user.name}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{user.university} - {user.department}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={typography.h4}>Flagged Materials</Text>
          <TouchableOpacity onPress={() => navigation.navigate("ContentModeration")}>
            <Text style={{ color: colors.primary }}>Review Queue</Text>
          </TouchableOpacity>
        </View>
        {activity?.recentFlagged.length === 0 ? (
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>No flagged materials.</Text>
        ) : (
          activity?.recentFlagged.map((item: any, index: number) => (
            <TouchableOpacity key={index} style={[styles.activityItem, { borderBottomWidth: index === activity.recentFlagged.length - 1 ? 0 : 1, borderBottomColor: colors.border }]}>
              <View>
                <Text style={[typography.body, { fontWeight: "600" }]}>{item.title}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.course_code}</Text>
              </View>
              <ChevronRight size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={[styles.section, { marginBottom: spacing.xl }]}>
        <Text style={[typography.h4, { marginBottom: spacing.md }]}>System Health</Text>
        <View style={styles.healthGrid}>
          {health && Object.entries(health).map(([service, status]) => (
            <View key={service} style={styles.healthItem}>
              <View style={[styles.statusDot, { backgroundColor: status === "online" ? "#10B981" : "#EF4444" }]} />
              <Text style={[typography.body, { textTransform: "capitalize" }]}>{service}</Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    padding: 16,
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
    width: "48%",
    padding: 16,
    marginBottom: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  activityItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  healthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  healthItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "33%",
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
});
