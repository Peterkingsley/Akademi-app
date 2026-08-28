import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, CommunityPattern, DisciplineDocument, DisciplineDocumentSplitPreview } from "../../../services/adminService";
import { Search, Plus, ChevronRight, BookOpen, Map, Filter, Newspaper, X, Scissors, AlertTriangle, Check, Layers, GraduationCap, Building2, UploadCloud, CheckCircle2 } from "lucide-react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useAuthStore } from "../../../store/useAuthStore";
import api from "../../../services/api";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";

type UniversityOption = { id: string; name: string; location?: string; type?: string };
type DepartmentOption = { id: string; name: string; faculty: string };
type PickerMode = "storyUniversity" | "docUniversity" | "docFaculty" | "docDepartment";

export const DisciplineDocumentsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const canUpload = user?.admin_role === "SUPER_ADMIN" || user?.admin_role === "CONTENT_MANAGER";

  const [splitDocument, setSplitDocument] = useState<DisciplineDocument | null>(null);
  const [splitPreview, setSplitPreview] = useState<DisciplineDocumentSplitPreview | null>(null);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitSelections, setSplitSelections] = useState<
    Record<string, { include: boolean; level: string; scope_type: "NATIONAL_CORE" | "SCHOOL_SPECIFIC" }>
  >({});
  const [splitConfirming, setSplitConfirming] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchUniversities();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDocuments();
    }, [])
  );

  useEffect(() => {
    if (selectedDocUniversityId) {
      fetchDepartments(selectedDocUniversityId);
    }
  }, [selectedDocUniversityId]);

  const faculties = useMemo(() => Array.from(new Set(departments.map((item) => item.faculty))).sort(), [departments]);

  const filteredPickerItems = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (pickerMode === "storyUniversity" || pickerMode === "docUniversity") {
      return universities.filter(
        (item) => !query || item.name.toLowerCase().includes(query) || item.location?.toLowerCase().includes(query)
      );
    }
    if (pickerMode === "docFaculty") {
      return faculties.filter((item) => !query || item.toLowerCase().includes(query));
    }
    if (pickerMode === "docDepartment") {
      return departments.filter(
        (item) => item.faculty === docForm.faculty && (!query || item.name.toLowerCase().includes(query))
      );
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
      setDocuments(docsData || []);
      setPatterns(patternsData || []);
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

  const filteredDocs = documents.filter(
    (doc) =>
      doc.faculty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.course_code && doc.course_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredPatterns = patterns.filter((pattern) => {
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
      const initialSelections: Record<
        string,
        { include: boolean; level: string; scope_type: "NATIONAL_CORE" | "SCHOOL_SPECIFIC" }
      > = {};
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
      style={styles.docRow}
      activeOpacity={0.7}
    >
      <View style={styles.iconBox}>
        <BookOpen size={20} color={colors.primary} />
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docTitle}>
          {item.department}
        </Text>
        <Text style={styles.docSub}>
          {item.faculty} {item.course_code ? `• ${item.course_code}` : ""}
        </Text>
      </View>
      <View style={styles.rightContent}>
        <Badge
          label={`v${item.version}.0`}
          variant="course"
        />
        {!item.course_code && item.source_type === "CCMAS" && (
          <TouchableOpacity
            style={styles.splitButton}
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
      <View style={styles.docRow}>
        <View style={styles.iconBox}>
          <Newspaper size={20} color={colors.primary} />
        </View>
        <View style={styles.docInfo}>
          <Text style={styles.docTitle}>
            {payload.title || "School story"}
          </Text>
          <Text style={styles.docSub} numberOfLines={2}>
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
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.formInput, multiline && styles.formTextArea]}
      />
    </View>
  );

  const PickerField = ({ label, value, placeholder, onPress, disabled = false }: any) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        disabled={disabled}
        onPress={onPress}
        style={[styles.formInput, styles.pickerInput, disabled && { opacity: 0.55 }]}
      >
        <Text style={[styles.pickerText, { color: value ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Screen style={styles.screen}>
      {/* Hero Header */}
      <LinearGradient colors={["#0B1E12", "#04110A"]} style={styles.heroHeader}>
        <View style={styles.heroTop}>
          <View style={styles.statusBadge}>
            <BookOpen size={12} color={colors.primary} />
            <Text style={styles.statusBadgeText}>{documents.length} DOCUMENTS LOADED</Text>
          </View>

          {canUpload && (
            <TouchableOpacity
              style={styles.ccmasBtn}
              onPress={() => navigation.navigate("UploadCcmasDocument")}
              activeOpacity={0.7}
            >
              <Scissors size={14} color="#FFF" />
              <Text style={styles.ccmasBtnText}>Split CCMAS</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.heroEyebrow}>ACADEMIC BENCHMARKS & SYLLABI</Text>
        <Text style={styles.heroTitle}>Discipline Documents</Text>
        <Text style={styles.heroSub}>Manage department-wide CCMAS benchmarks & campus context stories</Text>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Search faculty, dept, or course..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Segmented Tab Bar */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === "docs" && styles.tabPillActive]}
            onPress={() => setActiveTab("docs")}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === "docs" && styles.tabTextActive]}>
              Discipline Docs ({filteredDocs.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === "stories" && styles.tabPillActive]}
            onPress={() => setActiveTab("stories")}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === "stories" && styles.tabTextActive]}>
              School Stories ({filteredPatterns.length})
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingList}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="100%" height={74} borderRadius={14} />
          ))}
        </View>
      ) : activeTab === "docs" ? (
        <FlatList
          data={filteredDocs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <BookOpen size={44} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No discipline documents found</Text>
              <Text style={styles.emptySub}>Try searching for a different department or course code</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredPatterns}
          renderItem={renderPattern}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Newspaper size={44} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No school stories found</Text>
              <Text style={styles.emptySub}>Add campus context to help AI format local questions</Text>
            </View>
          }
        />
      )}

      {canUpload && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalType(activeTab === "docs" ? "doc" : "story")}
          activeOpacity={0.8}
        >
          <Plus size={24} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Upload Modal */}
      <Modal visible={modalType !== null} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalType === "doc" ? "New Discipline Document" : "New School Story"}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {modalType === "doc" ? (
                <>
                  <Text style={styles.modalSub}>
                    This document will apply to every student in this department across all schools.
                  </Text>
                  <PickerField
                    label="Reference school"
                    value={docForm.university}
                    placeholder="Pick a school from Akademi database"
                    onPress={() => openPicker("docUniversity")}
                  />
                  <PickerField
                    label="Faculty"
                    value={docForm.faculty}
                    placeholder={docForm.university ? "Pick faculty" : "Pick school first"}
                    onPress={() => openPicker("docFaculty")}
                    disabled={!docForm.university}
                  />
                  <PickerField
                    label="Department"
                    value={docForm.department}
                    placeholder={docForm.faculty ? "Pick department" : "Pick faculty first"}
                    onPress={() => openPicker("docDepartment")}
                    disabled={!docForm.faculty}
                  />
                  <Field
                    label="Course code (optional — leave blank for department-wide)"
                    value={docForm.course_code}
                    onChangeText={(course_code: string) =>
                      setDocForm((prev) => ({ ...prev, course_code: course_code.toUpperCase() }))
                    }
                    placeholder="e.g. PHY108"
                  />
                  {!!docForm.course_code.trim() && (
                    <>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Source type</Text>
                        <View style={styles.sourceTypeRow}>
                          {(["CCMAS", "INTERNATIONAL_REFERENCE"] as const).map((option) => {
                            const active = (docForm.source_type || "CCMAS") === option;
                            return (
                              <TouchableOpacity
                                key={option}
                                onPress={() => setDocForm((prev) => ({ ...prev, source_type: option }))}
                                style={[styles.sourceTypeChip, active && styles.sourceTypeChipActive]}
                              >
                                <Text style={[styles.sourceTypeText, active && styles.sourceTypeTextActive]}>
                                  {option === "CCMAS" ? "CCMAS" : "International Ref"}
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
                          onChangeText={(level: string) =>
                            setDocForm((prev) => ({ ...prev, level: level.replace(/[^0-9]/g, "") }))
                          }
                          placeholder="e.g. 100"
                        />
                      ) : (
                        <Field
                          label="Reference name"
                          value={docForm.reference_name}
                          onChangeText={(reference_name: string) => setDocForm((prev) => ({ ...prev, reference_name }))}
                          placeholder='e.g. "MIT OCW — 8.01"'
                        />
                      )}
                    </>
                  )}
                  <TouchableOpacity style={styles.uploadFileButton} onPress={handlePickDocumentFile}>
                    <UploadCloud size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.uploadFileTitle}>
                        {selectedDocFileName ? selectedDocFileName : "Upload text file"}
                      </Text>
                      <Text style={styles.uploadFileSub}>PDF, DOCX, TXT, MD or CSV files supported</Text>
                    </View>
                  </TouchableOpacity>
                  <Field
                    label="Document content/reference"
                    value={docForm.document_ref}
                    onChangeText={(document_ref: string) => setDocForm((prev) => ({ ...prev, document_ref }))}
                    placeholder="Paste the discipline instruction document or source reference"
                    multiline
                  />
                  <Field
                    label="Version notes"
                    value={docForm.version_notes}
                    onChangeText={(version_notes: string) => setDocForm((prev) => ({ ...prev, version_notes }))}
                    placeholder="What changed in this version?"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.modalSub}>
                    This story will be available as context for every student in this school.
                  </Text>
                  <PickerField
                    label="University / school"
                    value={storyForm.university}
                    placeholder="Pick a school from Akademi database"
                    onPress={() => openPicker("storyUniversity")}
                  />
                  <Field
                    label="Story title"
                    value={storyForm.title}
                    onChangeText={(title: string) => setStoryForm((prev) => ({ ...prev, title }))}
                    placeholder="Campus power outage during practical week"
                  />
                  <Field
                    label="Story / incident"
                    value={storyForm.story}
                    onChangeText={(story: string) => setStoryForm((prev) => ({ ...prev, story }))}
                    placeholder="Describe what happened and how Akademi can use it as an explanation example."
                    multiline
                  />
                  <Field
                    label="Tags"
                    value={storyForm.tags}
                    onChangeText={(tags: string) => setStoryForm((prev) => ({ ...prev, tags }))}
                    placeholder="electricity, hostel, practical"
                  />
                </>
              )}
              <TouchableOpacity
                style={[styles.saveButton, { opacity: saving ? 0.65 : 1 }]}
                disabled={saving}
                onPress={modalType === "doc" ? handleSaveDocument : handleSaveStory}
              >
                <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Context"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Picker Modal */}
      <Modal visible={pickerMode !== null} animationType="slide" transparent onRequestClose={closePicker}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {pickerMode === "docFaculty"
                    ? "Pick Faculty"
                    : pickerMode === "docDepartment"
                    ? "Pick Department"
                    : "Pick School"}
                </Text>
                <Text style={styles.modalSub}>
                  {pickerMode === "docFaculty" || pickerMode === "docDepartment"
                    ? docForm.university
                    : "Choose from live Akademi database."}
                </Text>
              </View>
              <TouchableOpacity onPress={closePicker}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                placeholder="Search..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                value={pickerSearch}
                onChangeText={setPickerSearch}
              />
            </View>

            {schoolLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptySub}>Loading school data...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredPickerItems}
                keyExtractor={(item: any) => (typeof item === "string" ? item : item.id)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }: any) => {
                  const title = typeof item === "string" ? item : item.name;
                  const subtitle =
                    typeof item === "string"
                      ? `${departments.filter((dept) => dept.faculty === item).length} departments`
                      : pickerMode === "docDepartment"
                      ? item.faculty
                      : item.location || item.type || "Nigeria";
                  return (
                    <TouchableOpacity style={styles.pickerRow} onPress={() => handleSelectPickerItem(item)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerRowTitle}>{title}</Text>
                        <Text style={styles.pickerRowSub}>{subtitle}</Text>
                      </View>
                      <ChevronRight size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptySub}>No matches found.</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Split Modal */}
      <Modal visible={!!splitDocument} animationType="slide" transparent onRequestClose={closeSplit}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Split into Course Codes</Text>
              <TouchableOpacity onPress={closeSplit}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {splitLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptySub}>Detecting course codes...</Text>
              </View>
            ) : splitPreview ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalSub}>
                  {splitPreview.courses.length} course codes detected in this {splitPreview.department} document.
                </Text>
                {splitPreview.courses.map((course) => {
                  const selection = splitSelections[course.course_code] || {
                    include: false,
                    level: "",
                    scope_type: course.scope_type,
                  };
                  return (
                    <View key={course.course_code} style={styles.splitCourseCard}>
                      <View style={styles.splitCourseHeader}>
                        <TouchableOpacity
                          onPress={() => toggleSplitInclude(course.course_code)}
                          style={[styles.splitCheckbox, selection.include && styles.splitCheckboxActive]}
                        >
                          {selection.include && <Check size={14} color="#FFF" />}
                        </TouchableOpacity>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleSplitInclude(course.course_code)}>
                          <Text style={styles.splitCourseTitle}>{course.course_code}</Text>
                        </TouchableOpacity>
                        {course.already_exists && <Badge label="Already exists" variant="warning" />}
                      </View>

                      <Text style={styles.splitPreviewText} numberOfLines={3}>
                        {course.content_preview}...
                      </Text>
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={[styles.saveButton, { opacity: splitConfirming ? 0.65 : 1 }]}
                  disabled={splitConfirming}
                  onPress={confirmSplit}
                >
                  <Text style={styles.saveButtonText}>{splitConfirming ? "Creating..." : "Confirm Split"}</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../../theme/colors").darkPalette) =>
  StyleSheet.create({
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
      marginBottom: 14,
    },
    heroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
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
    ccmasBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
    },
    ccmasBtnText: {
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
      marginBottom: 14,
    },
    searchRow: {
      marginBottom: 12,
    },
    searchBar: {
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
    tabRow: {
      flexDirection: "row",
      gap: 8,
    },
    tabPill: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: 12,
      fontFamily: "Inter-Medium",
      color: colors.textMuted,
    },
    tabTextActive: {
      color: "#FFF",
      fontFamily: "Inter-Bold",
    },
    loadingList: {
      paddingHorizontal: 20,
      gap: 12,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 100,
      gap: 12,
    },
    docRow: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: "rgba(34, 197, 94, 0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    docInfo: {
      flex: 1,
      marginRight: 8,
    },
    docTitle: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: colors.textPrimary,
    },
    docSub: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: colors.textSecondary,
      marginTop: 2,
    },
    rightContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    splitButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyState: {
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
    fab: {
      position: "absolute",
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      elevation: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 22,
      maxHeight: "88%",
    },
    pickerSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 22,
      maxHeight: "80%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
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
      marginBottom: 14,
    },
    fieldGroup: {
      marginBottom: 14,
    },
    fieldLabel: {
      fontSize: 10,
      fontFamily: "SpaceMono-Regular",
      color: colors.textMuted,
      marginBottom: 6,
    },
    formInput: {
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
    formTextArea: {
      height: 110,
      paddingTop: 12,
    },
    pickerInput: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    pickerText: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
    },
    sourceTypeRow: {
      flexDirection: "row",
      gap: 10,
    },
    sourceTypeChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    sourceTypeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sourceTypeText: {
      fontSize: 12,
      fontFamily: "Inter-Medium",
      color: colors.textSecondary,
    },
    sourceTypeTextActive: {
      color: "#FFF",
      fontFamily: "Inter-Bold",
    },
    uploadFileButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 14,
    },
    uploadFileTitle: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: colors.textPrimary,
    },
    uploadFileSub: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
      marginTop: 2,
    },
    saveButton: {
      backgroundColor: colors.primary,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 10,
      marginBottom: 20,
    },
    saveButtonText: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: "#FFF",
    },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerRowTitle: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
    },
    pickerRowSub: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
      marginTop: 2,
    },
    splitCourseCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
    },
    splitCourseHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    splitCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    splitCheckboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    splitCourseTitle: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
    },
    splitPreviewText: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
      marginTop: 6,
    },
  });

