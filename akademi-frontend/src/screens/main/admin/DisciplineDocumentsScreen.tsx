import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, CommunityPattern, DisciplineDocument, DisciplineDocumentSplitPreview } from "../../../services/adminService";
import { Search, Plus, ChevronRight, BookOpen, Map, Filter, Newspaper, X, Scissors, AlertTriangle, Check } from "lucide-react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useAuthStore } from "../../../store/useAuthStore";
import api from "../../../services/api";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

type UniversityOption = { id: string; name: string; location?: string; type?: string };
type DepartmentOption = { id: string; name: string; faculty: string };
type PickerMode = "storyUniversity" | "docUniversity" | "docFaculty" | "docDepartment";

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
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedDocUniversityId, setSelectedDocUniversityId] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [docForm, setDocForm] = useState({
    university: "",
    faculty: "",
    department: "",
    document_ref: "",
    version_notes: "",
    course_code: "",
    source_type: "" as "" | "CCMAS" | "INTERNATIONAL_REFERENCE",
    reference_name: "",
    level: "",
  });
  const [selectedDocFileName, setSelectedDocFileName] = useState("");
  const [selectedDocFile, setSelectedDocFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [storyForm, setStoryForm] = useState({ university: "", title: "", story: "", context_type: "campus_context", tags: "" });

  const canUpload = user?.admin_role === 'SUPER_ADMIN' || user?.admin_role === 'CONTENT_MANAGER';

  const [splitDocument, setSplitDocument] = useState<DisciplineDocument | null>(null);
  const [splitPreview, setSplitPreview] = useState<DisciplineDocumentSplitPreview | null>(null);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitSelections, setSplitSelections] = useState<Record<string, { include: boolean; level: string; scope_type: "NATIONAL_CORE" | "SCHOOL_SPECIFIC" }>>({});
  const [splitConfirming, setSplitConfirming] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchUniversities();
  }, []);

  // Refetch whenever this screen regains focus — e.g. returning here after uploading and
  // splitting a CCMAS document on UploadCcmasDocumentScreen, so the new per-course documents
  // show up without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      fetchDocuments();
    }, []),
  );

  useEffect(() => {
    if (selectedDocUniversityId) {
      fetchDepartments(selectedDocUniversityId);
    }
  }, [selectedDocUniversityId]);

  const faculties = useMemo(() => Array.from(new Set(departments.map(item => item.faculty))).sort(), [departments]);

  const filteredPickerItems = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (pickerMode === "storyUniversity" || pickerMode === "docUniversity") {
      return universities.filter(item => !query || item.name.toLowerCase().includes(query) || item.location?.toLowerCase().includes(query));
    }
    if (pickerMode === "docFaculty") {
      return faculties.filter(item => !query || item.toLowerCase().includes(query));
    }
    if (pickerMode === "docDepartment") {
      return departments.filter(item => item.faculty === docForm.faculty && (!query || item.name.toLowerCase().includes(query)));
    }
    return [];
  }, [departments, docForm.faculty, faculties, pickerMode, pickerSearch, universities]);

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

  const fetchUniversities = async () => {
    try {
      setSchoolLoading(true);
      const response = await api.get<UniversityOption[]>("/universities");
      setUniversities(response.data || []);
    } catch (error) {
      Alert.alert("School list unavailable", "Could not load schools from Akademi database.");
    } finally {
      setSchoolLoading(false);
    }
  };

  const fetchDepartments = async (universityId: string) => {
    try {
      setSchoolLoading(true);
      const response = await api.get<DepartmentOption[]>(`/universities/${universityId}/departments`);
      setDepartments(response.data || []);
    } catch (error) {
      setDepartments([]);
      Alert.alert("Department list unavailable", "Could not load faculties and departments for this school.");
    } finally {
      setSchoolLoading(false);
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

  const openSplit = async (document: DisciplineDocument) => {
    setSplitDocument(document);
    setSplitPreview(null);
    setSplitSelections({});
    setSplitLoading(true);
    try {
      const preview = await adminService.previewDisciplineDocumentSplit(document.id);
      setSplitPreview(preview);
      const initialSelections: Record<string, { include: boolean; level: string; scope_type: "NATIONAL_CORE" | "SCHOOL_SPECIFIC" }> = {};
      preview.courses.forEach((course) => {
        initialSelections[course.course_code] = {
          include: !course.already_exists,
          level: course.level != null ? String(course.level) : "",
          scope_type: course.scope_type,
        };
      });
      setSplitSelections(initialSelections);
    } catch (error: any) {
      Alert.alert("Could not preview split", error?.response?.data?.message || "Please try again.");
      setSplitDocument(null);
    } finally {
      setSplitLoading(false);
    }
  };

  const closeSplit = () => {
    setSplitDocument(null);
    setSplitPreview(null);
    setSplitSelections({});
  };

  const toggleSplitInclude = (courseCode: string) => {
    setSplitSelections((prev) => ({
      ...prev,
      [courseCode]: { ...prev[courseCode], include: !prev[courseCode]?.include },
    }));
  };

  const updateSplitLevel = (courseCode: string, level: string) => {
    setSplitSelections((prev) => ({
      ...prev,
      [courseCode]: { ...prev[courseCode], level: level.replace(/[^0-9]/g, "") },
    }));
  };

  const setSplitScope = (courseCode: string, scopeType: "NATIONAL_CORE" | "SCHOOL_SPECIFIC") => {
    setSplitSelections((prev) => ({
      ...prev,
      [courseCode]: { ...prev[courseCode], scope_type: scopeType },
    }));
  };

  const confirmSplit = async () => {
    if (!splitDocument || !splitPreview) return;

    const selections = splitPreview.courses.map((course) => {
      const selection = splitSelections[course.course_code];
      return {
        course_code: course.course_code,
        level: selection?.level ? Number(selection.level) : null,
        content: course.full_content,
        include: Boolean(selection?.include),
        scope_type: selection?.scope_type || course.scope_type,
      };
    });

    if (!selections.some((entry) => entry.include)) {
      Alert.alert("Nothing selected", "Check at least one course code to create.");
      return;
    }

    try {
      setSplitConfirming(true);
      await adminService.confirmDisciplineDocumentSplit(splitDocument.id, selections);
      Alert.alert("Split complete", "The selected course-code documents were created.");
      closeSplit();
      fetchDocuments();
    } catch (error: any) {
      Alert.alert("Could not complete split", error?.response?.data?.message || "Please try again.");
    } finally {
      setSplitConfirming(false);
    }
  };

  const openPicker = (mode: PickerMode) => {
    if (mode === "docFaculty" && !docForm.university) {
      Alert.alert("Pick school first", "Choose a school so Akademi can load real faculties.");
      return;
    }
    if (mode === "docDepartment" && !docForm.faculty) {
      Alert.alert("Pick faculty first", "Choose a faculty before selecting department.");
      return;
    }
    setPickerMode(mode);
    setPickerSearch("");
  };

  const closePicker = () => {
    setPickerMode(null);
    setPickerSearch("");
  };

  const handleSelectPickerItem = (item: any) => {
    if (pickerMode === "storyUniversity") {
      setStoryForm(prev => ({ ...prev, university: item.name }));
    }
    if (pickerMode === "docUniversity") {
      setSelectedDocUniversityId(item.id);
      setDocForm(prev => ({ ...prev, university: item.name, faculty: "", department: "" }));
      setDepartments([]);
    }
    if (pickerMode === "docFaculty") {
      setDocForm(prev => ({ ...prev, faculty: item, department: "" }));
    }
    if (pickerMode === "docDepartment") {
      setDocForm(prev => ({ ...prev, department: item.name }));
    }
    closePicker();
  };

  const handleSaveDocument = async () => {
    if (!docForm.faculty.trim() || !docForm.department.trim() || (!docForm.document_ref.trim() && !selectedDocFile)) {
      Alert.alert("Missing details", "Faculty, department, and either a document file or pasted content are required.");
      return;
    }

    const courseCode = docForm.course_code.trim();
    const sourceType = courseCode ? (docForm.source_type || "CCMAS") : "";
    if (courseCode && sourceType === "INTERNATIONAL_REFERENCE" && !docForm.reference_name.trim()) {
      Alert.alert("Missing reference name", "International reference documents need a reference name (e.g. \"MIT OCW — 8.01\").");
      return;
    }

    const payload = {
      ...docForm,
      course_code: courseCode || undefined,
      source_type: sourceType || undefined,
      reference_name: sourceType === "INTERNATIONAL_REFERENCE" ? docForm.reference_name.trim() : undefined,
      level: courseCode && sourceType === "CCMAS" && docForm.level.trim() ? Number(docForm.level.trim()) : undefined,
      university_id: selectedDocUniversityId,
    };

    try {
      setSaving(true);
      if (selectedDocFile) {
        await adminService.uploadDisciplineDocumentFile({
          ...payload,
          version_notes: docForm.version_notes || `Uploaded from ${selectedDocFile.name}`,
        }, selectedDocFile);
      } else {
        await adminService.uploadDisciplineDocument({
          ...payload,
          version_notes: docForm.version_notes || "Updated department-wide discipline document.",
        });
      }
      setDocForm({ university: "", faculty: "", department: "", document_ref: "", version_notes: "", course_code: "", source_type: "", reference_name: "", level: "" });
      setSelectedDocFileName("");
      setSelectedDocFile(null);
      setSelectedDocUniversityId(null);
      closeModal();
      fetchDocuments();
    } catch (error: any) {
      Alert.alert("Could not save document", error?.response?.data?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handlePickDocumentFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "text/markdown",
          "application/json",
          "text/csv",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const lowerName = asset.name.toLowerCase();
      const canReadAsText = [".txt", ".md", ".markdown", ".json", ".csv"].some(ext => lowerName.endsWith(ext));
      const canExtractOnServer = [".pdf", ".docx"].some(ext => lowerName.endsWith(ext));
      if (!canReadAsText && !canExtractOnServer) {
        Alert.alert("Unsupported file", "Upload PDF, DOCX, TXT, MD, JSON, or CSV files.");
        return;
      }

      let content = "";
      if (canReadAsText) {
        content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
        if (!content.trim()) {
          Alert.alert("Empty file", "This file does not contain readable text.");
          return;
        }
      }

      setSelectedDocFileName(asset.name);
      setSelectedDocFile(asset);
      setDocForm(prev => ({
        ...prev,
        document_ref: content.trim(),
        version_notes: prev.version_notes || `Uploaded from ${asset.name}`,
      }));
    } catch (error: any) {
      Alert.alert("Could not read file", error?.message || "Please try another text file.");
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
        {!item.course_code && item.source_type === "CCMAS" && (
          <TouchableOpacity
            style={[styles.splitButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={() => openSplit(item)}
          >
            <Scissors size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
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

  const PickerField = ({ label, value, placeholder, onPress, disabled = false }: any) => (
    <View style={styles.fieldGroup}>
      <Text style={[typography.label, { color: colors.textMuted, marginBottom: 8 }]}>{label}</Text>
      <TouchableOpacity
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.formInput,
          styles.pickerInput,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.55 : 1 },
        ]}
      >
        <Text style={[styles.pickerText, { color: value ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </TouchableOpacity>
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

      {canUpload && activeTab === "docs" && (
        <TouchableOpacity
          style={[styles.splitFab, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={() => navigation.navigate("UploadCcmasDocument")}
        >
          <Scissors size={16} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary, fontWeight: "700", marginLeft: 6 }]}>
            Upload CCMAS for Splitting
          </Text>
        </TouchableOpacity>
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
                  <PickerField label="Reference school" value={docForm.university} placeholder="Pick a school from Akademi database" onPress={() => openPicker("docUniversity")} />
                  <PickerField label="Faculty" value={docForm.faculty} placeholder={docForm.university ? "Pick faculty" : "Pick school first"} onPress={() => openPicker("docFaculty")} disabled={!docForm.university} />
                  <PickerField label="Department" value={docForm.department} placeholder={docForm.faculty ? "Pick department" : "Pick faculty first"} onPress={() => openPicker("docDepartment")} disabled={!docForm.faculty} />
                  <Field
                    label="Course code (optional — leave blank for department-wide)"
                    value={docForm.course_code}
                    onChangeText={(course_code: string) => setDocForm(prev => ({ ...prev, course_code: course_code.toUpperCase() }))}
                    placeholder="e.g. PHY108"
                  />
                  {!!docForm.course_code.trim() && (
                    <>
                      <View style={styles.fieldGroup}>
                        <Text style={[typography.label, { color: colors.textMuted, marginBottom: 8 }]}>Source type</Text>
                        <View style={styles.sourceTypeRow}>
                          {(["CCMAS", "INTERNATIONAL_REFERENCE"] as const).map((option) => {
                            const active = (docForm.source_type || "CCMAS") === option;
                            return (
                              <TouchableOpacity
                                key={option}
                                onPress={() => setDocForm(prev => ({ ...prev, source_type: option }))}
                                style={[
                                  styles.sourceTypeChip,
                                  {
                                    backgroundColor: active ? colors.primary : colors.surface,
                                    borderColor: active ? colors.primary : colors.border,
                                  },
                                ]}
                              >
                                <Text style={{ color: active ? "#FFF" : colors.textPrimary, fontWeight: "700", fontSize: 12 }}>
                                  {option === "CCMAS" ? "CCMAS" : "International Reference"}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                      {(docForm.source_type || "CCMAS") === "CCMAS" ? (
                        <Field
                          label="Course level"
                          value={docForm.level}
                          onChangeText={(level: string) => setDocForm(prev => ({ ...prev, level: level.replace(/[^0-9]/g, "") }))}
                          placeholder="e.g. 100"
                        />
                      ) : (
                        <Field
                          label="Reference name"
                          value={docForm.reference_name}
                          onChangeText={(reference_name: string) => setDocForm(prev => ({ ...prev, reference_name }))}
                          placeholder='e.g. "MIT OCW — 8.01"'
                        />
                      )}
                    </>
                  )}
                  <TouchableOpacity
                    style={[styles.uploadFileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={handlePickDocumentFile}
                  >
                    <BookOpen size={18} color={colors.primary} />
                    <View style={styles.docInfo}>
                      <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "700" }]}>
                        {selectedDocFileName ? selectedDocFileName : "Upload text file"}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                        PDF/DOCX extracts on save. You can also paste/type below.
                      </Text>
                    </View>
                    <Plus size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                  <Field label="Document content/reference" value={docForm.document_ref} onChangeText={(document_ref: string) => setDocForm(prev => ({ ...prev, document_ref }))} placeholder="Paste the discipline instruction document or source reference" multiline />
                  <Field label="Version notes" value={docForm.version_notes} onChangeText={(version_notes: string) => setDocForm(prev => ({ ...prev, version_notes }))} placeholder="What changed in this version?" />
                </>
              ) : (
                <>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 16 }]}>
                    This story will be available as context for every student in this school.
                  </Text>
                  <PickerField label="University / school" value={storyForm.university} placeholder="Pick a school from Akademi database" onPress={() => openPicker("storyUniversity")} />
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

      <Modal visible={pickerMode !== null} animationType="slide" transparent onRequestClose={closePicker}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>
                  {pickerMode === "docFaculty" ? "Pick faculty" : pickerMode === "docDepartment" ? "Pick department" : "Pick school"}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  {pickerMode === "docFaculty" || pickerMode === "docDepartment" ? docForm.university : "Choose from live Akademi school data."}
                </Text>
              </View>
              <TouchableOpacity onPress={closePicker}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                placeholder="Search..."
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.textPrimary }]}
                value={pickerSearch}
                onChangeText={setPickerSearch}
              />
            </View>

            {schoolLoading ? (
              <View style={styles.emptyState}>
                <Text style={[typography.body, { color: colors.textSecondary }]}>Loading school data...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredPickerItems}
                keyExtractor={(item: any) => typeof item === "string" ? item : item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }: any) => {
                  const title = typeof item === "string" ? item : item.name;
                  const subtitle = typeof item === "string"
                    ? `${departments.filter(dept => dept.faculty === item).length} departments`
                    : pickerMode === "docDepartment"
                      ? item.faculty
                      : item.location || item.type || "Nigeria";
                  return (
                    <TouchableOpacity style={[styles.pickerRow, { borderBottomColor: colors.border }]} onPress={() => handleSelectPickerItem(item)}>
                      <View style={styles.docInfo}>
                        <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>{title}</Text>
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 3 }]}>{subtitle}</Text>
                      </View>
                      <ChevronRight size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={[typography.body, { color: colors.textSecondary }]}>No matches found.</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!splitDocument} animationType="slide" transparent onRequestClose={closeSplit}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Split into course codes</Text>
              <TouchableOpacity onPress={closeSplit}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {splitLoading ? (
              <View style={styles.splitLoadingBox}>
                <Text style={[typography.body, { color: colors.textSecondary }]}>Detecting course codes...</Text>
              </View>
            ) : splitPreview ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 16 }]}>
                  {splitPreview.courses.length} course code{splitPreview.courses.length === 1 ? "" : "s"} detected in
                  this {splitPreview.department} document. Review before confirming — deselect any that look wrong.
                </Text>
                {splitPreview.courses.map((course) => {
                  const selection = splitSelections[course.course_code] || { include: false, level: "", scope_type: course.scope_type };
                  return (
                    <View
                      key={course.course_code}
                      style={[
                        styles.splitCourseCard,
                        { backgroundColor: colors.surface, borderColor: selection.include ? colors.primary : colors.border },
                      ]}
                    >
                      <View style={styles.splitCourseHeader}>
                        <TouchableOpacity
                          onPress={() => toggleSplitInclude(course.course_code)}
                          style={[
                            styles.splitCheckbox,
                            {
                              borderColor: selection.include ? colors.primary : colors.border,
                              backgroundColor: selection.include ? colors.primary : "transparent",
                            },
                          ]}
                        >
                          {selection.include && <Check size={14} color="#FFF" />}
                        </TouchableOpacity>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleSplitInclude(course.course_code)}>
                          <Text style={[typography.body, { fontWeight: "700", color: colors.textPrimary }]}>
                            {course.course_code}
                          </Text>
                        </TouchableOpacity>
                        {course.already_exists && <Badge label="Already exists" variant="warning" />}
                      </View>
                      {!course.content_verified && (
                        <View style={styles.splitWarningRow}>
                          <AlertTriangle size={13} color={colors.error} />
                          <Text style={[typography.caption, { color: colors.error, marginLeft: 6, flex: 1 }]}>
                            Could not verify this text is a verbatim match to the source — review closely.
                          </Text>
                        </View>
                      )}
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]} numberOfLines={4}>
                        {course.content_preview}...
                      </Text>
                      <View style={styles.splitLevelScopeRow}>
                        <View style={styles.splitLevelGroup}>
                          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 6 }]}>Level</Text>
                          <TextInput
                            value={selection.level}
                            onChangeText={(value) => updateSplitLevel(course.course_code, value)}
                            placeholder="e.g. 100"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="number-pad"
                            style={[
                              styles.splitLevelInput,
                              { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.textPrimary },
                            ]}
                          />
                        </View>
                        <View style={styles.splitScopeGroup}>
                          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 6 }]}>Scope</Text>
                          <View style={styles.splitScopeRow}>
                            {(["NATIONAL_CORE", "SCHOOL_SPECIFIC"] as const).map((option) => {
                              const active = selection.scope_type === option;
                              return (
                                <TouchableOpacity
                                  key={option}
                                  onPress={() => setSplitScope(course.course_code, option)}
                                  style={[
                                    styles.splitScopeChip,
                                    {
                                      backgroundColor: active ? colors.primary : colors.surfaceElevated,
                                      borderColor: active ? colors.primary : colors.border,
                                    },
                                  ]}
                                >
                                  <Text style={{ color: active ? "#FFF" : colors.textPrimary, fontWeight: "700", fontSize: 11 }}>
                                    {option === "NATIONAL_CORE" ? "National" : "School-specific"}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                      {selection.scope_type === "SCHOOL_SPECIFIC" && !splitPreview.university_id && (
                        <View style={styles.splitWarningRow}>
                          <AlertTriangle size={13} color={colors.error} />
                          <Text style={[typography.caption, { color: colors.error, marginLeft: 6, flex: 1 }]}>
                            This source document has no Reference School on file — set one before confirming, or switch this back to National.
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary, opacity: splitConfirming ? 0.65 : 1 }]}
                  disabled={splitConfirming}
                  onPress={confirmSplit}
                >
                  <Text style={styles.saveButtonText}>{splitConfirming ? "Creating..." : "Confirm split"}</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
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
  splitFab: {
    position: "absolute",
    bottom: 92,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
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
  sourceTypeRow: {
    flexDirection: "row",
    gap: 10,
  },
  sourceTypeChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  uploadFileButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerInput: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pickerText: {
    flex: 1,
    fontSize: 14,
    marginRight: 10,
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: "78%",
    padding: 18,
  },
  pickerRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 64,
    paddingVertical: 12,
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
  },
  splitButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    marginRight: 10,
    width: 30,
  },
  splitLoadingBox: {
    alignItems: "center",
    padding: 40,
  },
  splitCourseCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  splitCourseHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  splitCheckbox: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  splitWarningRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 8,
  },
  splitLevelScopeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  splitLevelGroup: {
    width: 90,
  },
  splitLevelInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  splitScopeGroup: {
    flex: 1,
  },
  splitScopeRow: {
    flexDirection: "row",
    gap: 8,
  },
  splitScopeChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
});
