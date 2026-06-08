import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, DisciplineDocument } from "../../../services/adminService";
import { Search, Plus, ChevronRight, BookOpen, Map, Filter } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useAuthStore } from "../../../store/useAuthStore";

export const DisciplineDocumentsScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<StackNavigationProp<AdminStackParamList>>();
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<DisciplineDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const canUpload = user?.admin_role === 'SUPER_ADMIN' || user?.admin_role === 'CONTENT_MANAGER';

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await adminService.listDisciplineDocuments();
      setDocuments(data);
    } catch (error) {
      console.error("Failed to fetch documents", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc =>
    doc.faculty.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.course_code && doc.course_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderItem = ({ item }: { item: DisciplineDocument }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("DocumentDetail", { id: item.id })}
      style={[styles.docRow, { borderBottomColor: colors.border }]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
        <BookOpen size={20} color={colors.primary} />
      </View>
      <View style={styles.docInfo}>
        <Text style={[typography.body, { fontWeight: "600", color: colors.textPrimary }]}>
          {item.department}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
          {item.faculty} {item.course_code ? `• ${item.course_code}` : ""}
        </Text>
      </View>
      <View style={styles.rightContent}>
        <Badge
          label={`v${item.version}.0`}
          variant="course"
          style={{ marginRight: spacing.sm }}
        />
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Screen
      title="Discipline Documents"
      rightAction={
        <TouchableOpacity onPress={() => navigation.navigate("CoverageMap")}>
          <Map size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      }
    >
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search faculty, dept, or course..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={[styles.filterBtn, { borderColor: colors.border }]}>
          <Filter size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} width="100%" height={70} borderRadius={12} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredDocs}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>No documents found.</Text>
            </View>
          }
        />
      )}

      {canUpload && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate("UploadDocument")}
        >
          <Plus size={24} color="#FFF" />
        </TouchableOpacity>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 100,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  docInfo: {
    flex: 1,
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  }
});
