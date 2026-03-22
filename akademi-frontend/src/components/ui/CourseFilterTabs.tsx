import React from "react";
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

interface CourseFilterTabsProps {
  courses: string[];
  selectedCourse: string;
  onSelectCourse: (course: string) => void;
}

export const CourseFilterTabs: React.FC<CourseFilterTabsProps> = ({
  courses,
  selectedCourse,
  onSelectCourse,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {["All", ...courses].map((course) => {
          const isSelected = selectedCourse === course;
          return (
            <TouchableOpacity
              key={course}
              onPress={() => onSelectCourse(course)}
              style={[
                styles.tab,
                isSelected ? styles.selectedTab : styles.unselectedTab,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  typography.caption,
                  { color: isSelected ? "#FFFFFF" : colors.textSecondary },
                  isSelected && { fontWeight: "700" },
                ]}
              >
                {course}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 60,
  },
  selectedTab: {
    backgroundColor: colors.primary,
  },
  unselectedTab: {
    backgroundColor: colors.surfaceElevated,
  },
  tabText: {
    fontSize: 13,
  },
});
