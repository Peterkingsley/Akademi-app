import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import { X, Clock, FileText, ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { useNavigation } from "@react-navigation/native";
import examPrepService from "../../services/examPrep";
import { SafeArea } from "../../components/layout/SafeArea";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";

const { width } = Dimensions.get("window");

const COURSES = [
  "Introduction to AI",
  "Advanced Calculus",
  "CHM 101",
  "PHY 102",
  "GST 111",
];

export const AddExamScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  const snapPoints = useMemo(() => ["90%"], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  );

  const handleAddExam = async () => {
    if (!selectedCourse) return;

    setLoading(true);
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      await examPrepService.createPlan(selectedCourse, dateString);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to add exam:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderCalendar = () => {
    // Basic calendar implementation for the sake of the exercise
    const today = new Date();
    const currentMonth = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity><ChevronLeft size={20} color={colors.textPrimary} /></TouchableOpacity>
          <Text style={[styles.monthText, typography.body]}>{currentMonth}</Text>
          <TouchableOpacity><ChevronRight size={20} color={colors.textPrimary} /></TouchableOpacity>
        </View>
        <View style={styles.daysGrid}>
           {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
             <Text key={idx} style={[styles.dayHeader, typography.caption]}>{day}</Text>
           ))}
           {/* Render a simple grid of days (mock for May 2024 context) */}
           {Array.from({ length: 31 }).map((_, i) => {
             const day = i + 1;
             const isSelected = selectedDate.getDate() === day;
             const isToday = today.getDate() === day;

             return (
               <TouchableOpacity
                 key={day}
                 style={[
                   styles.dayCell,
                   isSelected && styles.selectedDay
                 ]}
                 onPress={() => {
                   const newDate = new Date(selectedDate);
                   newDate.setDate(day);
                   setSelectedDate(newDate);
                 }}
               >
                 <Text style={[
                   styles.dayText,
                   typography.bodySmall,
                   isSelected && styles.selectedDayText,
                   !isSelected && styles.dimDayText
                 ]}>
                   {day}
                 </Text>
                 {isToday && !isSelected && <View style={styles.todayIndicator} />}
               </TouchableOpacity>
             );
           })}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Clock size={16} color={colors.textSecondary} style={styles.metaIcon} />
            <Text style={[styles.metaText, typography.bodySmall]}>120 Mins</Text>
          </View>
          <View style={[styles.metaPill, styles.formatPill]}>
            <FileText size={16} color={colors.warning} style={styles.metaIcon} />
            <Text style={[styles.formatText, typography.bodySmall]}>MCQ + Essay</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeArea style={styles.safeArea}>
      <View style={styles.backgroundContent}>
         <Text style={[styles.bgTitle, typography.h2]}>Your Academic Timeline</Text>
         {/* Background content as per frame 65 description */}
      </View>

      <BottomSheet
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, typography.h3]}>Add an Exam</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, typography.mono]}>SELECT COURSE</Text>
                <View style={styles.requiredBadge}>
                  <Text style={[styles.requiredText, typography.caption]}>Required</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseRow}>
                {COURSES.map((course) => {
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
            </View>

            <View style={styles.section}>
               <Text style={[styles.label, typography.mono]}>EXAMINATION DATE</Text>
               {renderCalendar()}
            </View>

          </ScrollView>

          <View style={styles.footer}>
            <Button
              label="Add Exam"
              icon={<Plus size={20} color="white" />}
              onPress={handleAddExam}
              loading={loading}
              disabled={!selectedCourse}
            />
          </View>
        </View>
      </BottomSheet>
    </SafeArea>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundContent: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    paddingTop: 40,
  },
  bgTitle: {
    color: colors.textPrimary,
  },
  bottomSheetBg: {
    backgroundColor: colors.surface,
  },
  handle: {
    backgroundColor: colors.border,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  section: {
    marginBottom: 32,
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
  dayText: {
    fontWeight: "600",
  },
  selectedDayText: {
    color: "#FFFFFF",
  },
  dimDayText: {
    color: colors.textSecondary,
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
  footer: {
    marginTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
});
