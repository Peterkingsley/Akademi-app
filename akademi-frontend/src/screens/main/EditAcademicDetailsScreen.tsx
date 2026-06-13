import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, GraduationCap, Landmark, Layers, Plus, Search, Trash2, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { AcademicProfile, StudentAcademicCourse, userService } from "../../services/user";
import { useAuthStore } from "../../store/useAuthStore";
import api from "../../services/api";

type CourseDraft = StudentAcademicCourse & { localId: string };
type UniversityOption = { id: string; name: string; location?: string; type?: string };
type DepartmentOption = { id: string; name: string; faculty: string };
type PickerMode = "university" | "faculty" | "department";

const todayIso = () => new Date().toISOString().slice(0, 10);
const defaultEndIso = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 4);
  return date.toISOString().slice(0, 10);
};

const toDateInput = (value?: string) => value ? new Date(value).toISOString().slice(0, 10) : "";

export const EditAcademicDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const updateUser = useAuthStore((state) => state.updateUser);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [form, setForm] = useState({ university: "", faculty: "", department: "", level: "" });
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [courses, setCourses] = useState<CourseDraft[]>([]);

  useEffect(() => {
    fetchProfile();
    fetchUniversities();
  }, []);

  useEffect(() => {
    if (selectedUniversityId) {
      fetchDepartments(selectedUniversityId);
    }
  }, [selectedUniversityId]);

  useEffect(() => {
    if (!selectedUniversityId && form.university && universities.length > 0) {
      matchUniversity(form.university, universities);
    }
  }, [form.university, selectedUniversityId, universities]);

  const fetchProfile = async () => {
    try {
      const data = await userService.getAcademicProfile();
      setProfile(data);
      setForm({
        university: data.university || "",
        faculty: data.faculty || "",
        department: data.department || "",
        level: data.level?.toString() || "",
      });
      matchUniversity(data.university || "");
      setCourses(
        (data.student_courses || []).map((course) => ({
          ...course,
          semester_start: toDateInput(course.semester_start),
          semester_end: toDateInput(course.semester_end),
          localId: course.id || `${course.code}-${course.level}-${course.semester}`,
        })),
      );
    } catch (error) {
      Alert.alert("Error", "Failed to fetch academic details");
    } finally {
      setFetching(false);
    }
  };

  const fetchUniversities = async () => {
    try {
      setSchoolLoading(true);
      const response = await api.get<UniversityOption[]>("/universities");
      const list = response.data || [];
      setUniversities(list);
      if (form.university) matchUniversity(form.university, list);
    } catch (error) {
      Alert.alert("School list unavailable", "Could not load universities. Please try again.");
    } finally {
      setSchoolLoading(false);
    }
  };

  const matchUniversity = (name: string, source = universities) => {
    const found = source.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (found) setSelectedUniversityId(found.id);
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

  const parsedLevel = useMemo(() => parseInt(form.level.replace(/[^0-9]/g, ""), 10), [form.level]);
  const faculties = useMemo(() => Array.from(new Set(departments.map((item) => item.faculty))).sort(), [departments]);
  const filteredPickerItems = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();

    if (pickerMode === "university") {
      return universities.filter((item) => !query || item.name.toLowerCase().includes(query) || item.location?.toLowerCase().includes(query));
    }

    if (pickerMode === "faculty") {
      return faculties.filter((item) => !query || item.toLowerCase().includes(query));
    }

    if (pickerMode === "department") {
      return departments.filter((item) =>
        item.faculty === form.faculty &&
        (!query || item.name.toLowerCase().includes(query))
      );
    }

    return [];
  }, [departments, faculties, form.faculty, pickerMode, pickerSearch, universities]);

  const openPicker = (mode: PickerMode) => {
    if (mode !== "university" && !form.university) {
      Alert.alert("Pick university first", "Select your school before choosing faculty or department.");
      return;
    }

    if (mode === "department" && !form.faculty) {
      Alert.alert("Pick faculty first", "Select your faculty before choosing department.");
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
    if (pickerMode === "university") {
      setSelectedUniversityId(item.id);
      setForm((current) => ({
        ...current,
        university: item.name,
        faculty: "",
        department: "",
      }));
      setDepartments([]);
    }

    if (pickerMode === "faculty") {
      setForm((current) => ({
        ...current,
        faculty: item,
        department: "",
      }));
    }

    if (pickerMode === "department") {
      setForm((current) => ({
        ...current,
        department: item.name,
      }));
    }

    closePicker();
  };

  const addCourse = () => {
    setCourses((current) => [
      ...current,
      {
        localId: `new-${Date.now()}`,
        code: "",
        name: "",
        level: Number.isNaN(parsedLevel) ? 100 : parsedLevel,
        semester: 1,
        semester_start: todayIso(),
        semester_end: defaultEndIso(),
      },
    ]);
  };

  const updateCourse = (localId: string, patch: Partial<CourseDraft>) => {
    setCourses((current) => current.map((course) => course.localId === localId ? { ...course, ...patch } : course));
  };

  const removeCourse = (localId: string) => {
    setCourses((current) => current.filter((course) => course.localId !== localId));
  };

  const handleSave = async () => {
    if (!form.university || !form.faculty || !form.department || !form.level) {
      Alert.alert("Missing details", "University, faculty, department, and level are required.");
      return;
    }

    if (Number.isNaN(parsedLevel)) {
      Alert.alert("Invalid level", "Enter a valid level like 100, 200, or 300.");
      return;
    }

    const cleanedCourses = courses
      .map((course) => ({ ...course, code: course.code.trim().toUpperCase(), name: course.name?.trim() || null }))
      .filter((course) => course.code.length > 0);

    if (cleanedCourses.length === 0) {
      Alert.alert("Add course codes", "Add at least one course code for the semester.");
      return;
    }

    setLoading(true);
    try {
      const updated = await userService.updateAcademicProfile({
        university: form.university.trim(),
        faculty: form.faculty.trim(),
        department: form.department.trim(),
        level: parsedLevel,
        student_courses: cleanedCourses,
      });
      updateUser({
        university: updated.university,
        faculty: updated.faculty,
        department: updated.department,
        level: updated.level,
        courses: updated.courses,
      });
      Alert.alert("Saved", "Academic details and semester courses updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert("Could not save", error?.response?.data?.message || "Failed to update academic details");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Screen title="Academic Details" onBack={() => navigation.goBack()}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      </Screen>
    );
  }

  return (
    <Screen style={{ flex: 1 }} title="Academic Details" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <GraduationCap size={42} color={colors.primary} />
          <Text style={styles.title}>Academic Structure</Text>
          <Text style={styles.subtitle}>Keep school, department, level, semester, and course codes accurate so uploads and study tools stay organized.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>School details</Text>
          <PickerField label="University" value={form.university} placeholder="Pick your university" icon={<Landmark size={20} color={colors.textMuted} />} onPress={() => openPicker("university")} />
          <PickerField label="Faculty" value={form.faculty} placeholder={form.university ? "Pick faculty" : "Pick university first"} icon={<BookOpen size={20} color={colors.textMuted} />} onPress={() => openPicker("faculty")} disabled={!form.university} />
          <PickerField label="Department" value={form.department} placeholder={form.faculty ? "Pick department" : "Pick faculty first"} icon={<BookOpen size={20} color={colors.textMuted} />} onPress={() => openPicker("department")} disabled={!form.faculty} />
          <Input label="Current Level" placeholder="e.g. 300" value={form.level} onChangeText={(text) => setForm({ ...form, level: text })} keyboardType="numeric" leftIcon={<Layers size={20} color={colors.textMuted} />} />
        </View>

        <View style={styles.courseHeader}>
          <View>
            <Text style={styles.sectionTitle}>Semester courses</Text>
            <Text style={styles.sectionSubtitle}>Add every course code for its level and semester.</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={addCourse}>
            <Plus size={16} color={colors.background} />
          </TouchableOpacity>
        </View>

        {courses.map((course, index) => (
          <View key={course.localId} style={styles.courseCard}>
            <View style={styles.courseCardHeader}>
              <Text style={styles.courseCardTitle}>Course {index + 1}</Text>
              <TouchableOpacity onPress={() => removeCourse(course.localId)} style={styles.deleteButton}>
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
            <Input label="Course code" placeholder="e.g. EEE 301" value={course.code} onChangeText={(text) => updateCourse(course.localId, { code: text })} leftIcon={<BookOpen size={20} color={colors.textMuted} />} />
            <Input label="Course name optional" placeholder="e.g. Circuit Theory" value={course.name || ""} onChangeText={(text) => updateCourse(course.localId, { name: text })} leftIcon={<BookOpen size={20} color={colors.textMuted} />} />
            <View style={styles.twoColumn}>
              <View style={styles.column}>
                <Input label="Level" placeholder="300" value={String(course.level || "")} onChangeText={(text) => updateCourse(course.localId, { level: parseInt(text.replace(/[^0-9]/g, ""), 10) || parsedLevel || 100 })} keyboardType="numeric" leftIcon={<Layers size={18} color={colors.textMuted} />} />
              </View>
              <View style={styles.column}>
                <Text style={styles.miniLabel}>Semester</Text>
                <View style={styles.semesterRow}>
                  {[1, 2].map((semester) => (
                    <TouchableOpacity key={semester} style={[styles.semesterChip, course.semester === semester && styles.semesterChipActive]} onPress={() => updateCourse(course.localId, { semester })}>
                      <Text style={[styles.semesterText, course.semester === semester && styles.semesterTextActive]}>{semester}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <Input label="Semester start" placeholder="YYYY-MM-DD" value={course.semester_start} onChangeText={(text) => updateCourse(course.localId, { semester_start: text })} leftIcon={<CalendarDays size={20} color={colors.textMuted} />} />
            <Input label="Semester end" placeholder="YYYY-MM-DD" value={course.semester_end} onChangeText={(text) => updateCourse(course.localId, { semester_end: text })} leftIcon={<CalendarDays size={20} color={colors.textMuted} />} />
          </View>
        ))}

        <Button label="Save Academic Structure" onPress={handleSave} loading={loading} style={styles.button} />
      </ScrollView>

      <Modal visible={!!pickerMode} transparent animationType="slide" onRequestClose={closePicker}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>
                  {pickerMode === "university" ? "Pick university" : pickerMode === "faculty" ? "Pick faculty" : "Pick department"}
                </Text>
                <Text style={styles.pickerSubtitle}>
                  {pickerMode === "university" ? "Choose from live Akademi school data." : form.university}
                </Text>
              </View>
              <TouchableOpacity onPress={closePicker} style={styles.closeButton}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>

            {schoolLoading ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={filteredPickerItems}
                keyExtractor={(item: any) => typeof item === "string" ? item : item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }: any) => {
                  const title = typeof item === "string" ? item : item.name;
                  const subtitle = typeof item === "string"
                    ? `${departments.filter((department) => department.faculty === item).length} departments`
                    : pickerMode === "university"
                      ? [item.type, item.location].filter(Boolean).join(" / ")
                      : item.faculty;
                  const active =
                    (pickerMode === "university" && title === form.university) ||
                    (pickerMode === "faculty" && title === form.faculty) ||
                    (pickerMode === "department" && title === form.department);

                  return (
                    <TouchableOpacity style={styles.pickerItem} onPress={() => handleSelectPickerItem(item)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerItemTitle}>{title}</Text>
                        {!!subtitle && <Text style={styles.pickerItemSubtitle}>{subtitle}</Text>}
                      </View>
                      {active ? <CheckCircle2 size={18} color={colors.primary} /> : <ChevronRight size={16} color={colors.textMuted} />}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyPicker}>
                    <Text style={styles.emptyPickerText}>No matching option found.</Text>
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

const PickerField = ({
  label,
  value,
  placeholder,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <View style={styles.pickerFieldWrap}>
    <Text style={styles.miniLabel}>{label}</Text>
    <TouchableOpacity style={[styles.pickerField, disabled && styles.pickerFieldDisabled]} onPress={onPress} disabled={disabled} activeOpacity={0.78}>
      {icon}
      <Text style={[styles.pickerValue, !value && styles.pickerPlaceholder]} numberOfLines={1}>{value || placeholder}</Text>
      <ChevronRight size={17} color={colors.textMuted} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 42 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { alignItems: "center", marginBottom: 20, marginTop: 8 },
  title: { ...typography.h2, color: colors.textPrimary, marginTop: 12, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", fontSize: 12, lineHeight: 18 },
  sectionCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginBottom: 20, padding: 14 },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, fontSize: 16 },
  sectionSubtitle: { ...typography.bodySmall, color: colors.textMuted, fontSize: 11, marginTop: 3 },
  courseHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, height: 42, justifyContent: "center", width: 42 },
  courseCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginBottom: 14, padding: 14 },
  courseCardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  courseCardTitle: { ...typography.h4, color: colors.textPrimary },
  deleteButton: { padding: 6 },
  twoColumn: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
  miniLabel: { color: colors.textSecondary, fontFamily: "SpaceMono-Regular", fontSize: 9.75, letterSpacing: 1.2, marginBottom: 8, textTransform: "uppercase" },
  semesterRow: { flexDirection: "row", gap: 8 },
  semesterChip: { alignItems: "center", backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flex: 1, height: 52, justifyContent: "center" },
  semesterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  semesterText: { ...typography.h4, color: colors.textSecondary },
  semesterTextActive: { color: colors.background },
  button: { marginTop: 6 },
  pickerFieldWrap: { marginBottom: 14 },
  pickerField: { alignItems: "center", backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: "row", minHeight: 56, paddingHorizontal: 14 },
  pickerFieldDisabled: { opacity: 0.55 },
  pickerValue: { ...typography.body, color: colors.textPrimary, flex: 1, marginLeft: 12 },
  pickerPlaceholder: { color: colors.textMuted },
  modalOverlay: { backgroundColor: "rgba(0,0,0,0.62)", flex: 1, justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: colors.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "82%", minHeight: "55%", padding: 18 },
  pickerHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  pickerTitle: { ...typography.h3, color: colors.textPrimary },
  pickerSubtitle: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  searchBox: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: "row", height: 48, marginBottom: 12, paddingHorizontal: 12 },
  searchInput: { color: colors.textPrimary, flex: 1, fontFamily: "Inter-Regular", fontSize: 14, marginLeft: 8 },
  pickerLoading: { alignItems: "center", justifyContent: "center", minHeight: 180 },
  pickerItem: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", minHeight: 62, paddingVertical: 10 },
  pickerItemTitle: { ...typography.body, color: colors.textPrimary, fontWeight: "700" },
  pickerItemSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  emptyPicker: { alignItems: "center", justifyContent: "center", padding: 32 },
  emptyPickerText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
});
