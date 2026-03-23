import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  FileText,
  FileStack,
  Grid,
  Book,
  Star,
  Bookmark,
  CheckCircle2
} from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export interface MaterialCardProps {
  title: string;
  courseCode: string;
  fileType: "PDF" | "STUDY_DOC" | "SYSTEM_FILE" | "ETHICS";
  isVerified?: boolean;
  fileSize?: string;
  date?: string;
  rating?: number;
  isBookmarked?: boolean;
  onPress?: () => void;
  onBookmarkPress?: () => void;
}

export const MaterialCard = React.forwardRef<TouchableOpacity, MaterialCardProps>(({
  title,
  courseCode,
  fileType,
  isVerified,
  fileSize,
  date,
  rating,
  isBookmarked,
  onPress,
  onBookmarkPress,
}, ref) => {
  const getIconConfig = () => {
    switch (fileType) {
      case "PDF":
        return { icon: <FileText size={20} color="#FFFFFF" />, bg: "#FF6B35" };
      case "STUDY_DOC":
        return { icon: <FileStack size={20} color="#FFFFFF" />, bg: colors.primary };
      case "SYSTEM_FILE":
        return { icon: <Grid size={20} color="#FFFFFF" />, bg: colors.accentPurple };
      case "ETHICS":
        return { icon: <Book size={20} color="#FFFFFF" />, bg: colors.success };
      default:
        return { icon: <FileText size={20} color="#FFFFFF" />, bg: colors.textMuted };
    }
  };

  const { icon, bg } = getIconConfig();

  return (
    <TouchableOpacity
      ref={ref}
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.container}
    >
      <View style={[styles.iconContainer, { backgroundColor: bg }]}>
        {icon}
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, typography.bodySmall, { fontWeight: "700" }]} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.coursePill}>
            <Text style={[styles.courseText, typography.caption, { color: colors.primary }]}>
              {courseCode}
            </Text>
          </View>

          {isVerified && (
            <View style={styles.verifiedBadge}>
              <CheckCircle2 size={10} color="#3B82F6" style={{ marginRight: 2 }} />
              <Text style={styles.verifiedText}>VERIFIED</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, typography.caption]}>
            {fileSize && `${fileSize} • `}{date}
          </Text>

          {rating !== undefined && (
            <View style={styles.ratingContainer}>
              <Star size={12} color={colors.warning} fill={colors.warning} />
              <Text style={[styles.ratingText, typography.caption]}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        onPress={onBookmarkPress}
        style={styles.bookmarkBtn}
        activeOpacity={0.6}
      >
        <Bookmark
          size={20}
          color={isBookmarked ? colors.primary : colors.textSecondary}
          fill={isBookmarked ? colors.primary : "transparent"}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: colors.textPrimary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  coursePill: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  courseText: {
    fontWeight: "700",
    fontSize: 10,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    color: "#3B82F6",
    fontSize: 9,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: colors.warning,
    fontWeight: "600",
  },
  bookmarkBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
