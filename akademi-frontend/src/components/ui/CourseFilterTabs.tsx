import React from "react";
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { Search } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

interface CourseFilterTabsProps {
  courses: string[];
  selectedCourse: string;
  onSelectCourse: (course: string) => void;
  onSearchPress?: () => void;
  contentPaddingHorizontal?: number;
}

export const CourseFilterTabs: React.FC<CourseFilterTabsProps> = ({
  courses,
  selectedCourse,
  onSelectCourse,
  onSearchPress,
  contentPaddingHorizontal = 20,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: contentPaddingHorizontal },
        ]}
      >
        <TouchableOpacity
          onPress={onSearchPress}
          style={styles.searchTab}
          activeOpacity={0.8}
        >
          <Search size={18} color={colors.textSecondary} />
        </TouchableOpacity>

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
    gap: 8,
    alignItems: "center",
  },
  searchTab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 60,
    height: 40,
  },
  selectedTab: {
    backgroundColor: colors.primary,
  },
  unselectedTab: {
    backgroundColor: colors.surfaceElevated,
  },
  tabText: {
    fontSize: 9.75,
  },
});
