import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { Badge } from "../../../components/ui/Badge";
import { Search } from "lucide-react-native";

export const UserManagementScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.listUsers({ search, limit: 50 });
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const renderUser = ({ item }: { item: any }) => (
    <View style={[styles.userItem, { borderBottomColor: colors.border }]}>
      <View style={styles.userInfo}>
        <Text style={[typography.body, { fontWeight: "600" }]}>{item.name}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.email}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
          {item.university} • {item.department}
        </Text>
      </View>
      <View style={styles.userStatus}>
        <Badge
          label={item.is_banned ? "Banned" : item.is_verified ? "Active" : "Unverified"}
          variant={item.is_banned ? "error" : item.is_verified ? "success" : "warning"}
        />
      </View>
    </View>
  );

  return (
    <Screen title="User Management">
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Search users..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading && users.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No users found.</Text>
          }
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    padding: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 32,
  },
  userItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
  },
  userStatus: {
    marginLeft: 12,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 32,
  },
});
