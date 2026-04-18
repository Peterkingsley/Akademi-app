import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from "lucide-react-native";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";

export const FinancialManagementScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [overviewData, webhookData] = await Promise.all([
        adminService.getFinanceOverview(),
        adminService.getPaystackWebhookLogs()
      ]);
      setOverview(overviewData);
      setWebhooks(webhookData);
    } catch (error) {
      console.error("Failed to fetch finance data", error);
    } finally {
      setLoading(false);
    }
  };

  const FinanceCard = ({ title, amount, trend, trendValue }: any) => (
    <Card style={styles.financeCard}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{title}</Text>
      <View style={styles.amountRow}>
        <Text style={[typography.h3, { color: colors.textPrimary, fontWeight: '700' }]}>
          ₦{amount?.toLocaleString() || "0"}
        </Text>
        <View style={[styles.trendBadge, { backgroundColor: trend === 'up' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
          {trend === 'up' ? <ArrowUpRight size={12} color="#10B981" /> : <ArrowDownRight size={12} color="#EF4444" />}
          <Text style={[typography.caption, { color: trend === 'up' ? "#10B981" : "#EF4444", fontWeight: '700', marginLeft: 2 }]}>
            {trendValue}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <Screen title="Financial Management" scrollable>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.grid}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} width="48%" height={100} borderRadius={16} />)}
          </View>
        ) : (
          <View style={styles.grid}>
            <FinanceCard title="TOTAL REVENUE" amount={overview?.totalRevenue} trend="up" trendValue="+14%" />
            <FinanceCard title="MONTHLY" amount={overview?.monthlyRevenue} trend="up" trendValue="+8%" />
            <FinanceCard title="WEEKLY" amount={overview?.weeklyRevenue} trend="down" trendValue="-2%" />
            <FinanceCard title="DAILY" amount={overview?.todayRevenue} trend="up" trendValue="+24%" />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>WEBHOOK EVENT LOGS</Text>
          <Card style={styles.logCard}>
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} width="100%" height={60} style={{ marginVertical: 8 }} />)
            ) : (
              webhooks.map((log) => (
                <View key={log.id} style={[styles.logEntry, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.logHeader}
                    onPress={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.logTitleRow}>
                        <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: '700', fontFamily: 'SpaceMono_400Regular' }]}>
                          {log.event_type}
                        </Text>
                        <Badge
                          label={log.status}
                          variant={log.status === 'processed' ? 'success' : 'error'}
                          size="small"
                          style={{ marginLeft: 8 }}
                        />
                      </View>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                        Ref: {log.reference} • {new Date(log.created_at).toLocaleTimeString()}
                      </Text>
                    </View>
                    {expandedLog === log.id ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
                  </TouchableOpacity>

                  {expandedLog === log.id && (
                    <View style={[styles.logPayload, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.payloadText, { color: colors.textPrimary }]}>
                        {JSON.stringify(JSON.parse(log.payload), null, 2)}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </Card>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  financeCard: {
    width: "48%",
    padding: 16,
    marginBottom: 4,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  section: {
    marginTop: 32,
    marginBottom: 40,
  },
  logCard: {
    padding: 0,
    overflow: 'hidden',
  },
  logEntry: {
    borderBottomWidth: 1,
  },
  logHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logPayload: {
    padding: 12,
    margin: 16,
    marginTop: 0,
    borderRadius: 8,
  },
  payloadText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    lineHeight: 16,
  }
});
