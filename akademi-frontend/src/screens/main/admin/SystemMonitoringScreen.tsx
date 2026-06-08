import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Cpu, Zap, Activity, Shield, RefreshCcw, HardDrive, Server, Globe, Database, MessageSquare } from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";

export const SystemMonitoringScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [aiData, setAiData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ai, health, jobsList] = await Promise.all([
        adminService.getAIMonitoring(),
        adminService.getHealthMonitoring(),
        adminService.getJobsMonitoring()
      ]);
      setAiData(ai);
      setHealthData(health);
      setJobs(jobsList);
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
