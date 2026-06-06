import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  Book,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileStack,
  FileText,
  Grid,
  Star,
} from "lucide-react-native";

import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export interface MaterialCardProps {
  title: string;
  courseCode: string;
  fileType: "PDF" | "STUDY_DOC" | "SYSTEM_FILE" | "ETHICS";
  isVerified?: boolean;
  status?: "PENDING" | "VERIFIED" | "FLAGGED" | "TAKEN_DOWN";
  fileSize?: string;
  date?: string;
  rating?: number;
  isBookmarked?: boolean;
  onPress?: () => void;
  onBookmarkPress?: () => void;
}

export const MaterialCard = React.forwardRef<any, MaterialCardProps>(
  (
    {
      title,
      courseCode,
      fileType,
      isVerified,
      status,
      fileSize,
      date,
      rating,
      isBookmarked,
      onPress,
      onBookmarkPress,
    },
    ref
  ) => {
    const getIconConfig = () => {
      switch (fileType) {
        case "PDF":
          return { icon: <FileText size={20} color="#FFFFFF" />, bg: "#EF4444" };
        case "STUDY_DOC":
          return { icon: <FileStack size={20} color="#FFFFFF" />, bg: colors.primary };
        case "SYSTEM_FILE":
          return { icon: <Grid size={20} color="#FFFFFF" />, bg: "#38BDF8" };
        case "ETHICS":
          return { icon: <Book size={20} color="#FFFFFF" />, bg: "#A78BFA" };
        default:
          return { icon: <FileText size={20} color="#FFFFFF" />, bg: colors.textMuted };
      }
    };

    const { icon, bg } = getIconConfig();
    const isPending = status === "PENDING";

    return (
      <TouchableOpacity
        ref={ref}
        onPress={onPress}
        activeOpacity={0.82}
        style={styles.container}
      >
        <View style={[styles.iconContainer, { backgroundColor: bg }]}>{icon}</View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.coursePill}>
              <Text style={styles.courseText}>{courseCode}</Text>
            </View>

            {isVerified && (
              <View style={styles.verifiedBadge}>
                <CheckCircle2 size={10} color={colors.primary} style={styles.badgeIcon} />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            )}

            {isPending && (
              <View style={styles.pendingBadge}>
                <Clock size={10} color={colors.warning} style={styles.badgeIcon} />
                <Text style={styles.pendingText}>PENDING</Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText} numberOfLines={1}>
              {[fileSize, date].filter(Boolean).join(" · ")}
            </Text>

            {rating !== undefined && (
              <View style={styles.ratingContainer}>
                <Star size={12} color={colors.warning} fill={colors.warning} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>

        {onBookmarkPress ? (
          <TouchableOpacity
            onPress={onBookmarkPress}
            style={styles.bookmarkBtn}
            activeOpacity={0.65}
          >
            <Bookmark
              size={20}
              color={isBookmarked ? colors.primary : colors.textSecondary}
              fill={isBookmarked ? colors.primary : "transparent"}
            />
          </TouchableOpacity>
        ) : (
          <ChevronRight size={18} color={colors.textMuted} />
        )}
      </TouchableOpacity>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 14,
  },
  iconContainer: {
    alignItems: "center",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 8,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 6,
  },
  coursePill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  courseText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 9,
    fontWeight: "700",
  },
  verifiedBadge: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 5,
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  verifiedText: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: "800",
  },
  pendingBadge: {
    alignItems: "center",
    backgroundColor: "rgba(245,158,11,0.12)",
    borderRadius: 5,
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  pendingText: {
    color: colors.warning,
    fontSize: 8,
    fontWeight: "800",
  },
  badgeIcon: {
    marginRight: 3,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    fontSize: 10,
    marginRight: 8,
  },
  ratingContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  ratingText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: "600",
  },
  bookmarkBtn: {
    marginLeft: 8,
    padding: 4,
  },
});
