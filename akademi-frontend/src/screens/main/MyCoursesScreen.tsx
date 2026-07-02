import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BookOpen, CalendarDays, GraduationCap, PenLine, RefreshCw } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { AcademicProfile, StudentAcademicCourse, userService } from "../../services/user";

const formatDate = (value?: string) => {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const groupCourses = (courses: StudentAcademicCourse[]) => {
  const groups = new Map<string, StudentAcademicCourse[]>();
  for (const course of courses) {
    const key = `${course.level}L - Semester ${course.semester}`;
    groups.set(key, [...(groups.get(key) || []), course]);
  }
  return Array.from(groups.entries()).map(([title, items]) => ({ title, items }));
};

export const MyCoursesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = async () => {
    try {
      setError(null);
      const data = await userService.getAcademicProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load your course structure.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const groupedCourses = useMemo(() => groupCourses(profile?.student_courses || []), [profile]);

  return (
    <Screen style={{ flex: 1 }} title="My Courses" onBack={() => navigation.goBack()}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCourses(); }} tintColor={colors.primary} />}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <GraduationCap size={24} color={colors.primary} />
            </View>
            <Text style={styles.summaryTitle}>{profile?.department || "Your department"}</Text>
            <Text style={styles.summaryText}>
              {profile?.university || "University"} / {profile?.faculty || "Faculty"} / Level {profile?.level || "-"}
            </Text>
            <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate("EditAcademicDetails")}>
              <PenLine size={15} color={colors.background} />
              <Text style={styles.editButtonText}>Edit courses</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <TouchableOpacity style={styles.errorCard} onPress={fetchCourses}>
              <RefreshCw size={18} color={colors.warning} />
              <Text style={styles.errorText}>{error} Tap to retry.</Text>
            </TouchableOpacity>
          ) : groupedCourses.length > 0 ? (
            groupedCourses.map((group) => (
              <View key={group.title} style={styles.semesterSection}>
                <Text style={styles.sectionLabel}>{group.title}</Text>
                <View style={styles.courseGroup}>
                  {group.items.map((course) => (
                    <View key={`${course.code}-${course.level}-${course.semester}`} style={styles.courseItem}>
                      <View style={styles.courseIcon}>
                        <BookOpen size={18} color={colors.primary} />
                      </View>
                      <View style={styles.courseInfo}>
                        <Text style={styles.courseCode}>{course.code}</Text>
                        <Text style={styles.courseName}>{course.name || "Course code"}</Text>
                        <View style={styles.dateRow}>
                          <CalendarDays size={12} color={colors.textMuted} />
                          <Text style={styles.dateText}>
                            {formatDate(course.semester_start)} - {formatDate(course.semester_end)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <GraduationCap size={42} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No courses saved</Text>
              <Text style={styles.emptySubtitle}>Add your semester course codes so uploads, CBT, exam prep, and progress stay organized.</Text>
              <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate("EditAcademicDetails")}>
                <PenLine size={15} color={colors.background} />
                <Text style={styles.editButtonText}>Add courses</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 18, paddingBottom: 40 },
  summaryCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 18,
    padding: 18,
  },
  summaryIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 10,
    height: 48,
    justifyContent: "center",
    marginBottom: 12,
    width: 48,
  },
  summaryTitle: { ...typography.h3, color: colors.textPrimary, textAlign: "center" },
  summaryText: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 6, textAlign: "center" },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 10,
    flexDirection: "row",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editButtonText: { ...typography.bodySmall, color: colors.background, fontWeight: "800", marginLeft: 7 },
  semesterSection: { marginBottom: 18 },
  sectionLabel: { ...typography.label, color: colors.textMuted, letterSpacing: 0, marginBottom: 10 },
  courseGroup: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  courseItem: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", padding: 14 },
  courseIcon: { alignItems: "center", backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 8, height: 40, justifyContent: "center", marginRight: 12, width: 40 },
  courseInfo: { flex: 1 },
  courseCode: { ...typography.h3, color: colors.textPrimary, fontSize: 15 },
  courseName: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  dateRow: { alignItems: "center", flexDirection: "row", marginTop: 7 },
  dateText: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginLeft: 5 },
  errorCard: { alignItems: "center", backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.28)", borderRadius: 10, borderWidth: 1, flexDirection: "row", marginBottom: 14, padding: 13 },
  errorText: { ...typography.bodySmall, color: colors.warning, flex: 1, fontSize: 11, lineHeight: 16, marginLeft: 8 },
  emptyState: { alignItems: "center", padding: 36 },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginTop: 16 },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8, textAlign: "center" },
});
