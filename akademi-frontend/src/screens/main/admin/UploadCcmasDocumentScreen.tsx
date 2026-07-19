import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, FlatList, Modal } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, DisciplineDocumentSplitPreview } from "../../../services/adminService";
import { Search, ChevronRight, BookOpen, X, Plus, AlertTriangle, Check } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";
import { Badge } from "../../../components/ui/Badge";
import api from "../../../services/api";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

// Dedicated screen for the one specific case DisciplineDocumentsScreen's general-purpose
// upload modal makes error-prone: uploading a real department-wide CCMAS document meant for
// splitting. No course-code field and no source-type picker exist here on purpose — this screen
// only ever creates department-wide CCMAS documents, then chains straight into the split
// preview so the admin never has to leave to find that action separately. Course-specific and
// international-reference uploads still go through the existing modal, unchanged.

type UniversityOption = { id: string; name: string; location?: string; type?: string };
type DepartmentOption = { id: string; name: string; faculty: string };
type PickerMode = "docUniversity" | "docFaculty" | "docDepartment";

export const UploadCcmasDocumentScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const navigation = useNavigation<StackNavigationProp<AdminStackParamList>>();

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
  });
  const [selectedDocFileName, setSelectedDocFileName] = useState("");
  const [selectedDocFile, setSelectedDocFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [splitPreview, setSplitPreview] = useState<DisciplineDocumentSplitPreview | null>(null);
  const [splitSelections, setSplitSelections] = useState<Record<string, { include: boolean; level: string }>>({});
  const [splitConfirming, setSplitConfirming] = useState(false);

  useEffect(() => {
    fetchUniversities();
  }, []);

  useEffect(() => {
    if (selectedDocUniversityId) {
      fetchDepartments(selectedDocUniversityId);
    }
  }, [selectedDocUniversityId]);

  const faculties = useMemo(() => Array.from(new Set(departments.map((item) => item.faculty))).sort(), [departments]);

  const filteredPickerItems = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (pickerMode === "docUniversity") {
      return universities.filter(
        (item) => !query || item.name.toLowerCase().includes(query) || item.location?.toLowerCase().includes(query),
      );
    }
    if (pickerMode === "docFaculty") {
      return faculties.filter((item) => !query || item.toLowerCase().includes(query));
    }
    if (pickerMode === "docDepartment") {
      return departments.filter((item) => item.faculty === docForm.faculty && (!query || item.name.toLowerCase().includes(query)));
    }
    return [];
  }, [departments, docForm.faculty, faculties, pickerMode, pickerSearch, universities]);

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
    if (pickerMode === "docUniversity") {
      setSelectedDocUniversityId(item.id);
      setDocForm((prev) => ({ ...prev, university: item.name, faculty: "", department: "" }));
      setDepartments([]);
    }
    if (pickerMode === "docFaculty") {
      setDocForm((prev) => ({ ...prev, faculty: item, department: "" }));
    }
    if (pickerMode === "docDepartment") {
      setDocForm((prev) => ({ ...prev, department: item.name }));
    }
    closePicker();
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
      const canReadAsText = [".txt", ".md", ".markdown", ".json", ".csv"].some((ext) => lowerName.endsWith(ext));
      const canExtractOnServer = [".pdf", ".docx"].some((ext) => lowerName.endsWith(ext));
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
      setDocForm((prev) => ({
        ...prev,
        document_ref: content.trim(),
        version_notes: prev.version_notes || `Uploaded from ${asset.name}`,
      }));
    } catch (error: any) {
      Alert.alert("Could not read file", error?.message || "Please try another text file.");
    }
  };

  const handleUploadAndPreview = async () => {
    if (!docForm.faculty.trim() || !docForm.department.trim() || (!docForm.document_ref.trim() && !selectedDocFile)) {
      Alert.alert("Missing details", "Faculty, department, and either a document file or pasted content are required.");
      return;
    }

    const basePayload = {
      faculty: docForm.faculty,
      department: docForm.department,
      document_ref: docForm.document_ref,
      source_type: "CCMAS" as const,
    };

    try {
      setUploading(true);
      const document = selectedDocFile
        ? await adminService.uploadDisciplineDocumentFile(
            { ...basePayload, version_notes: docForm.version_notes || `Uploaded from ${selectedDocFile.name}` },
            selectedDocFile,
          )
        : await adminService.uploadDisciplineDocument({
            ...basePayload,
            version_notes: docForm.version_notes || "Department-wide CCMAS document uploaded for splitting.",
          });
      setUploading(false);

      setPreviewLoading(true);
      const preview = await adminService.previewDisciplineDocumentSplit(document.id);
      setSplitPreview(preview);
      const initialSelections: Record<string, { include: boolean; level: string }> = {};
      preview.courses.forEach((course) => {
        initialSelections[course.course_code] = {
          include: !course.already_exists,
          level: course.level != null ? String(course.level) : "",
        };
      });
      setSplitSelections(initialSelections);
    } catch (error: any) {
      Alert.alert("Could not upload document", error?.response?.data?.message || "Please try again.");
    } finally {
      setUploading(false);
      setPreviewLoading(false);
    }
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

  const confirmSplit = async () => {
    if (!splitPreview) return;

    const selections = splitPreview.courses.map((course) => {
      const selection = splitSelections[course.course_code];
      return {
        course_code: course.course_code,
        level: selection?.level ? Number(selection.level) : null,
        content: course.full_content,
        include: Boolean(selection?.include),
      };
    });

    if (!selections.some((entry) => entry.include)) {
      Alert.alert("Nothing selected", "Check at least one course code to create.");
      return;
    }

    try {
      setSplitConfirming(true);
      await adminService.confirmDisciplineDocumentSplit(splitPreview.document_id, selections);
      Alert.alert("Split complete", "The selected course-code documents were created.", [
        { text: "Done", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert("Could not complete split", error?.response?.data?.message || "Please try again.");
    } finally {
      setSplitConfirming(false);
    }
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
    <Screen title="Upload CCMAS for Splitting">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {!splitPreview ? (
          <>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 16 }]}>
              Upload a real department-wide CCMAS curriculum document covering every course code at once. After
              upload, Akademi detects the course codes in it so you can review and split them into their own
              per-course documents — right here, without leaving this screen.
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
            <TouchableOpacity
              style={[styles.uploadFileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handlePickDocumentFile}
            >
              <BookOpen size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "700" }]}>
                  {selectedDocFileName ? selectedDocFileName : "Upload text file"}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  PDF/DOCX extracts on save. You can also paste/type below.
                </Text>
              </View>
              <Plus size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <Field
              label="Document content/reference"
              value={docForm.document_ref}
              onChangeText={(document_ref: string) => setDocForm((prev) => ({ ...prev, document_ref }))}
              placeholder="Paste the department-wide CCMAS document text"
              multiline
            />
            <Field
              label="Version notes"
              value={docForm.version_notes}
              onChangeText={(version_notes: string) => setDocForm((prev) => ({ ...prev, version_notes }))}
              placeholder="What is this document?"
            />
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: uploading || previewLoading ? 0.65 : 1 }]}
              disabled={uploading || previewLoading}
              onPress={handleUploadAndPreview}
            >
              <Text style={styles.saveButtonText}>
                {uploading ? "Uploading..." : previewLoading ? "Detecting course codes..." : "Upload & Prepare for Splitting"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 16 }]}>
              {splitPreview.courses.length} course code{splitPreview.courses.length === 1 ? "" : "s"} detected in this{" "}
              {splitPreview.department} document. Review before confirming — deselect any that look wrong.
            </Text>
            {splitPreview.courses.map((course) => {
              const selection = splitSelections[course.course_code] || { include: false, level: "" };
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
          </>
        )}
      </ScrollView>

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
                    <TouchableOpacity style={[styles.pickerRow, { borderBottomColor: colors.border }]} onPress={() => handleSelectPickerItem(item)}>
                      <View style={{ flex: 1 }}>
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
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 60,
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
  splitLevelGroup: {
    marginTop: 10,
  },
  splitLevelInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.65)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
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
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
});
