import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Search, CheckCircle2, PlusCircle } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48 - 12) / 2;

interface Course {
  id: string;
  code: string;
  name: string;
}

const COURSES: Course[] = [
  { id: "1", code: "EEE 301", name: "Network Analysis" },
  { id: "2", code: "MTH 201", name: "Linear Algebra" },
  { id: "3", code: "CSC 312", name: "Operating Systems" },
  { id: "4", code: "EEE 305", name: "Electromagnetics" },
  { id: "5", code: "GST 111", name: "Use of English" },
  { id: "6", code: "PHY 101", name: "General Physics I" },
];

export const CoursePickerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { university, faculty, department, level } = route.params || {};

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleCourse = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredCourses = COURSES.filter(
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
    });
  };

  const renderItem = ({ item }: { item: Course }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
        style={[styles.courseCard, isSelected && styles.selectedCourseCard]}
        onPress={() => toggleCourse(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.courseCode}>{item.code}</Text>
          {isSelected && (
            <CheckCircle2 size={16} color={colors.primary} />
          )}
        </View>
        <Text style={styles.courseName}>{item.name}</Text>
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

        <FlatList
          data={filteredCourses}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
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

        <View style={styles.bottomBar}>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{selectedIds.length} COURSES ADDED</Text>
          </View>
          <Button
            label="Done >"
            onPress={handleDone}
            disabled={selectedIds.length === 0}
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
    fontSize: 12,
    fontFamily: "SpaceMono-Regular",
    marginBottom: 8,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 28,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter-Regular",
    marginTop: 8,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 100,
  },
  courseCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 90,
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
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
  },
  courseName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  addManual: {
    marginTop: 24,
    alignItems: "center",
  },
  addManualText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter-Regular",
    marginBottom: 8,
  },
  addManualLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  addManualLinkText: {
    color: colors.primary,
    fontSize: 14,
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
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
  },
  doneButton: {
    width: 120,
    height: 48,
  },
});
