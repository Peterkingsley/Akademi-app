import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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

import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

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
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const getIconConfig = () => {
      switch (fileType) {
        case "PDF":
          return { icon: <FileText size={20} color="#FFFFFF" />, bgColors: ["#EF4444", "#B91C1C"] as const };
        case "STUDY_DOC":
          return { icon: <FileStack size={20} color="#FFFFFF" />, bgColors: [colors.primary, "#15803D"] as const };
        case "SYSTEM_FILE":
          return { icon: <Grid size={20} color="#FFFFFF" />, bgColors: ["#38BDF8", "#0369A1"] as const };
        case "ETHICS":
          return { icon: <Book size={20} color="#FFFFFF" />, bgColors: ["#C084FC", "#6B21A8"] as const };
        default:
          return { icon: <FileText size={20} color="#FFFFFF" />, bgColors: ["#6B7280", "#374151"] as const };
      }
    };

    const { icon, bgColors } = getIconConfig();
    const isPending = status === "PENDING";

    return (
      <TouchableOpacity
        ref={ref}
        onPress={onPress}
        activeOpacity={0.82}
        style={styles.container}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${courseCode}${isVerified ? ", verified material" : ""}`}
        accessibilityHint="Open this material"
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
        
        <LinearGradient
          colors={bgColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconContainer}
        >
          {icon}
        </LinearGradient>

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
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? `Remove ${title} from bookmarks` : `Bookmark ${title}`}
          >
            <Bookmark
              size={20}
              color={isBookmarked ? colors.primary : colors.textSecondary}
              fill={isBookmarked ? colors.primary : "transparent"}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.actionArrowCircle}>
            <ChevronRight size={16} color={colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
    );
  }
);

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 14,
    overflow: "hidden",
  },
  iconContainer: {
    alignItems: "center",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  content: {
    flex: 1,
    marginLeft: 14,
    minWidth: 0,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14.5,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 7,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 6,
  },
  coursePill: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.25)",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  courseText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },
  verifiedBadge: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.1)",
    borderColor: "rgba(34,197,94,0.2)",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  verifiedText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  pendingBadge: {
    alignItems: "center",
    backgroundColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.25)",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pendingText: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeIcon: {
    marginRight: 3,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: "700",
  },
  bookmarkBtn: {
    marginLeft: 8,
    padding: 6,
  },
  actionArrowCircle: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    marginLeft: 8,
    width: 32,
  },
});
