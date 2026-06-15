import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Mail, RefreshCw, Send, Users } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, WaitlistEntry, WaitlistResponse } from "../../../services/adminService";

export const AdminWaitlistScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [data, setData] = useState<WaitlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("Akademi beta access update");
  const [message, setMessage] = useState(
    "Hi,\n\nThank you for joining the Akademi waitlist. We are preparing access for more Nigerian students and will notify you as soon as your school or department is ready.\n\n- Akademi"
  );

  const loadWaitlist = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const response = await adminService.listWaitlistEntries({ limit: 100 });
      setData(response);
    } catch (error: any) {
      Alert.alert("Could not load waitlist", error?.response?.data?.message || error.message || "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWaitlist();
  }, [loadWaitlist]);

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && !sending;

  const previewCampaign = async () => {
    try {
      setSending(true);
      const result = await adminService.sendWaitlistEmailCampaign({
        subject: subject.trim(),
        message: message.trim(),
        previewOnly: true,
      });
      Alert.alert("Waitlist recipients", `${result.recipientCount || 0} people will receive this email.`);
    } catch (error: any) {
      Alert.alert("Preview failed", error?.response?.data?.message || error.message || "Please try again.");
    } finally {
      setSending(false);
    }
  };

  const sendCampaign = () => {
    if (!canSend) return;
    Alert.alert(
      "Send email to waitlist?",
      `This will email ${data?.total || "all"} waitlist signups.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          style: "destructive",
          onPress: async () => {
            try {
              setSending(true);
              const result = await adminService.sendWaitlistEmailCampaign({
                subject: subject.trim(),
                message: message.trim(),
              });
              Alert.alert("Email sent", `Sent ${result.sent || 0} of ${result.recipientCount || 0}. Failed: ${result.failedCount || 0}.`);
            } catch (error: any) {
              Alert.alert("Email failed", error?.response?.data?.message || error.message || "Please try again.");
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const needSummary = useMemo(() => data?.summary?.byNeed || [], [data]);

  const renderEntry = ({ item }: { item: WaitlistEntry }) => (
    <View style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.entryHeader}>
        <View style={styles.entryIdentity}>
          <Text style={[typography.body, styles.entryName, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.full_name}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${colors.primary}18` }]}>
          <Text style={[typography.caption, { color: colors.primary, fontWeight: "700" }]}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.entryMeta}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {item.university || "No school"} / {item.department || "No department"}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {item.level ? `${item.level}L` : "Level not set"} / {item.main_struggle || "Need not set"}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen title="Waitlist">
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>Loading waitlist...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Waitlist" scrollable={false}>
      <FlatList
        data={data?.entries || []}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadWaitlist(true)} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconBadge, { backgroundColor: `${colors.primary}18` }]}>
                <Users size={28} color={colors.primary} />
              </View>
              <Text style={[typography.h1, { color: colors.textPrimary }]}>{data?.total || 0}</Text>
              <Text style={[typography.body, { color: colors.textSecondary }]}>students on the Akademi waitlist</Text>
              <TouchableOpacity style={[styles.refreshButton, { borderColor: colors.border }]} onPress={() => loadWaitlist(true)}>
                <RefreshCw size={16} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.primary, fontWeight: "700" }]}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {needSummary.length > 0 && (
              <View style={styles.summaryRow}>
                {needSummary.map((item) => (
                  <View key={item.need} style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.need.replace(/_/g, " ")}</Text>
                    <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>{item.count}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={[styles.emailPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.emailHeader}>
                <Mail size={20} color={colors.primary} />
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>Email everyone on the waitlist</Text>
              </View>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Subject"
                placeholderTextColor={colors.textMuted}
                value={subject}
                onChangeText={setSubject}
              />
              <TextInput
                style={[styles.input, styles.messageInput, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Message"
                placeholderTextColor={colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.emailActions}>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={previewCampaign} disabled={sending}>
                  <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "800" }]}>Preview count</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary, opacity: canSend ? 1 : 0.5 }]} onPress={sendCampaign} disabled={!canSend}>
                  {sending ? <ActivityIndicator color="#020403" /> : <Send size={16} color="#020403" />}
                  <Text style={[typography.caption, { color: "#020403", fontWeight: "900" }]}>Send email</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>SIGNUPS</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>No waitlist signups yet</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>New landing page signups will appear here.</Text>
          </View>
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  heroCard: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 24,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: 18,
    height: 58,
    justifyContent: "center",
    marginBottom: 14,
    width: 58,
  },
  refreshButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  summaryChip: {
    borderRadius: 16,
    borderWidth: 1,
    minWidth: "30%",
    padding: 12,
  },
  emailPanel: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginBottom: 22,
    padding: 16,
  },
  emailHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  messageInput: {
    minHeight: 128,
    paddingTop: 14,
  },
  emailActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
  },
  entryCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  entryHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  entryIdentity: {
    flex: 1,
  },
  entryName: {
    fontWeight: "800",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  entryMeta: {
    gap: 4,
    marginTop: 12,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
});
