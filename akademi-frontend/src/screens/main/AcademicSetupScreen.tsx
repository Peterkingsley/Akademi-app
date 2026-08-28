import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CheckCircle2, ChevronRight, Plus, Search, X } from "lucide-react-native";
import api from "../../services/api";
import { userService } from "../../services/user";
import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAcademicSetupStore } from "../../store/useAcademicSetupStore";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

type University = { id: string; name: string; location?: string | null };
type Department = { id: string; name: string; faculty: string };
type Course = { id: string; code: string; name?: string | null; level: number; semester: number };
type SetupStep = "university" | "faculty" | "department" | "level" | "courses";
const steps: SetupStep[] = ["university", "faculty", "department", "level", "courses"];
const levels = [100, 200, 300, 400, 500, 600];
const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, " ");

export const AcademicSetupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const pendingDestination = useAcademicSetupStore((state) => state.pendingDestination);
  const clearPendingDestination = useAcademicSetupStore((state) => state.clearPendingDestination);
  const [step, setStep] = useState<SetupStep>("university");
  const [universities, setUniversities] = useState<University[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [faculty, setFaculty] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Course[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = steps.indexOf(step);
  const faculties = useMemo(() => Array.from(new Set(departments.map((item) => item.faculty))).sort(), [departments]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (step === "university") return universities.filter((item) => !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery));
    if (step === "faculty") return faculties.filter((item) => !normalizedQuery || item.toLowerCase().includes(normalizedQuery));
    if (step === "department") return departments.filter((item) => item.faculty === faculty && (!normalizedQuery || item.name.toLowerCase().includes(normalizedQuery)));
    return [];
  }, [departments, faculties, faculty, query, step, universities]);

  useEffect(() => { loadUniversities(); }, []);
  useEffect(() => { if (selectedUniversity) loadDepartments(selectedUniversity.id); }, [selectedUniversity]);
  useEffect(() => { if (selectedUniversity && selectedDepartment && level) loadSuggestions(); }, [selectedUniversity, selectedDepartment, level]);

  const loadUniversities = async () => {
    setLoading(true); setError(null);
    try { const response = await api.get<University[]>("/universities", { params: { limit: 1000 } }); setUniversities(response.data || []); }
    catch { setError("We couldn't load schools right now. Try again."); }
    finally { setLoading(false); }
  };
  const loadDepartments = async (universityId: string) => {
    setLoading(true); setError(null);
    try { const response = await api.get<Department[]>(`/universities/${universityId}/departments`); setDepartments(response.data || []); }
    catch { setError("We couldn't load faculties and departments right now. Try again."); }
    finally { setLoading(false); }
  };
  const loadSuggestions = async () => {
    if (!selectedUniversity || !selectedDepartment || !level) return;
    setLoading(true); setError(null);
    try { const response = await api.get<Course[]>(`/universities/${selectedUniversity.id}/departments/${selectedDepartment.id}/courses`, { params: { level } }); setSuggestions(response.data || []); }
    catch { setError("We couldn't load course suggestions. You can still add course codes."); }
    finally { setLoading(false); }
  };
  const selectUniversity = (item: University) => { setSelectedUniversity(item); setFaculty(""); setSelectedDepartment(null); setLevel(null); setSelectedCourses([]); setStep("faculty"); setQuery(""); };
  const selectFaculty = (value: string) => { setFaculty(value); setSelectedDepartment(null); setStep("department"); setQuery(""); };
  const selectDepartment = (item: Department) => { setSelectedDepartment(item); setStep("level"); setQuery(""); };
  const toggleCourse = (course: Course) => setSelectedCourses((current) => current.some((item) => item.code === course.code) ? current.filter((item) => item.code !== course.code) : [...current, course]);
  const addManualCourse = () => {
    if (!level) return;
    const code = normalizeCode(manualCode);
    if (code && !selectedCourses.some((item) => item.code === code)) setSelectedCourses((current) => [...current, { id: `manual-${code}`, code, level, semester: 1 }]);
    setManualCode("");
  };
  const requestSchool = async () => {
    const schoolName = query.trim();
    if (!schoolName) return;
    try { await api.post("/universities/requests", { query: schoolName, email: user?.email }); setError("Thanks. We'll review your school request shortly."); }
    catch { setError("We couldn't send your request right now. Try again."); }
  };
  const finish = async () => {
    if (!selectedUniversity || !faculty || !selectedDepartment || !level) return;
    setSubmitting(true); setError(null);
    try {
      const profile = await userService.updateAcademicProfile({ university: selectedUniversity.name, faculty, department: selectedDepartment.name, level, courses: selectedCourses.map((course) => ({ code: course.code, name: course.name, level, semester: course.semester })) });
      updateUser({ ...profile, needs_onboarding: false, showWelcome: false });
      const destination = pendingDestination;
      clearPendingDestination();
      navigation.reset({ index: destination ? 1 : 0, routes: destination ? [{ name: "MainTabs" }, { name: destination.screen, params: destination.params }] : [{ name: "MainTabs" }] });
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "We couldn't finish setting up your Akademi. Your account is safe — try again.");
    } finally { setSubmitting(false); }
  };
  const goBack = () => { if (stepIndex === 0) { navigation.goBack(); return; } setStep(steps[stepIndex - 1]); setQuery(""); };
  const title = step === "university" ? "Choose your university" : step === "faculty" ? "Choose your faculty" : step === "department" ? "Choose your department" : step === "level" ? "What level are you currently in?" : suggestions.length ? "We found courses for your level" : "You’re one of the first students from this class";
  const subtitle = step === "courses" ? suggestions.length ? "Select the courses you’re taking, or add another course code." : "Add course codes if you have them. You can also add courses later." : "This helps us personalize your materials, practice and past questions.";

  return <Screen scrollable title={`${stepIndex + 1} of 5`} onBack={goBack}>
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{step === "university" ? "School" : step === "faculty" ? "Faculty" : step === "department" ? "Department" : step === "level" ? "Level" : "Courses"}</Text>
      <Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
      {(step === "university" || step === "faculty" || step === "department") ? <>
        <Input label={step === "university" ? "Search for your university..." : "Search"} placeholder={step === "university" ? "Search for your university..." : "Type to search"} value={query} onChangeText={setQuery} leftIcon={<Search size={18} color={colors.textMuted} />} />
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : <View style={styles.list}>{visibleItems.map((item: University | string | Department) => { const label = typeof item === "string" ? item : item.name; return <Pressable key={typeof item === "string" ? item : item.id} onPress={() => step === "university" ? selectUniversity(item as University) : step === "faculty" ? selectFaculty(item as string) : selectDepartment(item as Department)} style={styles.row}><View><Text style={styles.rowTitle}>{label}</Text>{typeof item !== "string" && "location" in item && item.location ? <Text style={styles.rowMeta}>{item.location}</Text> : null}</View><ChevronRight size={20} color={colors.textMuted} /></Pressable>; })}</View>}
        {step === "university" && query.trim() && visibleItems.length === 0 ? <TouchableOpacity onPress={requestSchool} style={styles.request}><Text style={styles.requestTitle}>Can’t find your school?</Text><Text style={styles.requestText}>Request {query.trim()}</Text></TouchableOpacity> : null}
      </> : null}
      {step === "level" ? <View style={styles.levelGrid}>{levels.map((item) => <Pressable key={item} style={[styles.levelCard, level === item && styles.levelCardActive]} onPress={() => { setLevel(item); setStep("courses"); }}><Text style={[styles.levelText, level === item && styles.levelTextActive]}>{item} Level</Text></Pressable>)}</View> : null}
      {step === "courses" ? <>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : suggestions.map((course) => { const selected = selectedCourses.some((item) => item.code === course.code); return <Pressable key={course.id} style={[styles.course, selected && styles.courseActive]} onPress={() => toggleCourse(course)}><View><Text style={styles.rowTitle}>{course.code}</Text>{course.name ? <Text style={styles.rowMeta}>{course.name}</Text> : null}</View>{selected ? <CheckCircle2 size={20} color={colors.primary} /> : <Plus size={20} color={colors.textMuted} />}</Pressable>; })}
        <View style={styles.manual}><Input label="Add another course" placeholder="CSC 201" value={manualCode} onChangeText={setManualCode} autoCapitalize="characters" /><Button label="Add course" variant="secondary" onPress={addManualCourse} /></View>
        {selectedCourses.length ? <View style={styles.chips}>{selectedCourses.map((course) => <TouchableOpacity key={course.code} style={styles.chip} onPress={() => setSelectedCourses((current) => current.filter((item) => item.code !== course.code))}><Text style={styles.chipText}>{course.code}</Text><X size={14} color={colors.primary} /></TouchableOpacity>)}</View> : null}
        <Button label="Finish setup" onPress={finish} loading={submitting} disabled={submitting} style={styles.finish} /><Button label="I'll add courses later" variant="secondary" onPress={finish} disabled={submitting} style={styles.skip} />
      </> : null}
    </View>
  </Screen>;
};

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 36 }, eyebrow: { ...typography.label, color: colors.primary, fontWeight: "700" }, title: { ...typography.h2, color: colors.textPrimary, marginTop: 6 }, subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 21, marginTop: 8 }, error: { backgroundColor: "rgba(239,68,68,0.12)", borderColor: colors.error, borderRadius: 12, borderWidth: 1, marginTop: 16, padding: 12 }, errorText: { ...typography.bodySmall, color: colors.error }, loader: { marginTop: 30 }, list: { gap: 10, marginTop: 18 }, row: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 15 }, rowTitle: { ...typography.body, color: colors.textPrimary, fontWeight: "700" }, rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 3 }, request: { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "#1D3528", borderRadius: 14, borderWidth: 1, marginTop: 16, padding: 15 }, requestTitle: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: "700" }, requestText: { ...typography.bodySmall, color: colors.primary, marginTop: 4 }, levelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 }, levelCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, paddingVertical: 20, width: "47%" }, levelCardActive: { borderColor: colors.primary, backgroundColor: "rgba(34,197,94,0.12)" }, levelText: { ...typography.body, color: colors.textPrimary, fontWeight: "700" }, levelTextActive: { color: colors.primary }, course: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 12, padding: 15 }, courseActive: { borderColor: colors.primary, backgroundColor: "rgba(34,197,94,0.08)" }, manual: { marginTop: 18 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }, chip: { alignItems: "center", backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 7 }, chipText: { ...typography.caption, color: colors.primary, fontWeight: "700" }, finish: { marginTop: 26 }, skip: { marginTop: 10 },
});
