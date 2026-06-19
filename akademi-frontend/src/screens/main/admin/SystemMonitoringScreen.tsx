import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminRateLimitMonitoring } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Cpu, Zap, Activity, RefreshCcw, HardDrive, Server, Globe, Database, Gauge, Ban, Clock3 } from "lucide-react-native";
import { Badge } from "../../../components/ui/Badge";

export const SystemMonitoringScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [aiData, setAiData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [rateLimitData, setRateLimitData] = useState<AdminRateLimitMonitoring | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ai, health, jobsList, rateLimits] = await Promise.all([
        adminService.getAIMonitoring(),
        adminService.getHealthMonitoring(),
        adminService.getJobsMonitoring(),
        adminService.getRateLimitMonitoring(),
      ]);
      setAiData(ai);
      setHealthData(health);
      setJobs(jobsList);
      setRateLimitData(rateLimits);
    } catch (error) {
      console.error("Failed to fetch monitoring data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryJob = async (name: string) => {
    try {
      await adminService.retryJob(name);
      Alert.alert("Success", `Job ${name} has been retried.`);
      fetchData();
    } catch (error) {
      Alert.alert("Error", "Failed to retry job");
    }
  };

  const HealthRow = ({ name, status, icon: Icon }: any) => {
    const isOffline = status === 'offline';
    return (
      <View style={[styles.healthRow, isOffline && { backgroundColor: 'rgba(239, 68, 68, 0.05)' }, { borderBottomColor: colors.border }]}>
        <View style={[styles.healthIcon, { backgroundColor: isOffline ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)' }]}>
          <Icon size={18} color={isOffline ? '#EF4444' : '#22C55E'} />
        </View>
        <Text style={[typography.body, { flex: 1, color: colors.textPrimary, textTransform: 'capitalize' }]}>{name}</Text>
        <View style={styles.statusBox}>
          <View style={[styles.statusDot, { backgroundColor: isOffline ? '#EF4444' : '#22C55E' }]} />
          <Text style={[typography.caption, { color: isOffline ? '#EF4444' : '#22C55E', fontWeight: '700' }]}>
            {status.toUpperCase()}
          </Text>
        </View>
      </View>
    );
  };

  const formatTimestamp = (value?: string) => {
    if (!value) return "Unknown time";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const truncateMiddle = (value?: string | null, max = 18) => {
    if (!value) return "Unknown";
    if (value.length <= max) return value;
    const keep = Math.max(4, Math.floor((max - 3) / 2));
    return `${value.slice(0, keep)}...${value.slice(-keep)}`;
  };

  return (
    <Screen title="System Monitoring" scrollable refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}>
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>CLAUDE AI MONITOR (TODAY)</Text>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Cpu size={20} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 8, fontWeight: '700' }]}>
                {aiData?.totalCallsToday || 0}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>API Calls</Text>
            </Card>
            <Card style={styles.statCard}>
              <Zap size={20} color="#F59E0B" />
              <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 8, fontWeight: '700' }]}>
                ${aiData?.estimatedCostToday?.toFixed(2) || "0.00"}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Est. Cost (USD)</Text>
            </Card>
          </View>
          <Card style={styles.tokenCard}>
            <View style={styles.tokenRow}>
               <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600' }]}>Live Token Counter</Text>
               <Text style={[typography.body, { color: colors.primary, fontWeight: '700' }]}>{aiData?.totalTokensToday?.toLocaleString() || 0}</Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: colors.surface }]}>
              <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: '65%' }]} />
            </View>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>65% of daily soft limit reached</Text>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>SERVICE HEALTH CHECK</Text>
          <Card style={styles.healthCard}>
            <HealthRow name="Main API" status={healthData?.api || 'online'} icon={Server} />
            <HealthRow name="Postgres DB" status={healthData?.database || 'online'} icon={Database} />
            <HealthRow name="Redis Cache" status={healthData?.redis || 'online'} icon={Activity} />
            <HealthRow name="Typesense" status={healthData?.typesense || 'online'} icon={HardDrive} />
            <HealthRow name="Claude API" status={healthData?.claude || 'online'} icon={Cpu} />
            <HealthRow name="Object Store (R2)" status={healthData?.r2 || 'online'} icon={Globe} />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>RATE LIMIT PRESSURE</Text>
          <Card style={styles.rateLimitCard}>
            <View style={styles.rateLimitHeader}>
              <View style={[styles.rateLimitIcon, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                <Ban size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>Blocked request activity</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  See which routes or socket events are hitting protection first.
                </Text>
              </View>
              <Badge
                label={rateLimitData?.persistence === "redis" ? "Redis" : "Memory"}
                variant={rateLimitData?.persistence === "redis" ? "success" : "warning"}
              />
            </View>

            <View style={styles.rateLimitStatsRow}>
              <View style={[styles.rateLimitStatBox, { backgroundColor: colors.surface }]}>
                <Gauge size={16} color={colors.primary} />
                <Text style={[typography.h3, styles.rateLimitStatValue, { color: colors.textPrimary }]}>
                  {rateLimitData?.totalRecorded ?? 0}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>blocked events</Text>
              </View>
              <View style={[styles.rateLimitStatBox, { backgroundColor: colors.surface }]}>
                <Clock3 size={16} color="#38BDF8" />
                <Text style={[typography.h3, styles.rateLimitStatValue, { color: colors.textPrimary }]}>
                  {rateLimitData?.recent?.length ?? 0}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>recent samples</Text>
              </View>
            </View>

            <View style={styles.rateLimitColumns}>
              <View style={styles.rateLimitColumn}>
                <Text style={[typography.caption, styles.rateLimitSubheading, { color: colors.textMuted }]}>TOP ROUTES</Text>
                {(rateLimitData?.topRoutes?.slice(0, 3) ?? []).map((item, index) => (
                  <View key={`${item.routeOrEvent}-${index}`} style={[styles.rateLimitRow, { borderBottomColor: colors.border }]}>
                    <Text style={[typography.caption, { flex: 1, color: colors.textPrimary }]} numberOfLines={1}>
                      {item.routeOrEvent}
                    </Text>
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: "700" }]}>{item.count}</Text>
                  </View>
                ))}
                {!rateLimitData?.topRoutes?.length && (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>No blocked routes yet.</Text>
                )}
              </View>

              <View style={styles.rateLimitColumn}>
                <Text style={[typography.caption, styles.rateLimitSubheading, { color: colors.textMuted }]}>TOP OFFENDERS</Text>
                {(rateLimitData?.topUsers?.slice(0, 2) ?? []).map((item, index) => (
                  <View key={`${item.userId}-${index}`} style={[styles.rateLimitRow, { borderBottomColor: colors.border }]}>
                    <Text style={[typography.caption, { flex: 1, color: colors.textPrimary }]} numberOfLines={1}>
                      {truncateMiddle(item.userId, 16)}
                    </Text>
                    <Text style={[typography.caption, { color: "#F59E0B", fontWeight: "700" }]}>{item.count}</Text>
                  </View>
                ))}
                {!rateLimitData?.topUsers?.length &&
                  (rateLimitData?.topIps?.slice(0, 2) ?? []).map((item, index) => (
                    <View key={`${item.ip}-${index}`} style={[styles.rateLimitRow, { borderBottomColor: colors.border }]}>
                      <Text style={[typography.caption, { flex: 1, color: colors.textPrimary }]} numberOfLines={1}>
                        {truncateMiddle(item.ip, 16)}
                      </Text>
                      <Text style={[typography.caption, { color: "#F59E0B", fontWeight: "700" }]}>{item.count}</Text>
                    </View>
                  ))}
                {!rateLimitData?.topUsers?.length && !rateLimitData?.topIps?.length && (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>No offenders yet.</Text>
                )}
              </View>
            </View>

            <View style={styles.rateLimitRecentBlock}>
              <Text style={[typography.caption, styles.rateLimitSubheading, { color: colors.textMuted }]}>LATEST BLOCKS</Text>
              {(rateLimitData?.recent?.slice(0, 3) ?? []).map((item, index) => (
                <View key={`${item.timestamp}-${index}`} style={[styles.rateLimitRecentRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "600" }]} numberOfLines={1}>
                      {item.transport.toUpperCase()} • {item.routeOrEvent}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                      retry after {item.retryAfterSeconds}s • {formatTimestamp(item.timestamp)}
                    </Text>
                  </View>
                  <Badge label={item.transport} variant={item.transport === "socket" ? "warning" : "blue"} />
                </View>
              ))}
              {!rateLimitData?.recent?.length && (
                <Text style={[typography.caption, { color: colors.textSecondary }]}>No recent throttling events recorded.</Text>
              )}
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>BACKGROUND JOBS</Text>
          <Card style={styles.jobsCard}>
            {jobs.map((job, index) => (
              <View key={index} style={[styles.jobRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600' }]}>{job.name}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Last run: {new Date(job.lastRun).toLocaleTimeString()} • {job.duration}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Badge
                    label={job.status}
                    variant={job.status === 'success' ? 'success' : 'error'}
                  />
                  <TouchableOpacity
                    style={[styles.retryBtn, { borderColor: colors.border }]}
                    onPress={() => handleRetryJob(job.name)}
                  >
                    <RefreshCcw size={14} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
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
  section: {
    marginBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
  },
  tokenCard: {
    padding: 16,
  },
  rateLimitCard: {
    padding: 16,
  },
  rateLimitHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  rateLimitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rateLimitStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  rateLimitStatBox: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
  },
  rateLimitStatValue: {
    marginTop: 8,
    marginBottom: 2,
    fontWeight: "700",
  },
  rateLimitColumns: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  rateLimitColumn: {
    flex: 1,
  },
  rateLimitSubheading: {
    marginBottom: 8,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  rateLimitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  rateLimitRecentBlock: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 16,
  },
  rateLimitRecentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  healthCard: {
    padding: 0,
    overflow: 'hidden',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  healthIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  jobsCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 40,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  retryBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  }
});
