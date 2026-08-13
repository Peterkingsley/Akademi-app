import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BookOpen, CalendarDays, GraduationCap, PenLine, RefreshCw, Search } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredCourses = useMemo(() => {
    const allCourses = profile?.student_courses || [];
    if (!searchQuery.trim()) return allCourses;
    const q = searchQuery.trim().toLowerCase();
    return allCourses.filter(
      (c) => c.code.toLowerCase().includes(q) || (c.name && c.name.toLowerCase().includes(q)),
    );
  }, [profile, searchQuery]);

  const groupedCourses = useMemo(() => groupCourses(filteredCourses), [filteredCourses]);

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
          <LinearGradient
            colors={["#0B1E12", "#04110A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryIcon}>
              <GraduationCap size={22} color={colors.primary} />
            </View>
            <Text style={styles.summaryTitle}>{profile?.department || "Your Department"}</Text>
            <Text style={styles.summaryText}>
              {profile?.university || "University"} • {profile?.faculty || "Faculty"} • Level {profile?.level || "-"}
            </Text>
            <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate("EditAcademicDetails")} activeOpacity={0.8}>
              <PenLine size={14} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Edit Courses</Text>
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.searchBar}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search course code or title..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
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
                      <View style={styles.courseCodeBadge}>
                        <Text style={styles.courseCodeText}>{course.code}</Text>
                      </View>
                      <View style={styles.courseInfo}>
                        <Text style={styles.courseName}>{course.name || "Course module"}</Text>
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
              <Text style={styles.emptyTitle}>No courses found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? `No courses matching "${searchQuery}"` : "Add your semester course codes so uploads, CBT, exam prep, and progress stay organized."}
              </Text>
              <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate("EditAcademicDetails")} activeOpacity={0.8}>
                <PenLine size={14} color="#FFFFFF" />
                <Text style={styles.editButtonText}>Add Courses</Text>
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
    borderColor: "rgba(34,197,94,0.25)",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  summaryIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    marginBottom: 10,
    width: 44,
  },
  summaryTitle: { ...typography.h3, color: colors.textPrimary, textAlign: "center", fontSize: 18, fontWeight: "800" },
  summaryText: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4, textAlign: "center" },
  editButton: {
    alignItems: "center",
    backgroundColor: "#04110A",
    borderColor: "rgba(34,197,94,0.3)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editButtonText: { ...typography.bodySmall, color: "#FFFFFF", fontWeight: "800", marginLeft: 7, fontSize: 12 },
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    height: 48,
    marginBottom: 18,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    marginLeft: 10,
  },
  semesterSection: { marginBottom: 18 },
  sectionLabel: { ...typography.label, color: colors.textMuted, letterSpacing: 0, marginBottom: 10 },
  courseGroup: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  courseItem: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", padding: 14 },
  courseCodeBadge: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderColor: "rgba(34,197,94,0.3)",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
  },
  courseCodeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  courseInfo: { flex: 1 },
  courseName: { ...typography.body, color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  dateRow: { alignItems: "center", flexDirection: "row", marginTop: 4 },
  dateText: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginLeft: 5 },
  errorCard: { alignItems: "center", backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.28)", borderRadius: 10, borderWidth: 1, flexDirection: "row", marginBottom: 14, padding: 13 },
  errorText: { ...typography.bodySmall, color: colors.warning, flex: 1, fontSize: 11, lineHeight: 16, marginLeft: 8 },
  emptyState: { alignItems: "center", padding: 36 },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginTop: 16 },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8, textAlign: "center" },
});
