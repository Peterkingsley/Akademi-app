import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import { userService } from "../../services/user";
import { Book, ChevronRight, GraduationCap } from "lucide-react-native";

export const MyCoursesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<string[]>([]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const sessions = await userService.getSessions();
      // Extract unique course codes
      const uniqueCourses = Array.from(new Set(sessions.map(s => s.course_code))).filter(Boolean);
      setCourses(uniqueCourses);
    } catch (error) {
      console.error("Failed to fetch courses", error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity style={styles.courseItem} activeOpacity={0.7}>
      <View style={styles.courseIcon}>
        <Book size={20} color={colors.primary} />
      </View>
      <View style={styles.courseInfo}>
        <Text style={styles.courseCode}>{item}</Text>
        <Text style={styles.courseStatus}>Active Session History</Text>
      </View>
      <ChevronRight size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <Screen style={{ flex: 1 }} title="My Courses" onBack={() => navigation.goBack()}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : courses.length > 0 ? (
          <FlatList
            data={courses}
            renderItem={renderItem}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={styles.listTitle}>Courses you've interacted with</Text>
            }
          />
        ) : (
          <View style={styles.emptyState}>
            <GraduationCap size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No courses found</Text>
            <Text style={styles.emptySubtitle}>
              Start a study session or solve an assignment to see your courses here.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    padding: 20,
  },
  listTitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono-Regular",
    marginBottom: 16,
    textTransform: "uppercase",
  },
  courseItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  courseInfo: {
    flex: 1,
  },
  courseCode: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 15,
  },
  courseStatus: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 20,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
});
