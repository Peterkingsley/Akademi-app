import React from "react";
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { Search } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";

interface CourseFilterTabsProps {
  courses: string[];
  selectedCourse: string;
  onSelectCourse: (course: string) => void;
  onSearchPress?: () => void;
}

export const CourseFilterTabs: React.FC<CourseFilterTabsProps> = ({
  courses,
  selectedCourse,
  onSelectCourse,
  onSearchPress,
}) => {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          onPress={onSearchPress}
          style={[styles.searchTab, { backgroundColor: colors.surfaceElevated }]}
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
                { backgroundColor: isSelected ? colors.primary : colors.surfaceElevated },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  typography.caption,
                  {
                    color: isSelected ? "#FFFFFF" : colors.textSecondary,
                    fontWeight: isSelected ? "700" : "400",
                  },
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
    alignItems: "center",
  },
  searchTab: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
});
