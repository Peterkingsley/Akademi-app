import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { X, Clock, FileText, ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { useNavigation } from "@react-navigation/native";
import examPrepService from "../../services/examPrep";
import { SafeArea } from "../../components/layout/SafeArea";
import { useAuthStore } from "../../store/useAuthStore";

const { width } = Dimensions.get("window");
type AssessmentType = "TEST" | "EXAM";

export const AddExamScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const courses = (user as any)?.courses || [];
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(12, 0, 0, 0);
    return date;
  }, []);
  const [selectedCourse, setSelectedCourse] = useState(courses[0] || "");
  const [assessmentType, setAssessmentType] = useState<AssessmentType>("EXAM");
  const [selectedDate, setSelectedDate] = useState<Date>(tomorrow);
  const [loading, setLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1));
  const [errorMessage, setErrorMessage] = useState("");

  const handleAddExam = async () => {
    if (!selectedCourse) {
      setErrorMessage("Select a course before creating the exam plan.");
      return;
    }

    if (selectedDate < tomorrow) {
      setErrorMessage("Choose a future exam date.");
      return;
    }

    setErrorMessage("");
    setLoading(true);
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      const plan = await examPrepService.createPlan(selectedCourse, dateString, assessmentType);
      navigation.replace("PrepPlan", { examId: plan.id });
    } catch (error: any) {
      console.error("Failed to add exam:", error);
      const message = error?.response?.data?.message || "We could not create this exam plan. Please try again.";
      setErrorMessage(message);
      Alert.alert("Exam plan not created", message);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (offset: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const renderCalendar = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const firstDayOffset = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
    const cells = [
      ...Array.from({ length: firstDayOffset }, (_, index) => ({ key: `empty-${index}`, day: null })),
      ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
    ];

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => changeMonth(-1)}><ChevronLeft size={20} color={colors.textPrimary} /></TouchableOpacity>
          <Text style={[styles.monthText, typography.body]}>{currentMonth}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}><ChevronRight size={20} color={colors.textPrimary} /></TouchableOpacity>
        </View>
        <View style={styles.daysGrid}>
           {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
             <Text key={idx} style={[styles.dayHeader, typography.caption]}>{day}</Text>
           ))}
           {cells.map((cell) => {
             if (!cell.day) return <View key={cell.key} style={styles.dayCell} />;

             const cellDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), cell.day, 12);
             const isSelected = selectedDate.toDateString() === cellDate.toDateString();
             const isToday = today.toDateString() === cellDate.toDateString();
             const isPast = cellDate < tomorrow;

             return (
               <TouchableOpacity
                 key={cell.key}
                 style={[
                   styles.dayCell,
                   isSelected && styles.selectedDay,
                   isPast && styles.disabledDay,
                 ]}
                 disabled={isPast}
                 onPress={() => {
                   setSelectedDate(cellDate);
                   setErrorMessage("");
                 }}
               >
                 <Text style={[
                   styles.dayText,
                   typography.bodySmall,
                   isSelected && styles.selectedDayText,
                   !isSelected && styles.dimDayText,
                   isPast && styles.disabledDayText,
                 ]}>
                   {cell.day}
                 </Text>
                 {isToday && !isSelected && <View style={styles.todayIndicator} />}
               </TouchableOpacity>
             );
           })}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Clock size={16} color={colors.textSecondary} style={styles.metaIcon} />
            <Text style={[styles.metaText, typography.bodySmall]}>{assessmentType === "EXAM" ? "120 Mins" : "45 Mins"}</Text>
          </View>
          <View style={[styles.metaPill, styles.formatPill]}>
            <FileText size={16} color={colors.warning} style={styles.metaIcon} />
            <Text style={[styles.formatText, typography.bodySmall]}>Course-wide prep</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeArea style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <X size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, typography.h3]}>Plan Course Prep</Text>
        <View style={styles.closeButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.introCard}>
          <Text style={[styles.introTitle, typography.h3]}>Prepare from the whole course</Text>
          <Text style={[styles.introText, typography.bodySmall]}>
            Choose a course and Akademi will use all available materials for that course to prepare practice, weak-area review, and mock questions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, typography.mono]}>PREP TYPE</Text>
          <View style={styles.typeRow}>
            {(["TEST", "EXAM"] as AssessmentType[]).map((type) => {
              const selected = assessmentType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeCard, selected && styles.typeCardSelected]}
                  activeOpacity={0.82}
                  onPress={() => setAssessmentType(type)}
                >
                  <Text style={[styles.typeTitle, typography.bodySmall, selected && styles.typeTitleSelected]}>
                    {type === "TEST" ? "Test" : "Exam"}
                  </Text>
                  <Text style={[styles.typeDescription, typography.caption, selected && styles.typeDescriptionSelected]}>
                    {type === "TEST" ? "Shorter course revision" : "Full course preparation"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, typography.mono]}>SELECT COURSE</Text>
            <View style={styles.requiredBadge}>
              <Text style={[styles.requiredText, typography.caption]}>Required</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseRow}>
            {courses.map((course: string) => {
              const isSelected = selectedCourse === course;
              return (
                <TouchableOpacity
                  key={course}
                  style={[
                    styles.coursePill,
                    isSelected && styles.coursePillSelected
                  ]}
                  onPress={() => setSelectedCourse(course)}
                >
                  <Text style={[
                    styles.courseText,
                    typography.bodySmall,
                    isSelected && styles.courseTextSelected
                  ]}>
                    {course}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {courses.length === 0 && (
            <Text style={[styles.emptyCoursesText, typography.bodySmall]}>
              No courses found. Complete your academic setup before creating an exam plan.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, typography.mono]}>{assessmentType === "TEST" ? "TEST DATE" : "EXAMINATION DATE"}</Text>
          {renderCalendar()}
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={[styles.errorText, typography.bodySmall]}>{errorMessage}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={`Create ${assessmentType === "TEST" ? "Test" : "Exam"} Prep`}
          icon={<Plus size={20} color="white" />}
          onPress={handleAddExam}
          loading={loading}
          disabled={!selectedCourse || courses.length === 0}
        />
      </View>
    </SafeArea>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  introCard: {
    backgroundColor: colors.surface,
    borderColor: "rgba(34,197,94,0.24)",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    padding: 16,
  },
  introTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 8,
  },
  introText: {
    color: colors.textSecondary,
    lineHeight: 19,
  },
  section: {
    marginBottom: 32,
  },
  typeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  typeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 88,
    padding: 14,
  },
  typeCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeTitle: {
    color: colors.textPrimary,
    fontWeight: "800",
    marginBottom: 7,
  },
  typeTitleSelected: {
    color: colors.background,
  },
  typeDescription: {
    color: colors.textSecondary,
    lineHeight: 15,
  },
  typeDescriptionSelected: {
    color: colors.background,
    opacity: 0.76,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  requiredBadge: {
    backgroundColor: colors.error + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    color: colors.error,
    fontWeight: "600",
  },
  courseRow: {
    flexDirection: "row",
  },
  coursePill: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coursePillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  courseText: {
    color: colors.textSecondary,
  },
  courseTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyCoursesText: {
    color: colors.warning,
    lineHeight: 20,
    marginTop: 12,
  },
  calendarContainer: {
    marginTop: 16,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  monthText: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  dayHeader: {
    width: (width - 48 - 48) / 7,
    textAlign: "center",
    color: colors.textMuted,
    marginBottom: 16,
  },
  dayCell: {
    width: (width - 48 - 48) / 7,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  selectedDay: {
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  disabledDay: {
    opacity: 0.35,
  },
  dayText: {
    fontWeight: "600",
  },
  selectedDayText: {
    color: "#FFFFFF",
  },
  dimDayText: {
    color: colors.textSecondary,
  },
  disabledDayText: {
    color: colors.textMuted,
  },
  todayIndicator: {
    position: "absolute",
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formatPill: {
    borderColor: colors.warning + '40',
  },
  metaIcon: {
    marginRight: 8,
  },
  metaText: {
    color: colors.textSecondary,
  },
  formatText: {
    color: colors.warning,
    fontWeight: "600",
  },
  errorCard: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.textPrimary,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
