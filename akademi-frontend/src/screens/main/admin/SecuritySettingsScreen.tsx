import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, IPLog } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Shield, Clock, Globe, Smartphone, ChevronRight, AlertTriangle, Lock, ShieldCheck, RotateCw } from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";
import { LinearGradient } from "expo-linear-gradient";
import { Badge } from "../../../components/ui/Badge";

export const SecuritySettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
      const [logs, session] = await Promise.all([adminService.getIPLogs(), adminService.getSessionStatus()]);
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
      Alert.alert("Success", `Two-Factor Authentication ${value ? "enabled" : "disabled"}.`);
    } catch (error) {
      setTwoFactorEnabled(!value);
      Alert.alert("Error", "Failed to update 2FA settings");
    }
  };

  const maskIP = (ip: string) => {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return ip;
  };

  const SecurityOption = ({ icon: Icon, title, description, value, onValueChange, color = colors.primary }: any) => (
    <View style={styles.optionRow}>
      <View style={[styles.iconBox, { backgroundColor: `${color}18` }]}>
        <Icon size={20} color={color} />
      </View>
      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
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
    <Screen style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero Header */}
        <LinearGradient colors={["#0B1E12", "#04110A"]} style={styles.heroHeader}>
          <View style={styles.heroTop}>
            <View style={styles.statusBadge}>
              <ShieldCheck size={12} color={colors.primary} />
              <Text style={styles.statusBadgeText}>SECURITY ACTIVE</Text>
            </View>

            <TouchableOpacity style={styles.refreshBtn} onPress={fetchData} activeOpacity={0.7}>
              <RotateCw size={14} color="#FFF" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroEyebrow}>AUTHENTICATION & ACCESS</Text>
          <Text style={styles.heroTitle}>Security Settings</Text>
          <Text style={styles.heroSub}>Manage multi-factor auth, session timeouts & recent login IP audits</Text>
        </LinearGradient>

        <View style={styles.container}>
          {/* Access Control Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACCESS CONTROL</Text>
            <View style={styles.card}>
              <SecurityOption
                icon={Smartphone}
                title="Two-Factor Authentication"
                description="Requires OTP verification during login for enhanced protection"
                value={twoFactorEnabled}
                onValueChange={handleToggle2FA}
              />
              <View style={[styles.optionRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.iconBox, { backgroundColor: "rgba(245, 158, 11, 0.18)" }]}>
                  <Clock size={20} color="#F59E0B" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Session Timeout</Text>
                  <Text style={styles.optionDesc}>Automatic logout after period of inactivity</Text>
                </View>
                <View style={styles.timeoutBadge}>
                  <Text style={styles.timeoutText}>{sessionStatus?.timeLeft || "15m"}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Recent Logins */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>RECENT LOGINS & IP AUDIT LOGS</Text>
            </View>

            <View style={styles.card}>
              {loading ? (
                Array(3)
                  .fill({})
                  .map((_, i) => (
                    <View key={i} style={styles.ipRow}>
                      <Skeleton width="100%" height={40} borderRadius={8} />
                    </View>
                  ))
              ) : (
                ipLogs.map((log, index) => (
                  <View
                    key={log.id}
                    style={[styles.ipRow, { borderBottomWidth: index === ipLogs.length - 1 ? 0 : 1 }]}
                  >
                    <View style={styles.ipInfo}>
                      <View style={styles.ipMain}>
                        <Globe size={14} color={colors.textSecondary} />
                        <Text style={styles.ipText}>{maskIP(log.ip_address)}</Text>
                        {log.is_current && (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentText}>CURRENT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.ipSub}>
                        {log.location} • {new Date(log.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </View>
                ))
              )}
            </View>

            <View style={styles.warningBox}>
              <AlertTriangle size={16} color="#F59E0B" />
              <Text style={styles.warningText}>
                If you do not recognize an IP address, change your password immediately and notify the system administrator.
              </Text>
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
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "SpaceMono-Regular",
      color: colors.textMuted,
      marginBottom: 10,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    optionContent: {
      flex: 1,
      marginRight: 10,
    },
    optionTitle: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: colors.textPrimary,
    },
    optionDesc: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: colors.textSecondary,
      marginTop: 2,
    },
    timeoutBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timeoutText: {
      fontSize: 12,
      fontFamily: "SpaceMono-Regular",
      fontWeight: "700",
      color: colors.textPrimary,
    },
    ipRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomColor: colors.border,
    },
    ipInfo: {
      flex: 1,
    },
    ipMain: {
      flexDirection: "row",
      alignItems: "center",
    },
    ipText: {
      fontSize: 14,
      fontFamily: "SpaceMono-Regular",
      fontWeight: "700",
      color: colors.textPrimary,
      marginLeft: 8,
    },
    ipSub: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
      marginTop: 4,
    },
    currentBadge: {
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginLeft: 8,
      borderWidth: 1,
      borderColor: "rgba(34, 197, 94, 0.3)",
    },
    currentText: {
      color: colors.primary,
      fontSize: 9,
      fontFamily: "SpaceMono-Regular",
      fontWeight: "700",
    },
    warningBox: {
      flexDirection: "row",
      backgroundColor: "rgba(245, 158, 11, 0.12)",
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(245, 158, 11, 0.3)",
      marginTop: 14,
      alignItems: "flex-start",
    },
    warningText: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: "#F59E0B",
      flex: 1,
      marginLeft: 10,
      lineHeight: 18,
    },
  });
