import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Alert, ScrollView } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminRateLimitMonitoring, AdminSystemHealth } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Cpu, Zap, Activity, RefreshCcw, HardDrive, Server, Globe, Database, Gauge, Ban, Clock3, Siren, TriangleAlert, RotateCw, ShieldCheck } from "lucide-react-native";
import { Badge } from "../../../components/ui/Badge";
import { LinearGradient } from "expo-linear-gradient";

export const SystemMonitoringScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      status === "online"
        ? "#22C55E"
        : status === "degraded"
        ? "#F59E0B"
        : status === "disabled"
        ? colors.textMuted
        : "#EF4444";

    const backgroundColor =
      status === "online"
        ? "rgba(34, 197, 94, 0.12)"
        : status === "degraded"
        ? "rgba(245, 158, 11, 0.12)"
        : status === "disabled"
        ? "rgba(113, 113, 122, 0.12)"
        : "rgba(239, 68, 68, 0.12)";

    return (
      <View style={styles.healthRow}>
        <View style={[styles.healthIcon, { backgroundColor }]}>
          <Icon size={16} color={color} />
        </View>
        <Text style={styles.healthName}>{name}</Text>
        <View style={styles.statusBox}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>{status.toUpperCase()}</Text>
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
    <Screen style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={colors.primary} />}
      >
        {/* Hero Header */}
        <LinearGradient colors={["#0B1E12", "#04110A"]} style={styles.heroHeader}>
          <View style={styles.heroTop}>
            <View style={styles.statusBadge}>
              <ShieldCheck size={12} color={colors.primary} />
              <Text style={styles.statusBadgeText}>SYSTEM OPERATIONAL</Text>
            </View>

            <TouchableOpacity style={styles.refreshBtn} onPress={fetchData} activeOpacity={0.7}>
              <RotateCw size={14} color="#FFF" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroEyebrow}>SYSTEM TELEMETRY & HEALTH</Text>
          <Text style={styles.heroTitle}>System Monitoring</Text>
          <Text style={styles.heroSub}>Real-time infrastructure health, AI API consumption & rate limit pressure</Text>
        </LinearGradient>

        <View style={styles.container}>
          {/* AI Monitor */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GEMINI AI MONITOR (TODAY)</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statIconBox}>
                  <Cpu size={18} color={colors.primary} />
                </View>
                <Text style={styles.statValue}>{aiData?.totalCallsToday || 0}</Text>
                <Text style={styles.statLabel}>API Calls</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                  <Zap size={18} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>${aiData?.estimatedCostToday?.toFixed(2) || "0.00"}</Text>
                <Text style={styles.statLabel}>Est. Cost (USD)</Text>
              </View>
            </View>

            <View style={styles.tokenCard}>
              <View style={styles.tokenRow}>
                <Text style={styles.cardTitle}>Live Token Counter</Text>
                <Text style={styles.tokenValue}>{aiData?.totalTokensToday?.toLocaleString() || 0}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={styles.progressBarFill} />
              </View>
              <Text style={styles.cardSub}>65% of daily soft limit reached</Text>
            </View>
          </View>

          {/* Abuse Alerts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ABUSE ALERTS</Text>
            <View style={styles.alertsCard}>
              {rateLimitData?.alerts?.length ? (
                rateLimitData.alerts.map((alert) => {
                  const isHigh = alert.severity === "high";
                  return (
                    <View key={alert.id} style={styles.alertRow}>
                      <View
                        style={[
                          styles.alertIcon,
                          { backgroundColor: isHigh ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)" },
                        ]}
                      >
                        {isHigh ? <Siren size={18} color="#EF4444" /> : <TriangleAlert size={18} color="#F59E0B" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.alertHeaderRow}>
                          <Text style={styles.alertTitle}>{alert.title}</Text>
                          <Badge label={alert.severity} variant={isHigh ? "error" : "warning"} />
                        </View>
                        <Text style={styles.alertMessage}>{alert.message}</Text>
                        <View style={styles.alertMetaRow}>
                          <Text style={styles.alertMeta}>{alert.windowMinutes}m window</Text>
                          <Text style={styles.alertMeta}>count {alert.count}</Text>
                          {alert.target ? (
                            <Text style={styles.alertMeta} numberOfLines={1}>
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
                    <Activity size={18} color="#22C55E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>No abuse alerts right now</Text>
                    <Text style={styles.alertMessage}>
                      Rate limiting is active, but nothing is spiking hard enough to raise an alert.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Service Health Check */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SERVICE HEALTH CHECK</Text>
            <View style={styles.healthCard}>
              <View style={styles.healthHeaderRow}>
                <Badge
                  label={healthData?.status || "UNKNOWN"}
                  variant={healthData?.status === "OK" ? "success" : healthData?.status === "DEGRADED" ? "warning" : "error"}
                />
                <Text style={styles.cardSub}>
                  {healthData?.ready ? "Ready for traffic" : "Not ready for traffic"}
                </Text>
              </View>
              {dependencyRows.map((row) => (
                <View key={row.name}>
                  <HealthRow name={row.name} status={row.status} icon={row.icon} />
                  {row.detail ? <Text style={styles.healthDetail}>{row.detail}</Text> : null}
                </View>
              ))}
            </View>
          </View>

          {/* Rate Limit Pressure */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RATE LIMIT PRESSURE</Text>
            <View style={styles.rateLimitCard}>
              <View style={styles.rateLimitHeader}>
                <View style={[styles.alertIcon, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                  <Ban size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>Blocked Request Activity</Text>
                  <Text style={styles.alertMessage}>
                    Routes or socket events hitting protection limits.
                  </Text>
                </View>
                <Badge
                  label={rateLimitData?.persistence === "redis" ? "Redis" : "Memory"}
                  variant={rateLimitData?.persistence === "redis" ? "success" : "warning"}
                />
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Gauge size={16} color={colors.primary} />
                  <Text style={styles.statValue}>{rateLimitData?.totalRecorded ?? 0}</Text>
                  <Text style={styles.statLabel}>blocked events</Text>
                </View>
                <View style={styles.statCard}>
                  <Clock3 size={16} color="#38BDF8" />
                  <Text style={styles.statValue}>{rateLimitData?.recent?.length ?? 0}</Text>
                  <Text style={styles.statLabel}>recent samples</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Background Jobs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BACKGROUND JOBS</Text>
            <View style={styles.jobsCard}>
              {jobs.map((job, index) => (
                <View key={index} style={styles.jobRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobName}>{job.label || job.name}</Text>
                    <Text style={styles.jobMeta}>
                      Last run: {new Date(job.lastRun).toLocaleTimeString()} • {job.duration}
                    </Text>
                    {job.error ? <Text style={[styles.jobMeta, { color: colors.error }]} numberOfLines={2}>{job.error}</Text> : null}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Badge
                      label={job.status}
                      variant={job.status === "success" ? "success" : "error"}
                    />
                    {job.status === "failed" && job.id !== "inline-queue" ? <TouchableOpacity
                      style={styles.retryBtn}
                      onPress={() => handleRetryJob(job.id)}
                      activeOpacity={0.7}
                    >
                      <RefreshCcw size={14} color={colors.textPrimary} />
                    </TouchableOpacity> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};
const createStyles = (colors: typeof import("../../../theme/colors").darkPalette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    heroHeader: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(34, 197, 94, 0.25)",
      marginBottom: 14,
    },
    heroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
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
    statusBadgeText: {
      fontSize: 10,
      fontFamily: "SpaceMono-Regular",
      fontWeight: "700",
      color: colors.primary,
    },
    refreshBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
    },
    refreshBtnText: {
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
      color: "#FFF",
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
    },
    container: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "SpaceMono-Regular",
      color: colors.textMuted,
      marginBottom: 10,
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    statIconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: "rgba(34, 197, 94, 0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    statValue: {
      fontSize: 20,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
    },
    tokenCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    tokenRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    cardTitle: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: colors.textPrimary,
    },
    tokenValue: {
      fontSize: 16,
      fontFamily: "Inter-Bold",
      color: colors.primary,
    },
    progressBarBg: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceElevated,
      overflow: "hidden",
      marginBottom: 8,
    },
    progressBarFill: {
      width: "65%",
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    cardSub: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
    },
    alertsCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    alertRow: {
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    alertsEmptyState: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      alignItems: "center",
    },
    alertIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    alertHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    alertTitle: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: colors.textPrimary,
    },
    alertMessage: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: colors.textSecondary,
      lineHeight: 17,
    },
    alertMetaRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    alertMeta: {
      fontSize: 11,
      fontFamily: "SpaceMono-Regular",
      color: colors.textMuted,
    },
    healthCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    healthHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    healthRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    healthIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    healthName: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: colors.textPrimary,
    },
    healthDetail: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
      paddingHorizontal: 60,
      paddingBottom: 10,
    },
    statusBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontFamily: "SpaceMono-Regular",
      fontWeight: "700",
    },
    rateLimitCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    rateLimitHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },
    jobsCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    jobRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    jobName: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: colors.textPrimary,
    },
    jobMeta: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
      marginTop: 2,
    },
    retryBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
  });

