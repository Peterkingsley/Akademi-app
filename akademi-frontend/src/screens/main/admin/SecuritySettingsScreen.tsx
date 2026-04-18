import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert
} from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, IPLog } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import {
  Shield,
  Clock,
  Globe,
  Smartphone,
  Lock,
  ChevronRight,
  AlertTriangle
} from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";

export const SecuritySettingsScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [ipLogs, setIpLogs] = useState<IPLog[]>([]);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [logs, session] = await Promise.all([
        adminService.getIPLogs(),
        adminService.getSessionStatus()
      ]);
      setIpLogs(logs);
      setSessionStatus(session);
      setTwoFactorEnabled(session?.twoFactorEnabled || false);
    } catch (error) {
      console.error("Failed to fetch security settings", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleToggle2FA = async (value: boolean) => {
    try {
      setTwoFactorEnabled(value);
      await adminService.toggle2FA(value);
      Alert.alert("Success", `Two-Factor Authentication ${value ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      setTwoFactorEnabled(!value);
      Alert.alert("Error", "Failed to update 2FA settings");
    }
  };

  const maskIP = (ip: string) => {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return ip;
  };

  const SecurityOption = ({ icon: Icon, title, description, value, onValueChange, color = colors.primary }: any) => (
    <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.iconBox, { backgroundColor: `${color}10` }]}>
        <Icon size={20} color={color} />
      </View>
      <View style={styles.optionContent}>
        <Text style={[typography.body, { fontWeight: '600', color: colors.textPrimary }]}>{title}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: `${colors.primary}80` }}
        thumbColor={value ? colors.primary : colors.textMuted}
      />
    </View>
  );

  return (
    <Screen title="Security Settings" scrollable refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>ACCESS CONTROL</Text>
          <Card style={styles.card}>
            <SecurityOption
              icon={Smartphone}
              title="Two-Factor Authentication"
              description="Requires OTP during login for extra security"
              value={twoFactorEnabled}
              onValueChange={handleToggle2FA}
            />
            <View style={[styles.optionRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.iconBox, { backgroundColor: '#F59E0B10' }]}>
                <Clock size={20} color="#F59E0B" />
              </View>
              <View style={styles.optionContent}>
                <Text style={[typography.body, { fontWeight: '600', color: colors.textPrimary }]}>Session Timeout</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Auto logout after inactivity</Text>
              </View>
              <View style={[styles.timeoutBadge, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700' }]}>
                    {sessionStatus?.timeLeft || "15m"}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={[typography.label, { color: colors.textMuted }]}>RECENT LOGINS & IP LOGS</Text>
                <TouchableOpacity onPress={fetchData}>
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>REFRESH</Text>
                </TouchableOpacity>
            </View>
            <Card style={styles.ipCard}>
                {loading ? (
                    Array(3).fill({}).map((_, i) => (
                        <View key={i} style={styles.ipRow}>
                            <Skeleton width="100%" height={40} />
                        </View>
                    ))
                ) : (
                    ipLogs.map((log, index) => (
                        <View key={log.id} style={[styles.ipRow, { borderBottomColor: colors.border, borderBottomWidth: index === ipLogs.length - 1 ? 0 : 1 }]}>
                            <View style={styles.ipInfo}>
                                <View style={styles.ipMain}>
                                    <Globe size={14} color={colors.textSecondary} />
                                    <Text style={[typography.body, { fontWeight: '600', marginLeft: 8, color: colors.textPrimary }]}>
                                        {maskIP(log.ip_address)}
                                    </Text>
                                    {log.is_current && (
                                        <View style={styles.currentBadge}>
                                            <Text style={styles.currentText}>CURRENT</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                                    {log.location} • {new Date(log.timestamp).toLocaleString()}
                                </Text>
                            </View>
                            <ChevronRight size={16} color={colors.textMuted} />
                        </View>
                    ))
                )}
            </Card>
            <View style={styles.warningBox}>
                <AlertTriangle size={16} color="#F59E0B" />
                <Text style={[typography.caption, { color: "#F59E0B", flex: 1, marginLeft: 8 }]}>
                    If you don't recognize an IP address, change your password immediately and contact the system administrator.
                </Text>
            </View>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  timeoutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ipCard: {
    padding: 0,
    overflow: 'hidden',
  },
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  ipInfo: {
    flex: 1,
  },
  ipMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  currentText: {
    color: '#10B981',
    fontSize: 8,
    fontWeight: '800',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#F59E0B10',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'flex-start',
  }
});
