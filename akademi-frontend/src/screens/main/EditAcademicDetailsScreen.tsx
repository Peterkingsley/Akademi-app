import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BookOpen, CalendarDays, GraduationCap, Landmark, Layers, Plus, Trash2 } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { AcademicProfile, StudentAcademicCourse, userService } from "../../services/user";
import { useAuthStore } from "../../store/useAuthStore";

type CourseDraft = StudentAcademicCourse & { localId: string };

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
  const [courses, setCourses] = useState<CourseDraft[]>([]);

  useEffect(() => {
    fetchProfile();
  }, []);

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

  const parsedLevel = useMemo(() => parseInt(form.level.replace(/[^0-9]/g, ""), 10), [form.level]);

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
          <Input label="University" placeholder="e.g. University of Lagos" value={form.university} onChangeText={(text) => setForm({ ...form, university: text })} leftIcon={<Landmark size={20} color={colors.textMuted} />} />
          <Input label="Faculty" placeholder="e.g. Engineering" value={form.faculty} onChangeText={(text) => setForm({ ...form, faculty: text })} leftIcon={<BookOpen size={20} color={colors.textMuted} />} />
          <Input label="Department" placeholder="e.g. Computer Engineering" value={form.department} onChangeText={(text) => setForm({ ...form, department: text })} leftIcon={<BookOpen size={20} color={colors.textMuted} />} />
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
    </Screen>
  );
};

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
});
