import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, Linking } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { Search, Filter, Phone, Mail, Settings, X, CheckCircle2, ChevronDown } from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Toast } from "../../../components/ui/Toast";

export const UserManagementScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filter states
  const [selectedPlan, setSelectedPlan] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    fetchUsers();
  }, [search, selectedPlan, selectedStatus]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.listUsers({
        search,
        limit: 50,
        plan: selectedPlan !== "all" ? selectedPlan : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined
      });
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setTimeout(() => setLoading(false), 500);
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
      case 'manage':
        setToast({ message: `Managing ${user.name}...`, type: "success" });
        break;
    }
  };

  const UserCard = ({ user }: { user: any }) => (
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
        <TouchableOpacity style={styles.footerAction} onPress={() => handleAction('manage', user)}>
          <Settings size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Card>
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
      </View>
    </Card>
  );

  return (
    <Screen title="User Management">
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
  }
});
