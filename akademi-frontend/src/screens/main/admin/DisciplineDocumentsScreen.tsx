import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, CommunityPattern, DisciplineDocument } from "../../../services/adminService";
import { Search, Plus, ChevronRight, BookOpen, Map, Filter, Newspaper, X } from "lucide-react-native";
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
  const [patterns, setPatterns] = useState<CommunityPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"docs" | "stories">("docs");
  const [modalType, setModalType] = useState<"doc" | "story" | null>(null);
  const [saving, setSaving] = useState(false);
  const [docForm, setDocForm] = useState({ faculty: "", department: "", document_ref: "", version_notes: "" });
  const [storyForm, setStoryForm] = useState({ university: "", title: "", story: "", context_type: "campus_context", tags: "" });

  const canUpload = user?.admin_role === 'SUPER_ADMIN' || user?.admin_role === 'CONTENT_MANAGER';

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const [docsData, patternsData] = await Promise.all([
        adminService.listDisciplineDocuments(),
        adminService.listCommunityPatterns(),
      ]);
      setDocuments(docsData);
      setPatterns(patternsData);
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

  const filteredPatterns = patterns.filter(pattern => {
    const payload = pattern.question_pattern || {};
    const query = searchQuery.toLowerCase();
    return (
      pattern.university.toLowerCase().includes(query) ||
      (payload.title || "").toLowerCase().includes(query) ||
      (payload.story || "").toLowerCase().includes(query)
    );
  });

  const closeModal = () => {
    setModalType(null);
    setSaving(false);
  };

  const handleSaveDocument = async () => {
    if (!docForm.faculty.trim() || !docForm.department.trim() || !docForm.document_ref.trim()) {
      Alert.alert("Missing details", "Faculty, department, and document content/reference are required.");
      return;
    }

    try {
      setSaving(true);
      await adminService.uploadDisciplineDocument({
        ...docForm,
        version_notes: docForm.version_notes || "Updated department-wide discipline document.",
      });
      setDocForm({ faculty: "", department: "", document_ref: "", version_notes: "" });
      closeModal();
      fetchDocuments();
    } catch (error: any) {
      Alert.alert("Could not save document", error?.response?.data?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStory = async () => {
    if (!storyForm.university.trim() || !storyForm.title.trim() || !storyForm.story.trim()) {
      Alert.alert("Missing details", "University, title, and story are required.");
      return;
    }

    try {
      setSaving(true);
      await adminService.uploadCommunityPattern({
        ...storyForm,
        tags: storyForm.tags.split(",").map(tag => tag.trim()).filter(Boolean),
      });
      setStoryForm({ university: "", title: "", story: "", context_type: "campus_context", tags: "" });
      closeModal();
      fetchDocuments();
    } catch (error: any) {
      Alert.alert("Could not save story", error?.response?.data?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

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

  const renderPattern = ({ item }: { item: CommunityPattern }) => {
    const payload = item.question_pattern || {};
    return (
      <View style={[styles.docRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
          <Newspaper size={20} color={colors.primary} />
        </View>
        <View style={styles.docInfo}>
          <Text style={[typography.body, { fontWeight: "600", color: colors.textPrimary }]}>
            {payload.title || "School story"}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>
            {item.university} • {payload.story || "No story content"}
          </Text>
        </View>
        <Badge
          label={payload.is_active === false ? "Inactive" : "Active"}
          variant={payload.is_active === false ? "warning" : "success"}
        />
      </View>
    );
  };

  const Field = ({ label, value, onChangeText, placeholder, multiline = false }: any) => (
    <View style={styles.fieldGroup}>
      <Text style={[typography.label, { color: colors.textMuted, marginBottom: 8 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.formInput,
          multiline && styles.formTextArea,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
        ]}
      />
    </View>
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

      <View style={[styles.scopeNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "700" }]}>
          Learning context rules
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
          Discipline docs apply to one department across every school. Community stories apply to one school across every department.
        </Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === "docs" && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab("docs")}
        >
          <Text style={[styles.tabText, { color: activeTab === "docs" ? "#FFF" : colors.textSecondary }]}>Discipline docs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === "stories" && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab("stories")}
        >
          <Text style={[styles.tabText, { color: activeTab === "stories" ? "#FFF" : colors.textSecondary }]}>School stories</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} width="100%" height={70} borderRadius={12} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : activeTab === "docs" ? (
        <FlatList
          data={filteredDocs}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>No discipline documents found.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredPatterns}
          renderItem={renderPattern}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>No school stories found.</Text>
            </View>
          }
        />
      )}

      {canUpload && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => setModalType(activeTab === "docs" ? "doc" : "story")}
        >
          <Plus size={24} color="#FFF" />
        </TouchableOpacity>
      )}

      <Modal visible={modalType !== null} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>
                {modalType === "doc" ? "New discipline document" : "New school story"}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {modalType === "doc" ? (
                <>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 16 }]}>
                    This will apply to every student in this department across all schools.
                  </Text>
                  <Field label="Faculty" value={docForm.faculty} onChangeText={(faculty: string) => setDocForm(prev => ({ ...prev, faculty }))} placeholder="Engineering" />
                  <Field label="Department" value={docForm.department} onChangeText={(department: string) => setDocForm(prev => ({ ...prev, department }))} placeholder="Mechanical Engineering" />
                  <Field label="Document content/reference" value={docForm.document_ref} onChangeText={(document_ref: string) => setDocForm(prev => ({ ...prev, document_ref }))} placeholder="Paste the discipline instruction document or source reference" multiline />
                  <Field label="Version notes" value={docForm.version_notes} onChangeText={(version_notes: string) => setDocForm(prev => ({ ...prev, version_notes }))} placeholder="What changed in this version?" />
                </>
              ) : (
                <>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 16 }]}>
                    This story will be available as context for every student in this school.
                  </Text>
                  <Field label="University / school" value={storyForm.university} onChangeText={(university: string) => setStoryForm(prev => ({ ...prev, university }))} placeholder="University of Uyo" />
                  <Field label="Story title" value={storyForm.title} onChangeText={(title: string) => setStoryForm(prev => ({ ...prev, title }))} placeholder="Campus power outage during practical week" />
                  <Field label="Story / incident" value={storyForm.story} onChangeText={(story: string) => setStoryForm(prev => ({ ...prev, story }))} placeholder="Describe what happened and how Akademi can use it as an explanation example." multiline />
                  <Field label="Tags" value={storyForm.tags} onChangeText={(tags: string) => setStoryForm(prev => ({ ...prev, tags }))} placeholder="electricity, hostel, practical" />
                </>
              )}
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.65 : 1 }]}
                disabled={saving}
                onPress={modalType === "doc" ? handleSaveDocument : handleSaveStory}
              >
                <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save context"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  scopeNote: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tabPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
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
  },
  modalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.65)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: "88%",
    padding: 18,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  formInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formTextArea: {
    minHeight: 130,
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 14,
    marginTop: 8,
    paddingVertical: 15,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  }
});
