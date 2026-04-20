import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Search, CheckCircle2, PlusCircle } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48 - 12) / 2;

interface Course {
  id: string;
  code: string;
  name: string;
}

export const CoursePickerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { university, faculty, department, level } = route.params || {};

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      // Use the Search API to fetch courses for this university/department
      const response = await api.get("/search", {
        params: {
          type: "course",
          university,
          department,
          q: "*",
        },
      });

      const hits = response.data.courses?.hits || [];
      const mappedCourses = hits.map((h: any) => ({
        id: h.document.id,
        code: h.document.course_code,
        name: h.document.name || h.document.course_code,
      }));

      setCourses(mappedCourses);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch courses", err);
      setError("Could not load courses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((i) => i !== code) : [...prev, code]
    );
  };

  const filteredCourses = courses.filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDone = () => {
    navigation.navigate("Register", {
      university,
      faculty,
      department,
      level,
      selectedCourses: selectedCodes,
    });
  };

  const renderItem = ({ item }: { item: Course }) => {
    const isSelected = selectedCodes.includes(item.code);
    return (
      <TouchableOpacity
        style={[styles.courseCard, isSelected && styles.selectedCourseCard]}
        onPress={() => toggleCourse(item.code)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.courseCode}>{item.code}</Text>
          {isSelected && (
            <CheckCircle2 size={16} color={colors.primary} />
          )}
        </View>
        <Text style={styles.courseName} numberOfLines={2}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={{ flex: 1 }}
      onBack={() => navigation.goBack()}
      title=""
      rightAction={
        <View style={styles.progressDots}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      }
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.stepText}>STEP 3.5/5</Text>
          <Text style={styles.headline}>Add your courses</Text>
          <Text style={styles.subtext}>
            Tap the courses you're currently taking this semester
          </Text>
        </View>

        <Input
          label=""
          placeholder="Search course code or name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={20} color={colors.textMuted} />}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Searching courses...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Button label="Retry" onPress={fetchCourses} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <FlatList
            data={filteredCourses}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No courses found for your department yet.</Text>
            }
            ListFooterComponent={
              <TouchableOpacity style={styles.addManual}>
                <Text style={styles.addManualText}>Don't see your course listed?</Text>
                <View style={styles.addManualLink}>
                  <PlusCircle size={16} color={colors.primary} />
                  <Text style={styles.addManualLinkText}>Add course manually</Text>
                </View>
              </TouchableOpacity>
            }
          />
        )}

        <View style={styles.bottomBar}>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{selectedCodes.length} COURSES ADDED</Text>
          </View>
          <Button
            label="Done >"
            onPress={handleDone}
            disabled={selectedCodes.length === 0 || loading}
            style={styles.doneButton}
          />
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
  center: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
  errorText: {
    color: colors.error,
    fontFamily: "Inter-Medium",
    fontSize: 12,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 40,
  },
  progressDots: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1F2937",
    marginLeft: 4,
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 12,
  },
  header: {
    marginTop: 20,
    marginBottom: 24,
  },
  stepText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: "SpaceMono-Regular",
    marginBottom: 8,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 21,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 11.25,
    fontFamily: "Inter-Regular",
    marginTop: 8,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 180, flexGrow: 1,
  },
  courseCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 100,
    justifyContent: "space-between",
  },
  selectedCourseCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  courseCode: {
    color: colors.textSecondary,
    fontSize: 8.25,
    fontFamily: "SpaceMono-Regular",
  },
  courseName: {
    color: colors.textPrimary,
    fontSize: 11.25,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  addManual: {
    marginTop: 24,
    alignItems: "center",
  },
  addManualText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontFamily: "Inter-Regular",
    marginBottom: 8,
  },
  addManualLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  addManualLinkText: {
    color: colors.primary,
    fontSize: 10.5,
    fontFamily: "Inter-Bold",
    marginLeft: 6,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 24,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  countPill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countText: {
    color: colors.textPrimary,
    fontSize: 8.25,
    fontFamily: "SpaceMono-Regular",
  },
  doneButton: {
    width: 120,
    height: 48,
  },
});
