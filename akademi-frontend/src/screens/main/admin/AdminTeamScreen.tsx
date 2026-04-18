import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  ScrollView
} from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminAccount } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  Plus,
  MoreVertical,
  Mail,
  ShieldCheck,
  UserPlus,
  X,
  Send,
  Trash2,
  Lock,
  Unlock
} from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";
import { BottomSheet } from "../../../components/ui/BottomSheet";

export const AdminTeamScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "ANALYST" });
  const [inviting, setInviting] = useState(false);

  const [selectedAdmin, setSelectedAdmin] = useState<AdminAccount | null>(null);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const data = await adminService.listAdmins();
      setAdmins(data);
    } catch (error) {
      console.error("Failed to fetch admins", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAdmins();
    setRefreshing(false);
  };

  const handleInvite = async () => {
    if (!inviteForm.name || !inviteForm.email) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      setInviting(true);
      await adminService.inviteAdmin(inviteForm);
      Alert.alert("Success", "Invite sent successfully!");
      setInviteModalVisible(false);
      setInviteForm({ name: "", email: "", role: "ANALYST" });
      fetchAdmins();
    } catch (error) {
      Alert.alert("Error", "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedAdmin) return;

    const isSuspended = selectedAdmin.status === 'suspended';
    const action = isSuspended ? 'unsuspend' : 'suspend';

    try {
      if (isSuspended) {
        await adminService.unsuspendAdmin(selectedAdmin.id);
      } else {
        await adminService.suspendAdmin(selectedAdmin.id);
      }
      setBottomSheetVisible(false);
      fetchAdmins();
    } catch (error) {
      Alert.alert("Error", `Failed to ${action} account`);
    }
  };

  const handleDelete = async () => {
    if (!selectedAdmin) return;

    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to permanently delete ${selectedAdmin.name}'s admin account? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            try {
              await adminService.deleteAdmin(selectedAdmin.id);
              setBottomSheetVisible(false);
              fetchAdmins();
            } catch (error) {
              Alert.alert("Error", "Failed to delete account");
            }
          }
        }
      ]
    );
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN": return { label: "Super Admin", variant: "purple" as const };
      case "CONTENT_MANAGER": return { label: "Content Mgr", variant: "blue" as const };
      case "MODERATOR": return { label: "Moderator", variant: "blue" as const };
      case "ANALYST": return { label: "Analyst", variant: "blue" as const };
      default: return { label: role, variant: "blue" as const };
    }
  };

  const AdminCard = ({ admin }: { admin: AdminAccount }) => {
    const roleBadge = getRoleBadge(admin.role);
    const isSuspended = admin.status === 'suspended';

    return (
      <Card style={[styles.adminCard, { borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.nameSection}>
            <Text style={[typography.body, { fontWeight: "700", color: colors.textPrimary }]}>{admin.name}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{admin.email}</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedAdmin(admin);
              setBottomSheetVisible(true);
            }}
            style={styles.moreBtn}
          >
            <MoreVertical size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.badgeRow}>
            <Badge label={roleBadge.label} variant={roleBadge.variant} />
            <Badge
              label={admin.status.toUpperCase()}
              variant={isSuspended ? "error" : "success"}
            />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Added {new Date(admin.created_at).toLocaleDateString()}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <Screen
      title="Admin Team"
      rightElement={
        <TouchableOpacity onPress={() => setInviteModalVisible(true)} style={styles.addBtn}>
          <Plus size={20} color={colors.primary} />
        </TouchableOpacity>
      }
    >
      <FlatList
        data={loading ? Array(5).fill({}) : admins}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderItem={({ item }) => loading ? (
          <Card style={[styles.adminCard, { borderColor: colors.border }]}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
                <Skeleton width={80} height={20} borderRadius={10} />
                <Skeleton width={60} height={20} borderRadius={10} />
            </View>
          </Card>
        ) : (
          <AdminCard admin={item} />
        )}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyContainer}>
            <UserPlus size={48} color={colors.textMuted} strokeWidth={1} />
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 16 }]}>No other admins found</Text>
            <Button
                title="Invite First Admin"
                onPress={() => setInviteModalVisible(true)}
                style={{ marginTop: 20 }}
            />
          </View>
        ) : null}
      </FlatList>

      {/* Invite Modal */}
      <Modal visible={inviteModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Invite Admin</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Full Name"
                placeholder="e.g. John Doe"
                value={inviteForm.name}
                onChangeText={(text) => setInviteForm(prev => ({ ...prev, name: text }))}
              />
              <Input
                label="Email Address"
                placeholder="e.g. john@akademi.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={inviteForm.email}
                onChangeText={(text) => setInviteForm(prev => ({ ...prev, email: text }))}
              />

              <Text style={[typography.label, { color: colors.textMuted, marginTop: 16, marginBottom: 8 }]}>ROLE</Text>
              <View style={styles.roleGrid}>
                {['SUPER_ADMIN', 'CONTENT_MANAGER', 'MODERATOR', 'ANALYST'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleChip,
                      { borderColor: colors.border },
                      inviteForm.role === role && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setInviteForm(prev => ({ ...prev, role }))}
                  >
                    <Text style={[
                      typography.caption,
                      { color: colors.textPrimary },
                      inviteForm.role === role && { color: '#FFF', fontWeight: '700' }
                    ]}>{role.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                title="Send Invite"
                icon={<Send size={18} color="#FFF" />}
                loading={inviting}
                onPress={handleInvite}
                style={{ marginTop: 32 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Management BottomSheet */}
      <BottomSheet
        visible={bottomSheetVisible}
        onClose={() => setBottomSheetVisible(false)}
        title="Manage Admin"
      >
        <View style={styles.sheetContent}>
          <View style={styles.selectedAdminInfo}>
             <ShieldCheck size={40} color={colors.primary} />
             <Text style={[typography.h4, { color: colors.textPrimary, marginTop: 12 }]}>{selectedAdmin?.name}</Text>
             <Text style={[typography.body, { color: colors.textSecondary }]}>{selectedAdmin?.email}</Text>
          </View>

          <TouchableOpacity
            style={[styles.sheetAction, { backgroundColor: selectedAdmin?.status === 'suspended' ? '#10B98110' : '#F59E0B10' }]}
            onPress={handleSuspend}
          >
            {selectedAdmin?.status === 'suspended' ? (
                <Unlock size={20} color="#10B981" />
            ) : (
                <Lock size={20} color="#F59E0B" />
            )}
            <Text style={[typography.body, { marginLeft: 12, fontWeight: '600', color: selectedAdmin?.status === 'suspended' ? '#10B981' : '#F59E0B' }]}>
                {selectedAdmin?.status === 'suspended' ? 'Unsuspend Account' : 'Suspend Account'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetAction, { backgroundColor: '#EF444410' }]}
            onPress={handleDelete}
          >
            <Trash2 size={20} color="#EF4444" />
            <Text style={[typography.body, { marginLeft: 12, fontWeight: '600', color: '#EF4444' }]}>Delete Permanently</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  addBtn: {
    padding: 8,
  },
  listContainer: {
    padding: 16,
  },
  adminCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  nameSection: {
    flex: 1,
  },
  moreBtn: {
    padding: 4,
    marginRight: -4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  sheetContent: {
    padding: 16,
    paddingBottom: 32,
  },
  selectedAdminInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  }
});
