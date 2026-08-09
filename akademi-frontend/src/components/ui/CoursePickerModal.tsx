import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  TextInput,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Check, Search, BookOpen, Layers } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useAuthStore } from "../../store/useAuthStore";

export interface CourseItemOption {
  code: string;
  name?: string | null;
}

interface CoursePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (course: string) => void;
  selectedCourse?: string;
  courses?: CourseItemOption[] | string[];
  loading?: boolean;
}

export const CoursePickerModal: React.FC<CoursePickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedCourse = "Select Course",
  courses: customCourses,
  loading = false,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSelected, setTempSelected] = useState<string>(selectedCourse);

  React.useEffect(() => {
    if (visible) {
      setTempSelected(selectedCourse);
      setSearchQuery("");
    }
  }, [visible, selectedCourse]);

  const formattedCourses = useMemo<CourseItemOption[]>(() => {
    if (customCourses && customCourses.length > 0) {
      return customCourses.map((c) => (typeof c === "string" ? { code: c, name: null } : c));
    }

    const userCourses = Array.from(
      new Set<string>(
        ((user as any)?.courses || []).filter(
          (course: unknown): course is string => typeof course === "string" && course.trim().length > 0
        )
      )
    );
    return ["Select Course", ...userCourses].map((code) => ({ code, name: null }));
  }, [customCourses, user]);

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return formattedCourses;
    const query = searchQuery.trim().toLowerCase();
    return formattedCourses.filter(
      (c) =>
        c.code.toLowerCase().includes(query) ||
        (c.name && c.name.toLowerCase().includes(query))
    );
  }, [formattedCourses, searchQuery]);

  const renderItem = ({ item }: { item: CourseItemOption }) => {
    const isSelected = tempSelected === item.code;
    const isDefault = item.code === "Select Course";

    return (
      <TouchableOpacity
        style={[styles.courseItem, isSelected && styles.selectedItem]}
        onPress={() => {
          onSelect(item.code);
          onClose();
        }}
        activeOpacity={0.82}
      >
        <View style={[styles.itemIconCircle, isSelected && styles.selectedIconCircle]}>
          {isDefault ? (
            <Layers size={18} color={isSelected ? colors.primary : colors.textMuted} />
          ) : (
            <BookOpen size={18} color={isSelected ? colors.primary : colors.textMuted} />
          )}
        </View>

        <View style={styles.courseInfo}>
          <Text style={[styles.courseText, isSelected && styles.selectedText]}>
            {isDefault ? "General (No course context)" : item.code}
          </Text>
          {item.name ? (
            <Text style={styles.courseSubtext} numberOfLines={1}>
              {item.name}
            </Text>
          ) : null}
        </View>

        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
          {isSelected && <Check size={14} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View
        style={[
          styles.modalRoot,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {/* Full Modal Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Select Course</Text>
              {loading && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 10 }} />
              )}
            </View>
            <Text style={styles.subtitle}>
              Pick a course context for your assignment or practice
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
          >
            <X size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search course code or title..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
                <X size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Course List */}
        <FlatList
          data={filteredCourses}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.code}-${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No course found for "{searchQuery}".
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: colors.background,
    zIndex: 9999,
    elevation: 9999,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 22,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  closeBtn: {
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  courseItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    marginBottom: 10,
  },
  selectedItem: {
    borderColor: colors.primary,
    backgroundColor: "rgba(34,197,94,0.1)",
  },
  itemIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  selectedIconCircle: {
    backgroundColor: "rgba(34,197,94,0.2)",
  },
  courseInfo: {
    flex: 1,
    marginRight: 10,
  },
  courseText: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  selectedText: {
    color: colors.primary,
    fontWeight: "700",
  },
  courseSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
  },
});
