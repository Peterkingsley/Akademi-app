import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart3, Mail, RefreshCw, Send, Users } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, WaitlistEntry, WaitlistResponse } from "../../../services/adminService";

type InviteStatus = "all" | "never_sent" | "sent_before";

export const AdminWaitlistScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [data, setData] = useState<WaitlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("Akademi waitlist update");
  const [message, setMessage] = useState(
    "Hi,\n\nWe are opening more access inside Akademi. If your school or department is in this batch, we will let you know immediately.\n\n- Akademi"
  );
  const [campaignDesign, setCampaignDesign] = useState({
    preheader: "",
    bannerImageUrl: "",
    accentColor: "#AFE607",
    ctaLabel: "",
    ctaUrl: "",
  });
  const [filters, setFilters] = useState({
    search: "",
    university: "",
    faculty: "",
    department: "",
    inviteStatus: "all" as InviteStatus,
  });

  const buildQuery = useCallback(
    () => ({
      limit: 100,
      ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
      ...(filters.university.trim() ? { university: filters.university.trim() } : {}),
      ...(filters.faculty.trim() ? { faculty: filters.faculty.trim() } : {}),
      ...(filters.department.trim() ? { department: filters.department.trim() } : {}),
      ...(filters.inviteStatus !== "all" ? { inviteStatus: filters.inviteStatus } : {}),
    }),
    [filters]
  );

  const loadWaitlist = useCallback(
    async (isRefresh = false, overrideFilters?: typeof filters) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        const activeFilters = overrideFilters || filters;
        const response = await adminService.listWaitlistEntries({
          limit: 100,
          ...(activeFilters.search.trim() ? { search: activeFilters.search.trim() } : {}),
          ...(activeFilters.university.trim() ? { university: activeFilters.university.trim() } : {}),
          ...(activeFilters.faculty.trim() ? { faculty: activeFilters.faculty.trim() } : {}),
          ...(activeFilters.department.trim() ? { department: activeFilters.department.trim() } : {}),
          ...(activeFilters.inviteStatus !== "all" ? { inviteStatus: activeFilters.inviteStatus } : {}),
        });
        setData(response);
      } catch (error: any) {
        Alert.alert("Could not load waitlist", error?.response?.data?.message || error.message || "Please try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    loadWaitlist();
  }, [loadWaitlist]);

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && !sending;

  const inviteStatusOptions: Array<{ key: InviteStatus; label: string }> = [
    { key: "all", label: "All" },
    { key: "never_sent", label: "Not sent before" },
    { key: "sent_before", label: "Sent before" },
  ];

  const applyBucketFilter = (type: "university" | "faculty" | "department", value: string) => {
    setFilters((current) => ({
      ...current,
      [type]: value === "not_set" ? "" : value,
    }));
  };

  const previewCampaign = async () => {
    try {
      setSending(true);
      const result = await adminService.sendWaitlistEmailCampaign({
        ...buildQuery(),
        subject: subject.trim(),
        message: message.trim(),
        design: campaignDesign,
        previewOnly: true,
      });
      Alert.alert("Waitlist recipients", `${result.recipientCount || 0} people match this filter right now.`);
    } catch (error: any) {
      Alert.alert("Preview failed", error?.response?.data?.message || error.message || "Please try again.");
    } finally {
      setSending(false);
    }
  };

  const sendCampaign = () => {
    if (!canSend) return;
    Alert.alert(
      "Send waitlist email?",
      `This will send to ${data?.summary?.total || data?.total || 0} filtered contact(s).`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          style: "destructive",
          onPress: async () => {
            try {
              setSending(true);
              const result = await adminService.sendWaitlistEmailCampaign({
                ...buildQuery(),
                subject: subject.trim(),
                message: message.trim(),
                design: campaignDesign,
              });
              Alert.alert("Campaign sent", `Sent ${result.sent || 0} of ${result.recipientCount || 0}. Failed: ${result.failedCount || 0}.`);
              loadWaitlist(true);
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

  const renderMetricRow = (title: string, items: Array<{ name: string; count: number }>, type: "university" | "faculty" | "department") => {
    if (!items.length) return null;

    return (
      <View style={styles.metricBlock}>
        <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricScroll}>
          {items.map((item) => {
            const active = filters[type] === item.name || (item.name === "not_set" && !filters[type]);
            return (
              <TouchableOpacity
                key={`${type}-${item.name}`}
                style={[
                  styles.metricChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => applyBucketFilter(type, item.name)}
              >
                <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.name.replace(/_/g, " ")}
                </Text>
                <Text style={[typography.body, { color: active ? colors.primary : colors.textPrimary, fontWeight: "800" }]}>{item.count}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

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
          <Text style={[typography.caption, { color: colors.primary, fontWeight: "700" }]}>
            {item.invite_count > 0 ? `${item.invite_count} sent` : "not sent"}
          </Text>
        </View>
      </View>
      <View style={styles.entryMeta}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {item.university || "No school"} / {item.faculty || "No faculty"}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {item.department || "No department"} / {item.level ? `${item.level}L` : "Level not set"}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Need: {item.main_struggle || "Not set"} / Last sent: {item.last_invited_at ? new Date(item.last_invited_at).toLocaleDateString() : "Never"}
        </Text>
      </View>
    </View>
  );

  const needSummary = useMemo(() => data?.summary?.byNeed || [], [data]);
  const topUniversity: { name: string; count: number; share?: number } | null = data?.summary?.topUniversity || data?.summary?.byUniversity?.[0] || null;

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
              <Text style={[typography.h1, { color: colors.textPrimary }]}>{data?.summary?.total || data?.total || 0}</Text>
              <Text style={[typography.body, { color: colors.textSecondary }]}>tracked waitlist contacts</Text>
              <View style={styles.heroStatsRow}>
                <View style={[styles.heroStatChip, { backgroundColor: `${colors.primary}12` }]}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Never sent</Text>
                  <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>{data?.summary?.neverSentCount || 0}</Text>
                </View>
                <View style={[styles.heroStatChip, { backgroundColor: `${colors.primary}12` }]}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Sent before</Text>
                  <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>{data?.summary?.invitedCount || 0}</Text>
                </View>
              </View>
              {topUniversity && (
                <TouchableOpacity
                  style={[styles.topSchoolCard, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}55` }]}
                  onPress={() => applyBucketFilter("university", topUniversity.name)}
                >
                  <Text style={[typography.label, { color: colors.textMuted }]}>SCHOOL WITH THE MOST JOINS</Text>
                  <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "900", textAlign: "center" }]} numberOfLines={2}>
                    {topUniversity.name.replace(/_/g, " ")}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, textAlign: "center" }]}>
                    {topUniversity.count} signup{topUniversity.count === 1 ? "" : "s"}
                    {typeof topUniversity.share === "number" ? ` • ${topUniversity.share}% of this audience` : ""}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.refreshButton, { borderColor: colors.border }]} onPress={() => loadWaitlist(true)}>
                <RefreshCw size={16} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.primary, fontWeight: "700" }]}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>Audience filters</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Search name, email, school, faculty, department"
                placeholderTextColor={colors.textMuted}
                value={filters.search}
                onChangeText={(search) => setFilters((current) => ({ ...current, search }))}
              />
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="School"
                placeholderTextColor={colors.textMuted}
                value={filters.university}
                onChangeText={(university) => setFilters((current) => ({ ...current, university }))}
              />
              <View style={styles.twoUp}>
                <TextInput
                  style={[styles.input, styles.twoUpInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="Faculty"
                  placeholderTextColor={colors.textMuted}
                  value={filters.faculty}
                  onChangeText={(faculty) => setFilters((current) => ({ ...current, faculty }))}
                />
                <TextInput
                  style={[styles.input, styles.twoUpInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="Department"
                  placeholderTextColor={colors.textMuted}
                  value={filters.department}
                  onChangeText={(department) => setFilters((current) => ({ ...current, department }))}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inviteStatusRow}>
                {inviteStatusOptions.map((option) => {
                  const active = filters.inviteStatus === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.inviteStatusChip,
                        {
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setFilters((current) => ({ ...current, inviteStatus: option.key }))}
                    >
                      <Text style={[typography.caption, { color: active ? "#020403" : colors.textPrimary, fontWeight: "800" }]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.emailActions}>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => loadWaitlist(true)}>
                  <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "800" }]}>Apply filters</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={() => {
                    const cleared = { search: "", university: "", faculty: "", department: "", inviteStatus: "all" as InviteStatus };
                    setFilters(cleared);
                    loadWaitlist(true, cleared);
                  }}
                >
                  <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "800" }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.analyticsPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.emailHeader}>
                <BarChart3 size={20} color={colors.primary} />
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>Demand metrics</Text>
              </View>
              {renderMetricRow("Top schools", data?.summary?.byUniversity || [], "university")}
              {renderMetricRow("Top faculties", data?.summary?.byFaculty || [], "faculty")}
              {renderMetricRow("Top departments", data?.summary?.byDepartment || [], "department")}
              {needSummary.length > 0 && (
                <View style={styles.metricBlock}>
                  <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>Top learning needs</Text>
                  <View style={styles.needWrap}>
                    {needSummary.map((item) => (
                      <View key={item.need} style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.need.replace(/_/g, " ")}</Text>
                        <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>{item.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={[styles.emailPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.emailHeader}>
                <Mail size={20} color={colors.primary} />
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>Send by school, faculty, department, or send-status</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Current audience: {data?.summary?.total || 0} contact(s) matching the filter above.
              </Text>
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
              <Text style={[typography.caption, { color: colors.textMuted }]}>Campaign design</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Preheader text"
                placeholderTextColor={colors.textMuted}
                value={campaignDesign.preheader}
                onChangeText={(preheader) => setCampaignDesign((current) => ({ ...current, preheader }))}
              />
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Banner image URL"
                placeholderTextColor={colors.textMuted}
                value={campaignDesign.bannerImageUrl}
                onChangeText={(bannerImageUrl) => setCampaignDesign((current) => ({ ...current, bannerImageUrl }))}
              />
              <View style={styles.twoUp}>
                <TextInput
                  style={[styles.input, styles.twoUpInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="#AFE607"
                  placeholderTextColor={colors.textMuted}
                  value={campaignDesign.accentColor}
                  onChangeText={(accentColor) => setCampaignDesign((current) => ({ ...current, accentColor }))}
                />
                <TextInput
                  style={[styles.input, styles.twoUpInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="CTA label"
                  placeholderTextColor={colors.textMuted}
                  value={campaignDesign.ctaLabel}
                  onChangeText={(ctaLabel) => setCampaignDesign((current) => ({ ...current, ctaLabel }))}
                />
              </View>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="CTA URL"
                placeholderTextColor={colors.textMuted}
                value={campaignDesign.ctaUrl}
                onChangeText={(ctaUrl) => setCampaignDesign((current) => ({ ...current, ctaUrl }))}
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

            <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>WAITLIST CONTACTS</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>No waitlist contacts yet</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>New signups will appear here once they hit the waitlist form.</Text>
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
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  heroStatChip: {
    borderRadius: 14,
    minWidth: 130,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  topSchoolCard: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
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
  filterPanel: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
    padding: 16,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  twoUp: {
    flexDirection: "row",
    gap: 10,
  },
  twoUpInput: {
    flex: 1,
  },
  inviteStatusRow: {
    gap: 10,
  },
  inviteStatusChip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  analyticsPanel: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
    padding: 16,
  },
  metricBlock: {
    gap: 8,
  },
  metricScroll: {
    gap: 10,
  },
  metricChip: {
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 150,
    padding: 12,
  },
  needWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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

