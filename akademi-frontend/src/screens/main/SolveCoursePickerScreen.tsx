import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowLeft, BookOpen, Check, Layers, Search, X } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { CourseItemOption } from "../../components/ui/CoursePickerModal";
import { userService } from "../../services/user";
import { useAuthStore } from "../../store/useAuthStore";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";

export const SolveCoursePickerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((state) => state.user);
  const selectedCourseCode = route.params?.selectedCourseCode || null;

  const [courses, setCourses] = useState<CourseItemOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      userService.getCourseOptions().catch(() => []),
      userService.getAcademicProfile().catch(() => null),
    ]).then(([courseOptions, academicProfile]) => {
      if (!active) return;
      const merged = new Map<string, CourseItemOption>();
      const addCourse = (code: unknown, name?: unknown) => {
        if (typeof code !== "string" || !code.trim()) return;
        const normalized = code.trim().toUpperCase();
        const existing = merged.get(normalized);
        merged.set(normalized, {
          code: normalized,
          name: typeof name === "string" && name.trim() ? name.trim() : existing?.name,
        });
      };

      courseOptions.forEach(({ code, name }) => addCourse(code, name));
      academicProfile?.student_courses?.forEach(({ code, name }) => addCourse(code, name));
      academicProfile?.courses?.forEach((code) => addCourse(code));
      user?.courses?.forEach((code) => addCourse(code));

      setCourses(Array.from(merged.values()).sort((a, b) => a.code.localeCompare(b.code)));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user?.courses]);

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return courses;
    return courses.filter((course) =>
      course.code.toLowerCase().includes(normalizedQuery) ||
      Boolean(course.name?.toLowerCase().includes(normalizedQuery))
    );
  }, [courses, query]);

  const chooseCourse = (courseCode: string | null) => {
    navigation.navigate("MainTabs", {
      screen: "Solve",
      params: { selectedCourseCode: courseCode },
    });
  };

  return (
    <Screen hideHeader style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to Solve"
        >
          <ArrowLeft size={21} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ASSIGNMENT CONTEXT</Text>
          <Text style={styles.title}>Choose your course</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Akademi will use your department and relevant verified materials from the selected course.
      </Text>

      <View style={styles.searchBox}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search code or course title"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          accessibilityLabel="Search courses"
        />
        {query ? (
          <TouchableOpacity
            onPress={() => setQuery("")}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear course search"
          >
            <X size={17} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.courseCard, !selectedCourseCode && styles.selectedCard]}
        onPress={() => chooseCourse(null)}
        accessibilityRole="button"
        accessibilityLabel="General course context"
        accessibilityHint="Answer without using materials from a specific course"
        accessibilityState={{ selected: !selectedCourseCode }}
      >
        <View style={[styles.iconBox, !selectedCourseCode && styles.selectedIconBox]}>
          <Layers size={20} color={!selectedCourseCode ? colors.primary : colors.textSecondary} />
        </View>
        <View style={styles.courseCopy}>
          <Text style={styles.courseCode}>General</Text>
          <Text style={styles.courseName}>Answer without a specific course-material context</Text>
        </View>
        {!selectedCourseCode ? <Check size={20} color={colors.primary} /> : null}
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading your courses…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCourses}
          keyExtractor={(item) => item.code}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const selected = item.code === selectedCourseCode;
            return (
              <TouchableOpacity
                style={[styles.courseCard, selected && styles.selectedCard]}
                onPress={() => chooseCourse(item.code)}
                accessibilityRole="button"
                accessibilityLabel={`${item.code}, ${item.name || "your enrolled course"}`}
                accessibilityHint="Use this course as assignment context"
                accessibilityState={{ selected }}
              >
                <View style={[styles.iconBox, selected && styles.selectedIconBox]}>
                  <BookOpen size={20} color={selected ? colors.primary : colors.textSecondary} />
                </View>
                <View style={styles.courseCopy}>
                  <Text style={[styles.courseCode, selected && styles.selectedText]}>{item.code}</Text>
                  <Text style={styles.courseName} numberOfLines={2}>{item.name || "Your enrolled course"}</Text>
                </View>
                {selected ? <Check size={20} color={colors.primary} /> : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <BookOpen size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{query ? "No matching course" : "No courses found"}</Text>
              <Text style={styles.stateText}>
                {query ? "Try another course code or title." : "Add courses from your academic profile, then return here."}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  screen: { alignSelf: "center", backgroundColor: colors.background, flex: 1, maxWidth: 720, paddingHorizontal: 18, paddingTop: 12, width: "100%" },
  header: { alignItems: "center", flexDirection: "row", gap: 14 },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 13, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  headerCopy: { flex: 1 },
  eyebrow: { ...typography.label, color: colors.primary, fontSize: 10, letterSpacing: 1.2 },
  title: { ...typography.h2, color: colors.textPrimary, fontSize: 24, marginTop: 2 },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 20, marginTop: 14 },
  searchBox: { alignItems: "center", backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 10, height: 50, paddingHorizontal: 14, marginBottom: 14 },
  searchInput: { ...typography.body, color: colors.textPrimary, flex: 1, fontSize: 15 },
  clearButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  courseCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 17, borderWidth: 1, flexDirection: "row", marginBottom: 10, minHeight: 76, padding: 13 },
  selectedCard: { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.55)" },
  iconBox: { alignItems: "center", backgroundColor: colors.surfaceElevated, borderRadius: 12, height: 44, justifyContent: "center", marginRight: 12, width: 44 },
  selectedIconBox: { backgroundColor: "rgba(34,197,94,0.13)" },
  courseCopy: { flex: 1, paddingRight: 8 },
  courseCode: { ...typography.h3, color: colors.textPrimary, fontSize: 16 },
  selectedText: { color: colors.primary },
  courseName: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  listContent: { paddingBottom: 28 },
  centerState: { alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 42 },
  stateText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, fontSize: 16, marginTop: 4 },
});
