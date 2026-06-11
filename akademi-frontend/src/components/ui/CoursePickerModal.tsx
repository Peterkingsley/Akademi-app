import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Dimensions,
} from "react-native";
import { X, Check } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useAuthStore } from "../../store/useAuthStore";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CoursePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (course: string) => void;
  selectedCourse?: string;
}

export const CoursePickerModal: React.FC<CoursePickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedCourse,
}) => {
  const { user } = useAuthStore();
  const courses = ["Select Course", ...((user as any)?.courses || [])];

  const renderItem = ({ item }: { item: string }) => {
    const isSelected = selectedCourse === item;
    return (
      <TouchableOpacity
        style={[styles.courseItem, isSelected && styles.selectedItem]}
        onPress={() => {
          onSelect(item);
          onClose();
        }}
      >
        <Text style={[styles.courseText, typography.body, isSelected && styles.selectedText]}>
          {item === "Select Course" ? "No course context" : item}
        </Text>
        {isSelected && <Check size={20} color={colors.primary} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, typography.h3]}>Select Course</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={courses}
            renderItem={renderItem}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, typography.bodySmall]}>
                  No courses found. Please check your academic settings.
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.6,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  courseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedItem: {
    borderBottomColor: colors.primary,
  },
  courseText: {
    color: colors.textSecondary,
  },
  selectedText: {
    color: colors.primary,
    fontWeight: "700",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
  },
});
