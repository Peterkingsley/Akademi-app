import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CalendarDays, CheckCircle2, Plus, X } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

interface CourseSuggestion {
  id: string;
  code: string;
  name?: string | null;
  level: number;
  semester: number;
  source?: string;
  usageCount?: number;
}

const SEMESTERS = [
  { label: "1st semester", value: 1 },
  { label: "2nd semester", value: 2 },
];

const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, " ");

export const CoursePickerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { universityId, departmentId, university, faculty, department, level } = route.params || {};
  const levelNumber = parseInt(String(level || "").replace(/[^0-9]/g, ""), 10) || 100;

  const [semester, setSemester] = useState(1);
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<CourseSuggestion[]>([]);
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [departmentId, levelNumber, semester]);

  const selectedCodes = useMemo(
    () => new Set(selectedCourses.map((course) => course.code)),
    [selectedCourses]
  );

  const fetchSuggestions = async () => {
    if (!universityId || !departmentId) return;

    try {
      setLoading(true);
      const response = await api.get(`/universities/${universityId}/departments/${departmentId}/courses`, {
        params: { level: levelNumber, semester },
      });
      setSuggestions(response.data || []);
      setError(null);
    } catch (err) {
      setError("Could not load course suggestions. You can still type your course codes.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSuggestion = (course: CourseSuggestion) => {
    setSelectedCourses((prev) => {
      if (prev.some((item) => item.code === course.code)) {
        return prev.filter((item) => item.code !== course.code);
      }
      return [...prev, { ...course, level: levelNumber, semester }];
    });
  };

  const addManualCourse = () => {
    const code = normalizeCode(manualCode);
    if (!code || selectedCodes.has(code)) {
      setManualCode("");
      return;
    }

    setSelectedCourses((prev) => [
      ...prev,
      {
        id: `manual-${code}`,
        code,
        name: null,
        level: levelNumber,
        semester,
        source: "student",
      },
    ]);
    setManualCode("");
  };

  const removeCourse = (code: string) => {
    setSelectedCourses((prev) => prev.filter((course) => course.code !== code));
  };

  const canContinue = selectedCourses.length > 0 && !!semesterStart.trim() && !!semesterEnd.trim();

  const handleDone = () => {
    if (!canContinue) {
      setError("Add at least one course code and your semester start/end dates.");
      return;
    }

    navigation.navigate("Register", {
      university,
      faculty,
      department,
      level,
      semester,
      semesterStart: semesterStart.trim(),
      semesterEnd: semesterEnd.trim(),
      selectedCourses: selectedCourses.map((course) => course.code),
      academicCourses: selectedCourses.map((course) => ({
        code: course.code,
        name: course.name || undefined,
        level: levelNumber,
        semester,
      })),
    });
  };

  const renderSuggestion = ({ item }: { item: CourseSuggestion }) => {
    const isSelected = selectedCodes.has(item.code);
    return (
      <TouchableOpacity
        style={[styles.suggestionCard, isSelected && styles.selectedSuggestionCard]}
        onPress={() => toggleSuggestion(item)}
        activeOpacity={0.85}
      >
        <View style={styles.suggestionHeader}>
          <Text style={styles.courseCode}>{item.code}</Text>
          {isSelected ? <CheckCircle2 size={17} color={colors.primary} /> : null}
        </View>
        <Text style={styles.courseName} numberOfLines={2}>
          {item.name || "Course name pending"}
        </Text>
        <Text style={styles.sourceText}>
          {item.usageCount ? `${item.usageCount} student${item.usageCount === 1 ? "" : "s"} used this` : item.source || "suggested"}
        </Text>
        <View style={[styles.suggestionAction, isSelected && styles.selectedSuggestionAction]}>
          <Text style={[styles.suggestionActionText, isSelected && styles.selectedSuggestionActionText]}>
            {isSelected ? "Selected" : "Tap to add"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={{ flex: 1 }} onBack={() => navigation.goBack()} title="">
      <View style={styles.container}>
        <FlatList
          data={suggestions}
          renderItem={renderSuggestion}
          keyExtractor={(item) => `${item.code}-${item.level}-${item.semester}`}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <Text style={styles.stepText}>STEP 3 OF 4</Text>
              <Text style={styles.headline}>Add your course codes</Text>
              <Text style={styles.subtext}>
                Course codes are required. Pick suggestions from your department or type your own.
              </Text>

              <View style={styles.contextCard}>
                <Text style={styles.contextLabel}>Current profile</Text>
                <Text style={styles.contextText}>{department} / {level}</Text>
                <Text style={styles.contextMeta}>{university}</Text>
              </View>

              <Text style={styles.sectionLabel}>Semester</Text>
              <View style={styles.semesterRow}>
                {SEMESTERS.map((item) => {
                  const active = semester === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.semesterChip, active && styles.activeSemesterChip]}
                      onPress={() => setSemester(item.value)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.semesterText, active && styles.activeSemesterText]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.dateRow}>
                <Input
                  label="Semester start"
                  placeholder="YYYY-MM-DD"
                  value={semesterStart}
                  onChangeText={setSemesterStart}
                  leftIcon={<CalendarDays size={17} color={colors.textMuted} />}
                  style={styles.dateInput}
                />
                <Input
                  label="Semester end"
                  placeholder="YYYY-MM-DD"
                  value={semesterEnd}
                  onChangeText={setSemesterEnd}
                  leftIcon={<CalendarDays size={17} color={colors.textMuted} />}
                  style={styles.dateInput}
                />
              </View>

              <View style={styles.manualCard}>
                <Input
                  label="Course code"
                  placeholder="e.g. EEE 301"
                  value={manualCode}
                  onChangeText={setManualCode}
                  style={styles.manualInput}
                />
                <TouchableOpacity style={styles.addButton} onPress={addManualCourse} activeOpacity={0.85}>
                  <Plus size={18} color={colors.background} />
                  <Text style={styles.addButtonText}>Add code</Text>
                </TouchableOpacity>
              </View>

              {selectedCourses.length > 0 ? (
                <View style={styles.selectionSummary}>
                  <Text style={styles.selectionSummaryText}>
                    Tap any selected course below to remove it before you continue.
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedRow}>
                    {selectedCourses.map((course) => (
                      <TouchableOpacity key={course.code} style={styles.selectedPill} onPress={() => removeCourse(course.code)}>
                        <Text style={styles.selectedPillText}>{course.code}</Text>
                        <X size={14} color={colors.primary} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.suggestionTitleRow}>
                <Text style={styles.sectionLabel}>Suggestions from your department</Text>
                {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No suggestions yet</Text>
              <Text style={styles.emptyText}>Be one of the first students to add course codes for this level and semester.</Text>
            </View>
          }
        />

        <View style={styles.bottomBar}>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{selectedCourses.length} ADDED</Text>
          </View>
          <Button label="Continue" onPress={handleDone} disabled={loading} style={styles.doneButton} />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 154,
  },
  stepText: {
    ...typography.label,
    color: colors.primary,
    marginBottom: 8,
    marginTop: 20,
  },
  headline: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 22,
  },
  subtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
    marginTop: 8,
  },
  contextCard: {
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  contextLabel: {
    ...typography.label,
    color: colors.primary,
    fontSize: 9,
    marginBottom: 5,
  },
  contextText: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14,
  },
  contextMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 10,
  },
  semesterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  semesterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  activeSemesterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  semesterText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  activeSemesterText: {
    color: colors.background,
  },
  dateRow: {
    marginBottom: 2,
  },
  dateInput: {
    marginBottom: 12,
  },
  manualCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  manualInput: {
    marginBottom: 10,
  },
  addButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: "row",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  addButtonText: {
    ...typography.bodySmall,
    color: colors.background,
    fontWeight: "700",
    marginLeft: 6,
  },
  selectedRow: {
    gap: 8,
    paddingBottom: 14,
  },
  selectionSummary: {
    marginBottom: 12,
  },
  selectionSummaryText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  selectedPill: {
    alignItems: "center",
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedPillText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
    marginRight: 6,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    lineHeight: 18,
    marginBottom: 12,
  },
  suggestionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  columnWrapper: {
    gap: 10,
    marginBottom: 10,
  },
  suggestionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 108,
    padding: 12,
  },
  selectedSuggestionCard: {
    borderColor: colors.primary,
    backgroundColor: "#101412",
  },
  suggestionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  courseCode: {
    ...typography.label,
    color: colors.primary,
    fontSize: 10,
  },
  courseName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
    lineHeight: 18,
  },
  sourceText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 8,
  },
  suggestionAction: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectedSuggestionAction: {
    backgroundColor: "rgba(34, 197, 94, 0.14)",
  },
  suggestionActionText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  selectedSuggestionActionText: {
    color: colors.primary,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: "center",
  },
  bottomBar: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 0,
    padding: 24,
    position: "absolute",
    right: 0,
  },
  countPill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countText: {
    ...typography.label,
    color: colors.textPrimary,
    fontSize: 8,
  },
  doneButton: {
    height: 48,
    width: 130,
  },
});
