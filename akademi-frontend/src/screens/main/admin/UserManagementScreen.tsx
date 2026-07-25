import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, Linking, ScrollView } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { Badge } from "../../../components/ui/Badge";
import { Search, Filter, Phone, Mail, Settings, X, CheckCircle2, UserX, Shield, Sparkles, ChevronRight, UserCheck, GraduationCap, Building2, Calendar, Send, RefreshCw, Users } from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Toast } from "../../../components/ui/Toast";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";
import { Avatar } from "../../../components/ui/Avatar";
import { LinearGradient } from "expo-linear-gradient";

export const UserManagementScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<StackNavigationProp<AdminStackParamList>>();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [emailVisible, setEmailVisible] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<any>(null);
  const [emailForm, setEmailForm] = useState({ subject: "", message: "" });
  const [campaignDesign, setCampaignDesign] = useState({
    preheader: "",
    bannerImageUrl: "",
    accentColor: "#22C55E",
    ctaLabel: "",
    ctaUrl: "",
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Filter states
  const [selectedPlan, setSelectedPlan] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [joinedWithinDays, setJoinedWithinDays] = useState("all");
  const [featureUsed, setFeatureUsed] = useState("all");
  const [courseCodeFilter, setCourseCodeFilter] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [search, selectedPlan, selectedStatus, joinedWithinDays, featureUsed, courseCodeFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.listUsers({
        search: search || undefined,
        limit: 50,
        plan: selectedPlan !== "all" ? selectedPlan : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        joinedWithinDays: joinedWithinDays !== "all" ? joinedWithinDays : undefined,
        featureUsed: featureUsed !== "all" ? featureUsed : undefined,
        courseCode: courseCodeFilter.trim() || undefined,
      });
      setUsers(Array.isArray(data) ? data : data?.users || []);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const currentFilters = (extra: Record<string, any> = {}) => ({
    search: search || undefined,
    plan: selectedPlan !== "all" ? selectedPlan : undefined,
    status: selectedStatus !== "all" ? selectedStatus : undefined,
    joinedWithinDays: joinedWithinDays !== "all" ? joinedWithinDays : undefined,
    featureUsed: featureUsed !== "all" ? featureUsed : undefined,
    courseCode: courseCodeFilter.trim() || undefined,
    ...extra,
  });

  const previewEmailRecipients = async () => {
    if (!emailForm.subject.trim() || !emailForm.message.trim()) {
      setToast({ message: "Add a subject and message first", type: "error" });
      return;
    }
    try {
      setEmailLoading(true);
      const data = await adminService.sendUserEmailCampaign(
        currentFilters({
          subject: emailForm.subject,
          message: emailForm.message,
          design: campaignDesign,
          previewOnly: true,
        })
      );
      setRecipientPreview(data);
      setToast({ message: `${data.recipientCount || 0} recipients match this campaign`, type: "success" });
    } catch (error: any) {
      setToast({ message: error?.response?.data?.message || "Could not preview recipients", type: "error" });
    } finally {
      setEmailLoading(false);
    }
  };

  const sendEmailCampaign = async () => {
    if (!recipientPreview) {
      await previewEmailRecipients();
      return;
    }
    try {
      setEmailLoading(true);
      const data = await adminService.sendUserEmailCampaign(
        currentFilters({
          subject: emailForm.subject,
          message: emailForm.message,
          design: campaignDesign,
        })
      );
      setEmailVisible(false);
      setRecipientPreview(null);
      setEmailForm({ subject: "", message: "" });
      setToast({ message: `Email sent to ${data.sent || 0} users`, type: "success" });
    } catch (error: any) {
      setToast({ message: error?.response?.data?.message || "Could not send email campaign", type: "error" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleAction = (action: string, user: any) => {
    switch (action) {
      case "call":
        if (user.phone) Linking.openURL(`tel:${user.phone}`);
        else setToast({ message: "No phone number available", type: "error" });
        break;
      case "email":
        Linking.openURL(`mailto:${user.email}`);
        break;
      case "ban":
        setSelectedUser(user);
        setConfirmVisible(true);
        break;
      case "manage":
        navigation.navigate("AdminUserDetail", { userId: user.id });
        break;
    }
  };

  const confirmBan = async () => {
    try {
      if (!selectedUser) return;
      if (selectedUser.is_banned) {
        await adminService.unbanUser(selectedUser.id);
      } else {
        await adminService.banUser(selectedUser.id);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast({
        message: `User ${selectedUser.name} has been ${selectedUser.is_banned ? "unbanned" : "banned"}.`,
        type: "success",
      });
      setConfirmVisible(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Ban failed", error);
      setToast({ message: "Failed to update ban status", type: "error" });
    }
  };

  const hasActiveFilters = selectedPlan !== "all" || selectedStatus !== "all" || joinedWithinDays !== "all" || featureUsed !== "all" || courseCodeFilter.trim() !== "";

  const UserCard = ({ user }: { user: any }) => (
    <TouchableOpacity
      activeOpacity={0.88}
      style={styles.userCard}
      onPress={() => navigation.navigate("AdminUserDetail", { userId: user.id })}
    >
      <View style={styles.cardHeader}>
        <Avatar name={user.name} size={42} />
        <View style={styles.nameSection}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
            {user.plan && user.plan !== "free" && (
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{user.plan.toUpperCase()}</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
        </View>
        <Badge
          label={user.is_banned ? "Banned" : user.is_verified ? "Active" : "Pending"}
          variant={user.is_banned ? "error" : user.is_verified ? "success" : "warning"}
        />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <View style={styles.metaLabelRow}>
              <Building2 size={12} color={colors.textMuted} />
              <Text style={styles.metaLabel}>UNIVERSITY</Text>
            </View>
            <Text style={styles.metaValue} numberOfLines={1}>{user.university || "N/A"}</Text>
          </View>
          <View style={styles.metaItem}>
            <View style={styles.metaLabelRow}>
              <GraduationCap size={12} color={colors.textMuted} />
              <Text style={styles.metaLabel}>DEPARTMENT</Text>
            </View>
            <Text style={styles.metaValue} numberOfLines={1}>{user.department || "N/A"}</Text>
          </View>
        </View>

        <View style={[styles.metaGrid, { marginTop: 10 }]}>
          <View style={styles.metaItem}>
            <View style={styles.metaLabelRow}>
              <Shield size={12} color={colors.textMuted} />
              <Text style={styles.metaLabel}>LEVEL</Text>
            </View>
            <Text style={styles.metaValue}>{user.level ? `${user.level} L` : "N/A"}</Text>
          </View>
          <View style={styles.metaItem}>
            <View style={styles.metaLabelRow}>
              <Calendar size={12} color={colors.textMuted} />
              <Text style={styles.metaLabel}>JOINED</Text>
            </View>
            <Text style={styles.metaValue}>
              {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.footerAction} onPress={() => handleAction("call", user)} activeOpacity={0.7}>
          <Phone size={16} color={colors.primary} />
          <Text style={styles.footerActionText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerAction} onPress={() => handleAction("email", user)} activeOpacity={0.7}>
          <Mail size={16} color={colors.primary} />
          <Text style={styles.footerActionText}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerAction} onPress={() => handleAction("ban", user)} activeOpacity={0.7}>
          <UserX size={16} color={user.is_banned ? colors.primary : colors.error} />
          <Text style={[styles.footerActionText, { color: user.is_banned ? colors.primary : colors.error }]}>
            {user.is_banned ? "Unban" : "Ban"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerAction} onPress={() => handleAction("manage", user)} activeOpacity={0.7}>
          <Settings size={16} color={colors.textSecondary} />
          <Text style={[styles.footerActionText, { color: colors.textSecondary }]}>Detail</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const UserSkeleton = () => (
    <View style={styles.userCard}>
      <View style={styles.cardHeader}>
        <Skeleton width={42} height={42} borderRadius={21} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
      <View style={{ marginTop: 14 }}>
        <View style={styles.metaGrid}>
          <Skeleton width="45%" height={28} borderRadius={8} />
          <Skeleton width="45%" height={28} borderRadius={8} />
        </View>
      </View>
    </View>
  );

  return (
    <Screen style={styles.screen}>
      {/* Hero Header */}
      <LinearGradient colors={["#0B1E12", "#04110A"]} style={styles.heroHeader}>
        <View style={styles.heroTop}>
          <View style={styles.statusBadge}>
            <Users size={12} color={colors.primary} />
            <Text style={styles.statusBadgeText}>{users.length} USERS LOADED</Text>
          </View>
          <TouchableOpacity
            style={styles.emailBtn}
            onPress={() => {
              setRecipientPreview(null);
              setEmailVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Mail size={15} color="#FFF" />
            <Text style={styles.emailBtnText}>Campaign</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.heroEyebrow}>STUDENT & FACULTY DIRECTORY</Text>
        <Text style={styles.heroTitle}>User Management</Text>
        <Text style={styles.heroSub}>Inspect profiles, manage permissions, ban users & broadcast emails</Text>

        {/* Search & Filter Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name, email, university..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
            onPress={() => setFilterVisible(true)}
            activeOpacity={0.7}
          >
            <Filter size={18} color={hasActiveFilters ? "#FFF" : colors.primary} />
            {hasActiveFilters && <View style={styles.activeDot} />}
          </TouchableOpacity>
        </View>

        {/* Quick Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {[
            { label: "All Plans", key: "plan", value: "all" },
            { label: "Pro Users", key: "plan", value: "pro" },
            { label: "Active", key: "status", value: "active" },
            { label: "Banned", key: "status", value: "banned" },
            { label: "Joined 7d", key: "joined", value: "7" },
          ].map((chip, idx) => {
            const isActive =
              (chip.key === "plan" && selectedPlan === chip.value) ||
              (chip.key === "status" && selectedStatus === chip.value) ||
              (chip.key === "joined" && joinedWithinDays === chip.value);

            return (
              <TouchableOpacity
                key={idx}
                style={[styles.quickChip, isActive && styles.quickChipActive]}
                onPress={() => {
                  if (chip.key === "plan") setSelectedPlan(chip.value);
                  if (chip.key === "status") setSelectedStatus(chip.value);
                  if (chip.key === "joined") setJoinedWithinDays(chip.value);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickChipText, isActive && styles.quickChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* User List */}
      {loading && users.length === 0 ? (
        <FlatList
          data={[1, 2, 3, 4]}
          keyExtractor={(i) => i.toString()}
          renderItem={() => <UserSkeleton />}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <UserCard user={item} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Search size={44} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySub}>Try clearing search terms or adjusting active filters</Text>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Users</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>PLAN TYPE</Text>
                <View style={styles.chipGrid}>
                  {["all", "free", "pro", "premium"].map((plan) => (
                    <TouchableOpacity
                      key={plan}
                      style={[styles.modalChip, selectedPlan === plan && styles.modalChipActive]}
                      onPress={() => setSelectedPlan(plan)}
                    >
                      <Text style={[styles.modalChipText, selectedPlan === plan && styles.modalChipTextActive]}>
                        {plan.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>JOINED TIME</Text>
                <View style={styles.chipGrid}>
                  {[
                    { label: "Anytime", value: "all" },
                    { label: "Today", value: "1" },
                    { label: "7 Days", value: "7" },
                    { label: "30 Days", value: "30" },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.modalChip, joinedWithinDays === item.value && styles.modalChipActive]}
                      onPress={() => setJoinedWithinDays(item.value)}
                    >
                      <Text style={[styles.modalChipText, joinedWithinDays === item.value && styles.modalChipTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>ACCOUNT STATUS</Text>
                {["all", "active", "unverified", "banned"].map((status) => (
                  <TouchableOpacity key={status} style={styles.radioRow} onPress={() => setSelectedStatus(status)}>
                    <Text style={styles.radioText}>{status.toUpperCase()}</Text>
                    <View style={[styles.radio, selectedStatus === status && styles.radioActive]}>
                      {selectedStatus === status && <CheckCircle2 size={12} color="#FFF" />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterVisible(false)}>
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Email Campaign Modal */}
      <Modal visible={emailVisible} transparent animationType="slide" onRequestClose={() => setEmailVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Broadcast Email</Text>
                <Text style={styles.modalSub}>Uses current search and active filters</Text>
              </View>
              <TouchableOpacity onPress={() => setEmailVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>SUBJECT LINE</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="What should students see first?"
                placeholderTextColor={colors.textMuted}
                value={emailForm.subject}
                onChangeText={(subject) => {
                  setRecipientPreview(null);
                  setEmailForm((current) => ({ ...current, subject }));
                }}
              />

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>MESSAGE BODY</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="Write the email content..."
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                value={emailForm.message}
                onChangeText={(message) => {
                  setRecipientPreview(null);
                  setEmailForm((current) => ({ ...current, message }));
                }}
              />

              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>
                  {recipientPreview ? `${recipientPreview.recipientCount} Recipients Selected` : "Preview Recipients"}
                </Text>
                {!!recipientPreview?.sampleRecipients?.length && (
                  <Text style={styles.previewSub} numberOfLines={2}>
                    {recipientPreview.sampleRecipients.map((u: any) => u.email).join(", ")}
                  </Text>
                )}
              </View>

              <View style={styles.emailActions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={previewEmailRecipients} disabled={emailLoading}>
                  <Text style={styles.secondaryBtnText}>Preview</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={sendEmailCampaign} disabled={emailLoading}>
                  <Send size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>{emailLoading ? "Sending..." : "Send Campaign"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmVisible}
        title={selectedUser?.is_banned ? "Unban User" : "Ban User"}
        message={
          selectedUser?.is_banned
            ? `Allow ${selectedUser?.name} to access Akademi again?`
            : `Are you sure you want to ban ${selectedUser?.name}? Access will be revoked immediately.`
        }
        type={selectedUser?.is_banned ? "info" : "danger"}
        confirmText={selectedUser?.is_banned ? "Unban User" : "Ban User"}
        onConfirm={confirmBan}
        onCancel={() => setConfirmVisible(false)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onHide={() => setToast(null)} />}
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../../theme/colors").darkPalette) => StyleSheet.create({
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
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
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
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  emailBtnText: {
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
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: colors.textPrimary,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  activeDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFF",
  },
  chipsScroll: {
    gap: 8,
    paddingRight: 10,
  },
  quickChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderColor: colors.primary,
  },
  quickChipText: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
  },
  quickChipTextActive: {
    color: colors.primary,
    fontFamily: "Inter-SemiBold",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  nameSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 15,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
  },
  planBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  planBadgeText: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    fontWeight: "700",
    color: colors.primary,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 2,
  },
  cardBody: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaItem: {
    flex: 1,
  },
  metaLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  footerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  footerActionText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 2,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
    marginBottom: 10,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalChipText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: colors.textSecondary,
  },
  modalChipTextActive: {
    color: "#FFF",
    fontFamily: "Inter-Bold",
  },
  radioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  radioText: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  applyBtnText: {
    fontSize: 14,
    fontFamily: "Inter-Bold",
    color: "#FFF",
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: colors.textPrimary,
  },
  textArea: {
    height: 110,
    paddingTop: 12,
  },
  previewCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 14,
  },
  previewTitle: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  previewSub: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: colors.textMuted,
    marginTop: 4,
  },
  emailActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    marginBottom: 20,
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  primaryBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 13,
    fontFamily: "Inter-Bold",
    color: "#FFF",
  },
});


