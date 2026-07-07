import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import {
  History,
  PlusCircle,
  Flame,
  ChevronLeft,
  Settings,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Screen } from "../../components/layout/Screen";
import { SafeArea } from "../../components/layout/SafeArea";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Skeleton } from "../../components/ui/Skeleton";
import { AIInsightBanner } from "../../components/ui/AIInsightBanner";
import { Badge } from "../../components/ui/Badge";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import examPrepService, { CourseHubItem } from "../../services/examPrep";

export const ExamPrepScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingCourse, setStartingCourse] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseHubItem[]>([]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const data = await examPrepService.getCourseHub();
      setCourses(data);
    } catch (error) {
      console.error("Error fetching exam prep courses:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCourses();
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <ChevronLeft size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, typography.h3]}>Exam Prep</Text>
      <View style={styles.backBtn} />
    </View>
  );

  const renderUrgentBanner = () => {
    const urgentCourse = courses.find((c) => c.days_left !== null && c.days_left !== undefined && c.days_left <= 5);
    if (!urgentCourse) return null;

    return (
      <View style={styles.urgentBanner}>
        <View style={styles.urgentContent}>
          <Flame size={20} color={colors.warning} style={styles.urgentIcon} />
          <Text style={[styles.urgentText, typography.bodySmall]}>
            {urgentCourse.course_code} {urgentCourse.assessment_label || "Exam"} in {urgentCourse.days_left} days!
          </Text>
        </View>
      </View>
    );
  };

  const goToLibrary = (courseCode: string) => {
    navigation.navigate("MainTabs", { screen: "Library", params: { course_code: courseCode } });
  };

  const startMockExam = async (course: CourseHubItem) => {
    try {
      setStartingCourse(course.course_code);
      const mockExam: any = await examPrepService.startMockExamForCourse(course.course_code);
      navigation.navigate("MockExam", { examId: mockExam.plan_id, mockExamId: mockExam.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || "We could not start this mock exam yet.";
      Alert.alert("Mock exam unavailable", message);
    } finally {
      setStartingCourse(null);
    }
  };

  const renderCourseCard = (course: CourseHubItem) => {
    const mockActive = course.mastery_level >= 60;
    const hasExamDate = Boolean(course.exam_date);

    return (
      <Animated.View key={course.course_code} entering={FadeInUp.delay(100)}>
        <Card style={styles.examCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderText}>
              <Text style={[styles.courseCode, typography.h3]}>
                {course.course_code}
              </Text>
              <Text style={[styles.examDate, typography.caption]}>
                {hasExamDate
                  ? `${(course.assessment_label || "Exam").toUpperCase()} ON ${new Date(course.exam_date as string).toLocaleDateString()}`
                  : "NO EXAM DATE SET"}
              </Text>
            </View>
            <View style={styles.cardHeaderActions}>
              {hasExamDate && course.days_left !== null && course.days_left !== undefined && (
                <Badge label={`${course.days_left}D LEFT`} variant="warning" style={styles.dayBadge} />
              )}
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => navigation.navigate("AddExam", { courseCode: course.course_code })}
              >
                <Settings size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressLabel, typography.caption]}>
                Mastery Level
              </Text>
              <Text style={[styles.progressValue, typography.bodySmall]}>
                {course.mastery_level}%
              </Text>
            </View>
            <ProgressBar progress={course.mastery_level} color={colors.primary} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, typography.body]}>
                {course.readiness_grade}
              </Text>
              <Text style={[styles.statLabel, typography.caption]}>GRADE</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Button
              label="Study Now"
              style={styles.actionBtn}
              onPress={() => goToLibrary(course.course_code)}
            />
            <Button
              label="Mock Exam"
              variant="outline"
              style={styles.actionBtn}
              disabled={!mockActive}
              loading={startingCourse === course.course_code}
              onPress={() => startMockExam(course)}
            />
          </View>
          {!mockActive && (
            <Text style={[styles.lockText, typography.caption]}>
              *Reach 60% Mastery to unlock Mock Exam
            </Text>
          )}
        </Card>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <History size={48} color={colors.textMuted} style={styles.emptyIcon} />
      <Text style={[styles.emptyTitle, typography.h3]}>No Courses Found</Text>
      <Text style={[styles.emptySubtitle, typography.body]}>
        Complete your academic profile or upload a material for your course so Akademi can build your CBT practice hub.
      </Text>
      <Button
        label="Set Up a Course"
        icon={<PlusCircle size={20} color="white" />}
        onPress={() => navigation.navigate("AddExam")}
        style={styles.addBtnLarge}
      />
    </View>
  );

  return (
    <SafeArea style={styles.container}>
      <Screen hideHeader>
        {renderHeader()}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {loading ? (
            <View style={styles.skeletonContainer}>
              <Skeleton height={200} width="100%" borderRadius={16} style={{ marginBottom: 16 }} />
              <Skeleton height={200} width="100%" borderRadius={16} />
            </View>
          ) : courses.length > 0 ? (
            <>
              {renderUrgentBanner()}
              <View style={styles.insight}>
                <AIInsightBanner text="Exam Prep works by course. Akademi uses all available materials and questions for the selected course." />
              </View>
              <Text style={[styles.sectionTitle, typography.mono]}>
                YOUR COURSES
              </Text>
              {courses.map(renderCourseCard)}
            </>
          ) : (
            renderEmptyState()
          )}
        </ScrollView>
      </Screen>
    </SafeArea>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    padding: 4,
    width: 32,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  urgentBanner: {
    backgroundColor: "#2D1D16",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.warning + "40",
  },
  urgentContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  urgentIcon: {
    marginRight: 8,
  },
  urgentText: {
    color: colors.warning,
    fontWeight: "700",
  },
  insight: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 16,
    letterSpacing: 1,
  },
  examCard: {
    padding: 20,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  cardHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  cardHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayBadge: {
    marginRight: 0,
  },
  settingsBtn: {
    padding: 4,
  },
  courseCode: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  examDate: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    color: colors.textSecondary,
  },
  progressValue: {
    color: colors.primary,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textMuted,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 44,
  },
  lockText: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 12,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyIcon: {
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 22,
    marginBottom: 32,
  },
  addBtnLarge: {
    paddingHorizontal: 32,
  },
  skeletonContainer: {
    gap: 16,
  },
});
