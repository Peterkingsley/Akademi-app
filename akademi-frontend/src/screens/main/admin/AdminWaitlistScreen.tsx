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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { BarChart3, Copy, Link2, Mail, RefreshCw, Send, Users } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, WaitlistEntry, WaitlistResponse } from "../../../services/adminService";

const WAITLIST_SITE_URL_STORAGE_KEY = "akademi_admin_waitlist_site_url";

const slugify = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

type InviteStatus = "all" | "never_sent" | "sent_before";

type SummaryBucket = { name: string; count: number };
type TopUniversityBucket = SummaryBucket & { share?: number };

const buildEntrySummary = (
  entries: WaitlistEntry[],
  key: "university" | "faculty" | "department"
): SummaryBucket[] => {
  const counts = new Map<string, number>();

  entries.forEach((entry) => {
    const rawValue = entry[key];
    const normalized = typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : "not_set";
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

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
    accentColor: "#304000",
    ctaLabel: "",
    ctaUrl: "",
  });
  const [filters, setFilters] = useState({
    search: "",
    university: "",
    faculty: "",
    department: "",
    utmSource: "",
    inviteStatus: "all" as InviteStatus,
  });
  const [siteUrl, setSiteUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkCampaign, setLinkCampaign] = useState("");
  const [generatedLink, setGeneratedLink] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WAITLIST_SITE_URL_STORAGE_KEY).then((stored) => {
      if (stored) setSiteUrl(stored);
    });
  }, []);

  const buildQuery = useCallback(
    () => ({
      limit: 100,
      ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
      ...(filters.university.trim() ? { university: filters.university.trim() } : {}),
      ...(filters.faculty.trim() ? { faculty: filters.faculty.trim() } : {}),
      ...(filters.department.trim() ? { department: filters.department.trim() } : {}),
      ...(filters.utmSource.trim() ? { utmSource: filters.utmSource.trim() } : {}),
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
          ...(activeFilters.utmSource.trim() ? { utmSource: activeFilters.utmSource.trim() } : {}),
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

  const applyBucketFilter = (type: "university" | "faculty" | "department" | "utmSource", value: string) => {
    setFilters((current) => ({
      ...current,
      [type]: value === "not_set" ? "" : value,
    }));
  };

  const persistSiteUrl = (value: string) => {
    setSiteUrl(value);
    AsyncStorage.setItem(WAITLIST_SITE_URL_STORAGE_KEY, value).catch(() => {});
  };

  const generateLink = () => {
    const code = slugify(linkLabel);
    if (!code) {
      Alert.alert("Add a label", "Give this link a name first, e.g. \"Instagram bio\" or \"Ada's link\".");
      return;
    }
    const base = siteUrl.trim().replace(/\/+$/, "");
    if (!base) {
      Alert.alert("Add your waitlist site URL", "Paste the public waitlist site URL once so links can be generated.");
      return;
    }
    const campaignQuery = linkCampaign.trim() ? `?${new URLSearchParams({ utm_campaign: linkCampaign.trim() }).toString()}` : "";
    setGeneratedLink({ code, url: `${base}/${code}${campaignQuery}` });
    setCopied(false);
  };

  const copyGeneratedLink = async () => {
    if (!generatedLink) return;
    await Clipboard.setStringAsync(generatedLink.url);
    setCopied(true);
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

  const renderMetricRow = (title: string, items: Array<{ name: string; count: number }>, type: "university" | "faculty" | "department" | "utmSource") => {
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
  const universitySummary = useMemo(
    () => (data?.summary?.byUniversity?.length ? data.summary.byUniversity : buildEntrySummary(data?.entries || [], "university")),
    [data?.entries, data?.summary?.byUniversity]
  );
  const facultySummary = useMemo(
    () => (data?.summary?.byFaculty?.length ? data.summary.byFaculty : buildEntrySummary(data?.entries || [], "faculty")),
    [data?.entries, data?.summary?.byFaculty]
  );
  const departmentSummary = useMemo(
    () => (data?.summary?.byDepartment?.length ? data.summary.byDepartment : buildEntrySummary(data?.entries || [], "department")),
    [data?.entries, data?.summary?.byDepartment]
  );
  const sourceSummary = useMemo(() => data?.summary?.bySource || [], [data?.summary?.bySource]);
  const traffic = useMemo(
    () =>
      data?.summary?.traffic || {
        pageViews: 0,
        uniqueVisitors: 0,
        formStarts: 0,
        schoolSearches: 0,
        schoolSelections: 0,
        submitSuccesses: 0,
        whatsappRedirects: 0,
        submitConversionRate: 0,
        whatsappRedirectRate: 0,
        topSources: [],
        topSchoolQueries: [],
        topSelectedSchools: [],
      },
    [data?.summary?.traffic]
  );
  const topUniversity: TopUniversityBucket | null = useMemo(() => {
    const top: TopUniversityBucket | null = (data?.summary?.topUniversity as TopUniversityBucket | null) || universitySummary[0] || null;
    if (!top) return null;
    const total = data?.summary?.total || data?.total || data?.entries?.length || 0;

    return {
      ...top,
      share: typeof top.share === "number" ? top.share : total > 0 ? Math.round((top.count / total) * 100) : 0,
    };
  }, [data?.entries?.length, data?.summary?.topUniversity, data?.summary?.total, data?.total, universitySummary]);

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
                    {typeof topUniversity.share === "number" ? ` | ${topUniversity.share}% of this audience` : ""}
                  </Text>
                </TouchableOpacity>
              )}
              {universitySummary.length > 0 && (
                <View style={styles.topSchoolsHeroBlock}>
                  <Text style={[typography.label, { color: colors.textMuted }]}>TOP 10 SCHOOLS RIGHT NOW</Text>
                  <View style={styles.topSchoolsHeroList}>
                    {universitySummary.slice(0, 10).map((item, index) => {
                      const active = filters.university === item.name || (item.name === "not_set" && !filters.university);
                      return (
                        <TouchableOpacity
                          key={`hero-school-${item.name}`}
                          style={[
                            styles.topSchoolHeroChip,
                            {
                              backgroundColor: active ? `${colors.primary}16` : colors.surface,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => applyBucketFilter("university", item.name)}
                        >
                          <Text style={[typography.caption, { color: colors.textMuted }]}>{String(index + 1).padStart(2, "0")}</Text>
                          <View style={styles.topSchoolHeroContent}>
                            <Text
                              style={[typography.caption, { color: active ? colors.primary : colors.textPrimary, fontWeight: "800" }]}
                              numberOfLines={2}
                            >
                              {item.name.replace(/_/g, " ")}
                            </Text>
                            <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.count} signup{item.count === 1 ? "" : "s"}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
              <TouchableOpacity style={[styles.refreshButton, { borderColor: colors.border }]} onPress={() => loadWaitlist(true)}>
                <RefreshCw size={16} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.primary, fontWeight: "700" }]}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.emailHeader}>
                <Link2 size={20} color={colors.primary} />
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>Generate a trackable link</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Give each person or channel their own link. Every signup that comes through it is tagged, so you can see
                exactly who it converted below.
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Your waitlist site URL (e.g. https://waitlist.akademi.app)"
                placeholderTextColor={colors.textMuted}
                value={siteUrl}
                onChangeText={persistSiteUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.twoUp}>
                <TextInput
                  style={[styles.input, styles.twoUpInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="Label (e.g. Ada, Instagram bio)"
                  placeholderTextColor={colors.textMuted}
                  value={linkLabel}
                  onChangeText={setLinkLabel}
                />
                <TextInput
                  style={[styles.input, styles.twoUpInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="Campaign (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={linkCampaign}
                  onChangeText={setLinkCampaign}
                />
              </View>
              <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }]} onPress={generateLink}>
                <Link2 size={16} color="#020403" />
                <Text style={[typography.caption, { color: "#020403", fontWeight: "900" }]}>Generate link</Text>
              </TouchableOpacity>
              {generatedLink && (
                <View style={[styles.generatedLinkCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Code: {generatedLink.code}</Text>
                  <Text style={[typography.body, { color: colors.textPrimary }]} selectable numberOfLines={3}>
                    {generatedLink.url}
                  </Text>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: colors.border, flexDirection: "row" }]}
                    onPress={copyGeneratedLink}
                  >
                    <Copy size={16} color={colors.primary} />
                    <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "800", marginLeft: 8 }]}>
                      {copied ? "Copied!" : "Copy link"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {renderMetricRow("Signups by link", sourceSummary, "utmSource")}
            </View>

            <View style={[styles.analyticsPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.emailHeader}>
                <BarChart3 size={20} color={colors.primary} />
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>Traffic and conversion</Text>
              </View>
              <View style={styles.trafficGrid}>
                {[
                  { label: "Page views", value: traffic.pageViews },
                  { label: "Unique visitors", value: traffic.uniqueVisitors },
                  { label: "Form starts", value: traffic.formStarts },
                  { label: "School searches", value: traffic.schoolSearches },
                  { label: "School picks", value: traffic.schoolSelections },
                  { label: "Joined waitlist", value: traffic.submitSuccesses },
                  { label: "WhatsApp redirects", value: traffic.whatsappRedirects },
                  { label: "Submit rate", value: `${traffic.submitConversionRate}%` },
                ].map((item) => (
                  <View key={item.label} style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.label}</Text>
                    <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
              {traffic.topSources.length > 0 && (
                <View style={styles.metricBlock}>
                  <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>Top traffic sources</Text>
                  <View style={styles.topSchoolsHeroList}>
                    {traffic.topSources.map((item, index) => (
                      <View key={`source-${item.name}-${index}`} style={[styles.topSchoolHeroChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>{String(index + 1).padStart(2, "0")}</Text>
                        <View style={styles.topSchoolHeroContent}>
                          <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "800" }]} numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.count} visit{item.count === 1 ? "" : "s"}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {traffic.topSchoolQueries.length > 0 && (
                <View style={styles.metricBlock}>
                  <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>Top school searches</Text>
                  <View style={styles.needWrap}>
                    {traffic.topSchoolQueries.slice(0, 8).map((item) => (
                      <View key={`query-${item.query}`} style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                          {item.query}
                        </Text>
                        <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "800" }]}>{item.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
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
                    const cleared = { search: "", university: "", faculty: "", department: "", utmSource: "", inviteStatus: "all" as InviteStatus };
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
              {renderMetricRow("Top schools", universitySummary, "university")}
              {renderMetricRow("Top faculties", facultySummary, "faculty")}
              {renderMetricRow("Top departments", departmentSummary, "department")}
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
                  placeholder="#304000"
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
  topSchoolsHeroBlock: {
    gap: 10,
    marginTop: 16,
    width: "100%",
  },
  topSchoolsHeroList: {
    gap: 10,
    width: "100%",
  },
  topSchoolHeroChip: {
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: "100%",
  },
  topSchoolHeroContent: {
    flex: 1,
    gap: 4,
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
  generatedLinkCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
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
  trafficGrid: {
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


