import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminRateLimitMonitoring, AdminSystemHealth } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Cpu, Zap, Activity, RefreshCcw, HardDrive, Server, Globe, Database, Gauge, Ban, Clock3, Siren, TriangleAlert } from "lucide-react-native";
import { Badge } from "../../../components/ui/Badge";

export const SystemMonitoringScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [aiData, setAiData] = useState<any>(null);
  const [healthData, setHealthData] = useState<AdminSystemHealth | null>(null);
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
    const color =
      status === 'online'
        ? '#304000'
        : status === 'degraded'
          ? '#F59E0B'
          : status === 'disabled'
            ? colors.textMuted
            : '#EF4444';
    const backgroundColor =
      status === 'online'
        ? 'rgba(34, 197, 94, 0.05)'
        : status === 'degraded'
          ? 'rgba(245, 158, 11, 0.05)'
          : status === 'disabled'
            ? 'rgba(113, 113, 122, 0.08)'
            : 'rgba(239, 68, 68, 0.05)';
    return (
      <View style={[styles.healthRow, { backgroundColor, borderBottomColor: colors.border }]}>
        <View style={[styles.healthIcon, { backgroundColor }]}>
          <Icon size={18} color={color} />
        </View>
        <Text style={[typography.body, { flex: 1, color: colors.textPrimary, textTransform: 'capitalize' }]}>{name}</Text>
        <View style={styles.statusBox}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[typography.caption, { color, fontWeight: '700' }]}>
            {status.toUpperCase()}
          </Text>
        </View>
      </View>
    );
  };

  const dependencyRows = useMemo(() => {
    if (!healthData?.dependencies) return [];
    return [
      { name: "Main API", status: healthData.dependencies.api.status, icon: Server, detail: healthData.dependencies.api.detail },
      { name: "Postgres DB", status: healthData.dependencies.database.status, icon: Database, detail: healthData.dependencies.database.detail },
      { name: "Redis Cache", status: healthData.dependencies.redis.status, icon: Activity, detail: healthData.dependencies.redis.detail },
      { name: "Inline Queue", status: healthData.dependencies.queue.status, icon: RefreshCcw, detail: healthData.dependencies.queue.detail },
      { name: "Typesense", status: healthData.dependencies.typesense.status, icon: HardDrive, detail: healthData.dependencies.typesense.detail },
      { name: "Gemini API", status: healthData.dependencies.gemini.status, icon: Cpu, detail: healthData.dependencies.gemini.detail },
      { name: "WebSocket", status: healthData.dependencies.websocket.status, icon: Zap, detail: healthData.dependencies.websocket.detail },
      { name: "Object Store (R2)", status: healthData.dependencies.r2.status, icon: Globe, detail: healthData.dependencies.r2.detail },
    ];
  }, [healthData]);

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
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>GEMINI AI MONITOR (TODAY)</Text>
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
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>ABUSE ALERTS</Text>
          <Card style={styles.alertsCard}>
            {rateLimitData?.alerts?.length ? (
              rateLimitData.alerts.map((alert, index) => {
                const isHigh = alert.severity === "high";
                return (
                  <View
                    key={alert.id}
                    style={[
                      styles.alertRow,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: isHigh ? "rgba(239, 68, 68, 0.08)" : "rgba(245, 158, 11, 0.08)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.alertIcon,
                        { backgroundColor: isHigh ? "rgba(239, 68, 68, 0.16)" : "rgba(245, 158, 11, 0.16)" },
                      ]}
                    >
                      {isHigh ? <Siren size={18} color="#EF4444" /> : <TriangleAlert size={18} color="#F59E0B" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.alertHeaderRow}>
                        <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700", flex: 1 }]}>
                          {alert.title}
                        </Text>
                        <Badge label={alert.severity} variant={isHigh ? "error" : "warning"} />
                      </View>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                        {alert.message}
                      </Text>
                      <View style={styles.alertMetaRow}>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          {alert.windowMinutes}m window
                        </Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          count {alert.count}
                        </Text>
                        {alert.target ? (
                          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                            target {truncateMiddle(alert.target, 16)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.alertsEmptyState}>
                <View style={[styles.alertIcon, { backgroundColor: "rgba(34, 197, 94, 0.12)" }]}>
                  <Activity size={18} color="#304000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>No abuse alerts right now</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                    Rate limiting is active, but nothing is spiking hard enough to raise an alert yet.
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>SERVICE HEALTH CHECK</Text>
          <Card style={styles.healthCard}>
            <View style={styles.healthHeaderRow}>
              <Badge label={healthData?.status || "UNKNOWN"} variant={healthData?.status === "OK" ? "success" : healthData?.status === "DEGRADED" ? "warning" : "error"} />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {healthData?.ready ? "Ready for traffic" : "Not ready for traffic"}
              </Text>
            </View>
            {dependencyRows.map((row) => (
              <View key={row.name}>
                <HealthRow name={row.name} status={row.status} icon={row.icon} />
                {row.detail ? (
                  <Text style={[typography.caption, styles.healthDetail, { color: colors.textSecondary }]}>
                    {row.detail}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>RECOVERY POSTURE</Text>
          <Card style={styles.recoveryCard}>
            <View style={styles.recoveryBlock}>
              <Text style={[typography.body, styles.recoveryTitle, { color: colors.textPrimary }]}>Database backup expectations</Text>
              {(healthData?.recovery.databaseBackups || []).map((item, index) => (
                <Text key={`db-${index}`} style={[typography.caption, styles.recoveryBullet, { color: colors.textSecondary }]}>
                  • {item}
                </Text>
              ))}
            </View>
            <View style={styles.recoveryBlock}>
              <Text style={[typography.body, styles.recoveryTitle, { color: colors.textPrimary }]}>Storage backup assumptions</Text>
              {(healthData?.recovery.storageBackups || []).map((item, index) => (
                <Text key={`storage-${index}`} style={[typography.caption, styles.recoveryBullet, { color: colors.textSecondary }]}>
                  • {item}
                </Text>
              ))}
            </View>
            <View style={styles.recoveryBlock}>
              <Text style={[typography.body, styles.recoveryTitle, { color: colors.textPrimary }]}>Restore plan</Text>
              {(healthData?.recovery.restorePlan || []).map((item, index) => (
                <Text key={`restore-${index}`} style={[typography.caption, styles.recoveryBullet, { color: colors.textSecondary }]}>
                  {index + 1}. {item}
                </Text>
              ))}
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>SCALING POSTURE</Text>
          <Card style={styles.recoveryCard}>
            <View style={styles.healthHeaderRow}>
              <Badge
                label={healthData?.scaling.horizontalReady ? "HORIZONTAL READY" : "NOT READY"}
                variant={healthData?.scaling.horizontalReady ? "success" : "warning"}
              />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {healthData?.scaling.serviceType || "unknown"} service
              </Text>
            </View>

            <View style={styles.recoveryBlock}>
              <Text style={[typography.body, styles.recoveryTitle, { color: colors.textPrimary }]}>Topology details</Text>
              <Text style={[typography.caption, styles.recoveryBullet, { color: colors.textSecondary }]}>
                • Socket transport: {healthData?.scaling.websocketTransportMode || "unknown"}
              </Text>
              <Text style={[typography.caption, styles.recoveryBullet, { color: colors.textSecondary }]}>
                • Websocket Redis adapter: {healthData?.scaling.websocketRedisAdapterEnabled ? "enabled" : "disabled"}
              </Text>
              <Text style={[typography.caption, styles.recoveryBullet, { color: colors.textSecondary }]}>
                • Scheduler mode: {healthData?.scaling.schedulerMode || "unknown"}
              </Text>
            </View>

            {!!healthData?.scaling.blockers?.length && (
              <View style={styles.recoveryBlock}>
                <Text style={[typography.body, styles.recoveryTitle, { color: colors.textPrimary }]}>Scaling blockers</Text>
                {healthData.scaling.blockers.map((item, index) => (
                  <Text key={`blocker-${index}`} style={[typography.caption, styles.recoveryBullet, { color: "#F59E0B" }]}>
                    • {item}
                  </Text>
                ))}
              </View>
            )}

            {!!healthData?.scaling.warnings?.length && (
              <View style={styles.recoveryBlock}>
                <Text style={[typography.body, styles.recoveryTitle, { color: colors.textPrimary }]}>Warnings</Text>
                {healthData.scaling.warnings.map((item, index) => (
                  <Text key={`warning-${index}`} style={[typography.caption, styles.recoveryBullet, { color: colors.textSecondary }]}>
                    • {item}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.recoveryBlock}>
              <Text style={[typography.body, styles.recoveryTitle, { color: colors.textPrimary }]}>Recommendations</Text>
              {(healthData?.scaling.recommendations || []).map((item, index) => (
                <Text key={`recommendation-${index}`} style={[typography.caption, styles.recoveryBullet, { color: colors.textSecondary }]}>
                  {index + 1}. {item}
                </Text>
              ))}
            </View>
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
  alertsCard: {
    padding: 0,
    overflow: "hidden",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  alertsEmptyState: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  alertHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alertMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    flexWrap: "wrap",
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
  healthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  healthDetail: {
    paddingHorizontal: 60,
    paddingBottom: 12,
    marginTop: -4,
  },
  recoveryCard: {
    padding: 16,
  },
  recoveryBlock: {
    marginBottom: 16,
  },
  recoveryTitle: {
    fontWeight: "700",
    marginBottom: 8,
  },
  recoveryBullet: {
    marginBottom: 6,
    lineHeight: 18,
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

