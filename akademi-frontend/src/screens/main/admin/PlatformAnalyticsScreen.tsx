import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { LineChart } from "react-native-chart-kit";
import { Card } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/Skeleton";
import { TrendingUp, Users } from "lucide-react-native";

const { width } = Dimensions.get("window");

export const PlatformAnalyticsScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await adminService.getOverviewAnalytics();
      setOverview(data);
    } catch (error) {
      console.error("Failed to fetch analytics", error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    color: (opacity = 1) => colors.primary,
    labelColor: (opacity = 1) => colors.textSecondary,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: colors.primary
    }
  };

  const growthData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        data: [20, 45, 28, 80, 99, 43, 50],
        color: (opacity = 1) => `rgba(91, 110, 245, ${opacity})`,
        strokeWidth: 2
      }
    ]
  };

  const retentionData = [
    { day: "D0", rate: "100%" },
    { day: "D1", rate: "45%" },
    { day: "D3", rate: "30%" },
    { day: "D7", rate: "20%" },
    { day: "D14", rate: "15%" },
    { day: "D30", rate: "10%" },
  ];

  return (
    <Screen title="Platform Analytics" scrollable>
      <View style={styles.container}>
        <View style={styles.statsRow}>
          <MetricCard title="Total Students" value={overview?.totalStudents || "0"} icon={Users} color={colors.primary} />
          <MetricCard title="Active (MAU)" value={overview?.mau || "0"} icon={TrendingUp} color="#10B981" />
        </View>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>USER GROWTH (7 DAYS)</Text>
          <Card style={styles.chartCard}>
            {loading ? (
              <Skeleton width={width - 64} height={220} borderRadius={16} />
            ) : (
              <LineChart
                data={growthData}
                width={width - 64}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>RETENTION COHORTS</Text>
          <Card style={styles.cohortCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.cohortTable}>
                <View style={[styles.cohortHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.cohortCol, typography.caption, { color: colors.textMuted }]}>COHORT</Text>
                  {retentionData.map(d => (
                    <Text key={d.day} style={[styles.cohortCol, typography.caption, { color: colors.textMuted }]}>{d.day}</Text>
                  ))}
                </View>
                <View style={styles.cohortRow}>
                   <Text style={[styles.cohortCol, typography.bodySmall, { color: colors.textPrimary, fontWeight: '700' }]}>All Users</Text>
                   {retentionData.map(d => (
                     <View key={d.day} style={[styles.cohortCol, styles.heatCell, { backgroundColor: colors.primary + (parseInt(d.rate) > 50 ? '40' : '15') }]}>
                        <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '600' }]}>{d.rate}</Text>
                     </View>
                   ))}
                </View>
              </View>
            </ScrollView>
          </Card>
        </View>

        <View style={styles.section}>
           <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>TOP PERFORMING FEATURES</Text>
           <FeatureRow name="Assignment Solver" usage="42%" trend="+12%" />
           <FeatureRow name="Mock Exams" usage="28%" trend="+5%" />
           <FeatureRow name="Tutor Chat" usage="15%" trend="-2%" />
           <FeatureRow name="Library" usage="10%" trend="+1%" />
        </View>
      </View>
    </Screen>
  );
};

const MetricCard = ({ title, value, icon: Icon, color }: any) => {
  const { colors, typography } = useTheme();
  return (
    <Card style={styles.metricCard}>
      <View style={[styles.iconBox, { backgroundColor: color + "15" }]}>
        <Icon size={18} color={color} />
      </View>
      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{title}</Text>
      <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 2, fontWeight: '700' }]}>{value}</Text>
    </Card>
  );
};

const FeatureRow = ({ name, usage, trend }: any) => {
  const { colors, typography } = useTheme();
  const isUp = trend.startsWith("+");
  return (
    <View style={[styles.featureRow, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600' }]}>{name}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{usage} of total sessions</Text>
      </View>
      <Text style={[typography.bodySmall, { color: isUp ? "#10B981" : "#EF4444", fontWeight: '700' }]}>
        {trend}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    padding: 16,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: 32,
  },
  chartCard: {
    padding: 16,
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  cohortCard: {
    padding: 0,
    overflow: 'hidden',
  },
  cohortTable: {
    padding: 16,
  },
  cohortHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  cohortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  cohortCol: {
    width: 80,
    textAlign: 'center',
  },
  heatCell: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginHorizontal: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  }
});
