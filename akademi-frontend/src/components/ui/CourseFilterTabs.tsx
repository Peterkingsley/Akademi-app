import React, { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { Search } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
        {onSearchPress && (
          <TouchableOpacity
            onPress={onSearchPress}
            style={styles.searchTab}
            activeOpacity={0.8}
          >
            <Search size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {["All", ...courses].map((course) => {
          const isSelected = selectedCourse === course;
          return (
            <TouchableOpacity
              key={course}
              onPress={() => onSelectCourse(course)}
              style={[
                styles.tab,
                !isSelected && styles.unselectedTab,
                isSelected && styles.selectedTabBase,
              ]}
              activeOpacity={0.8}
            >
              {isSelected && (
                <LinearGradient
                  colors={[colors.primary, "#166534"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
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

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
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
    overflow: "hidden",
  },
  selectedTabBase: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  unselectedTab: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tabText: {
    fontSize: 9.75,
  },
});
