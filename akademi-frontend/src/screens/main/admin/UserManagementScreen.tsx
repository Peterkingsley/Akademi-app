import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, Linking } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { Search, Filter, Phone, Mail, Settings, X, CheckCircle2, UserX } from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Toast } from "../../../components/ui/Toast";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";

export const UserManagementScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<StackNavigationProp<AdminStackParamList>>();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [emailVisible, setEmailVisible] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<any>(null);
  const [emailForm, setEmailForm] = useState({ subject: "", message: "" });
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
        search,
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
      setTimeout(() => setLoading(false), 500);
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
      const data = await adminService.sendUserEmailCampaign(currentFilters({
        subject: emailForm.subject,
        message: emailForm.message,
        previewOnly: true,
      }));
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
      const data = await adminService.sendUserEmailCampaign(currentFilters({
        subject: emailForm.subject,
        message: emailForm.message,
      }));
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
      case 'call':
        if (user.phone) Linking.openURL(`tel:${user.phone}`);
        else setToast({ message: "No phone number available", type: "error" });
        break;
      case 'email':
        Linking.openURL(`mailto:${user.email}`);
        break;
      case 'ban':
        setSelectedUser(user);
        setConfirmVisible(true);
        break;
      case 'manage':
        setToast({ message: `Managing ${user.name}...`, type: "success" });
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
        type: "success"
      });
      setConfirmVisible(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Ban failed", error);
      setToast({ message: "Failed to ban user", type: "error" });
    }
  };

  const UserCard = ({ user }: { user: any }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.navigate("AdminUserDetail", { userId: user.id })}
    >
    <Card style={StyleSheet.flatten([styles.userCard, { borderColor: colors.border }])}>
      <View style={styles.cardHeader}>
        <View style={styles.nameSection}>
          <Text style={[typography.body, { fontWeight: "700", color: colors.textPrimary }]}>{user.name}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{user.email}</Text>
        </View>
        <Badge
          label={user.is_banned ? "Banned" : user.is_verified ? "Active" : "Pending"}
          variant={user.is_banned ? "error" : user.is_verified ? "success" : "warning"}
        />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>UNIVERSITY</Text>
            <Text style={[typography.bodySmall, { color: colors.textPrimary }]} numberOfLines={1}>{user.university || "N/A"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>DEPARTMENT</Text>
            <Text style={[typography.bodySmall, { color: colors.textPrimary }]} numberOfLines={1}>{user.department || "N/A"}</Text>
          </View>
        </View>
        <View style={[styles.metaRow, { marginTop: 12 }]}>
          <View style={styles.metaItem}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>LEVEL</Text>
            <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{user.level || "N/A"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>JOINED</Text>
            <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>
              {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.footerAction} onPress={() => handleAction('call', user)}>
          <Phone size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerAction} onPress={() => handleAction('email', user)}>
          <Mail size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerAction} onPress={() => handleAction('ban', user)}>
          <UserX size={18} color={user.is_banned ? colors.primary : colors.error} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerAction} onPress={() => handleAction('manage', user)}>
          <Settings size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Card>
    </TouchableOpacity>
  );

  const UserSkeleton = () => (
    <Card style={StyleSheet.flatten([styles.userCard, { borderColor: colors.border }])}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <View style={{ flex: 1 }}><Skeleton width="40%" height={10} /><Skeleton width="80%" height={14} style={{ marginTop: 6 }}/></View>
          <View style={{ flex: 1 }}><Skeleton width="40%" height={10} /><Skeleton width="80%" height={14} style={{ marginTop: 6 }}/></View>
        </View>
      </View>
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Skeleton width={18} height={18} />
        <Skeleton width={18} height={18} />
        <Skeleton width={18} height={18} />
        <Skeleton width={18} height={18} />
      </View>
    </Card>
  );

  return (
    <Screen title="User Management">
      <View style={styles.topActions}>
        <TouchableOpacity
          style={[styles.emailCampaignButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            setRecipientPreview(null);
            setEmailVisible(true);
          }}
        >
          <Mail size={18} color="#FFF" />
          <Text style={[typography.bodySmall, { color: "#FFF", fontWeight: "700" }]}>Email users</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder="Search name or email..."
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
          style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setFilterVisible(true)}
        >
          <Filter size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

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
              <Search size={48} color={colors.textMuted} strokeWidth={1} />
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: 16 }]}>No users match your criteria</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.h4, { color: colors.textPrimary }]}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
              <Text style={[typography.label, { color: colors.textMuted, marginBottom: 12 }]}>PLAN TYPE</Text>
              <View style={styles.chipContainer}>
                {['all', 'free', 'pro', 'premium'].map((plan) => (
                  <TouchableOpacity
                    key={plan}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      selectedPlan === plan && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setSelectedPlan(plan)}
                  >
                    <Text style={[
                      typography.caption,
                      { color: colors.textPrimary, textTransform: 'capitalize' },
                      selectedPlan === plan && { color: '#FFF', fontWeight: 'bold' }
                    ]}>{plan}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[typography.label, { color: colors.textMuted, marginBottom: 12 }]}>SIGNED UP</Text>
              <View style={styles.chipContainer}>
                {[
                  { label: "Anytime", value: "all" },
                  { label: "Today", value: "1" },
                  { label: "7 days", value: "7" },
                  { label: "30 days", value: "30" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      joinedWithinDays === item.value && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setJoinedWithinDays(item.value)}
                  >
                    <Text style={[
                      typography.caption,
                      { color: colors.textPrimary },
                      joinedWithinDays === item.value && { color: '#FFF', fontWeight: 'bold' }
                    ]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[typography.label, { color: colors.textMuted, marginBottom: 12 }]}>FEATURE USED</Text>
              <View style={styles.chipContainer}>
                {[
                  { label: "Any", value: "all" },
                  { label: "Assignment", value: "assignment" },
                  { label: "Tutor", value: "tutor" },
                  { label: "Study", value: "study" },
                  { label: "Exam Prep", value: "exam_prep" },
                  { label: "Uploads", value: "uploads" },
                  { label: "CBT", value: "cbt" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      featureUsed === item.value && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setFeatureUsed(item.value)}
                  >
                    <Text style={[
                      typography.caption,
                      { color: colors.textPrimary },
                      featureUsed === item.value && { color: '#FFF', fontWeight: 'bold' }
                    ]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[typography.label, { color: colors.textMuted, marginBottom: 12 }]}>COURSE CODE</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="e.g. EEE 301"
                placeholderTextColor={colors.textMuted}
                value={courseCodeFilter}
                onChangeText={setCourseCodeFilter}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.filterSection}>
              <Text style={[typography.label, { color: colors.textMuted, marginBottom: 12 }]}>ACCOUNT STATUS</Text>
              {['all', 'active', 'unverified', 'banned'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={styles.radioRow}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text style={[typography.body, { color: colors.textPrimary, textTransform: 'capitalize' }]}>{status}</Text>
                  <View style={[
                    styles.radio,
                    { borderColor: colors.border },
                    selectedStatus === status && { borderColor: colors.primary, backgroundColor: colors.primary }
                  ]}>
                    {selectedStatus === status && <CheckCircle2 size={12} color="#FFF" />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.primary }]}
              onPress={() => setFilterVisible(false)}
            >
              <Text style={[typography.body, { color: '#FFF', fontWeight: 'bold' }]}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={emailVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[typography.h4, { color: colors.textPrimary }]}>Email users</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>Uses the current search and filters.</Text>
              </View>
              <TouchableOpacity onPress={() => setEmailVisible(false)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.label, { color: colors.textMuted, marginBottom: 8 }]}>SUBJECT</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="What should students see first?"
              placeholderTextColor={colors.textMuted}
              value={emailForm.subject}
              onChangeText={(subject) => {
                setRecipientPreview(null);
                setEmailForm((current) => ({ ...current, subject }));
              }}
            />

            <Text style={[typography.label, { color: colors.textMuted, marginBottom: 8, marginTop: 16 }]}>MESSAGE</Text>
            <TextInput
              style={[styles.modalInput, styles.messageInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="Write the email body..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              value={emailForm.message}
              onChangeText={(message) => {
                setRecipientPreview(null);
                setEmailForm((current) => ({ ...current, message }));
              }}
            />

            <View style={[styles.previewBox, { borderColor: colors.border }]}>
              <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "700" }]}>
                {recipientPreview ? `${recipientPreview.recipientCount} matching recipients` : "Preview recipients before sending"}
              </Text>
              {!!recipientPreview?.sampleRecipients?.length && (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]} numberOfLines={2}>
                  {recipientPreview.sampleRecipients.map((user: any) => user.email).join(", ")}
                </Text>
              )}
            </View>

            <View style={styles.emailActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={previewEmailRecipients}
                disabled={emailLoading}
              >
                <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "700" }]}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: emailLoading ? 0.65 : 1 }]}
                onPress={sendEmailCampaign}
                disabled={emailLoading}
              >
                <Text style={[typography.bodySmall, { color: "#FFF", fontWeight: "700" }]}>
                  {emailLoading ? "Working..." : "Send now"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmVisible}
        title={selectedUser?.is_banned ? "Unban User" : "Ban User"}
        message={
          selectedUser?.is_banned
            ? `Allow ${selectedUser?.name} to access Akademi again?`
            : `Are you sure you want to ban ${selectedUser?.name}? This will revoke their access immediately.`
        }
        type={selectedUser?.is_banned ? "info" : "danger"}
        confirmText={selectedUser?.is_banned ? "Unban User" : "Ban User"}
        onConfirm={confirmBan}
        onCancel={() => setConfirmVisible(false)}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onHide={() => setToast(null)}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  topActions: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  emailCampaignButton: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    height: 46,
    justifyContent: "center",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  messageInput: {
    minHeight: 130,
    paddingTop: 14,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  userCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  nameSection: {
    flex: 1,
    marginRight: 12,
  },
  cardBody: {
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaItem: {
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerAction: {
    flex: 1,
    height: 44, // Accessibility
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 64,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  filterSection: {
    marginBottom: 24,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  radioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  applyButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  previewBox: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  emailActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    height: 50,
    justifyContent: "center",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    height: 50,
    justifyContent: "center",
  }
});
