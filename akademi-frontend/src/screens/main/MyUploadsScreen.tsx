import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronRight, CloudUpload, Clock, FileText, RefreshCw } from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Material } from "../../services/material";
import { AcademicProfile, StudentAcademicCourse, userService } from "../../services/user";

type UploadGroup = {
  title: string;
  subtitle: string;
  uploads: Material[];
};

const formatDate = (value?: string) => new Date(value || Date.now()).toLocaleDateString();

const getSemesterLabel = (course?: StudentAcademicCourse, fallbackLevel?: number) => {
  if (!course) return `${fallbackLevel || "General"} - Unmatched course`;
  return `${course.level}L - Semester ${course.semester}`;
};

const getUploadSemesterLabel = (upload: Material, course?: StudentAcademicCourse) => {
  if (upload.semester) return `${upload.level}L - Semester ${upload.semester}`;
  return getSemesterLabel(course, upload.level);
};

export const MyUploadsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const showUploadSuccess = route.params?.uploadStatus === "success";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploads, setUploads] = useState<Material[]>([]);
  const [academicProfile, setAcademicProfile] = useState<AcademicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = async () => {
    try {
      setError(null);
      const [uploadData, profileData] = await Promise.all([
        userService.getUploads(),
        userService.getAcademicProfile(),
      ]);
      setUploads(uploadData);
      setAcademicProfile(profileData);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load your uploads.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const courseLookup = useMemo(() => {
    const map = new Map<string, StudentAcademicCourse>();
    for (const course of academicProfile?.student_courses || []) {
      map.set(course.code.toUpperCase(), course);
    }
    return map;
  }, [academicProfile]);

  const groupedUploads = useMemo(() => {
    const groups = new Map<string, UploadGroup>();
    for (const upload of uploads) {
      const course = upload.course_code ? courseLookup.get(upload.course_code.toUpperCase()) : undefined;
      const title = getUploadSemesterLabel(upload, course);
      const subtitle = course
        ? `${academicProfile?.department || upload.department} / ${course.code}`
        : `${upload.department || "Department"} / ${upload.course_code || "General"}`;
      const group = groups.get(title) || { title, subtitle, uploads: [] };
      group.uploads.push(upload);
      groups.set(title, group);
    }
    return Array.from(groups.values());
  }, [uploads, courseLookup, academicProfile]);

  const getStatusConfig = (status: Material["verification_status"]) => {
    switch (status) {
      case "VERIFIED":
        return { label: "Public", helper: "Approved and visible to other students", backgroundColor: "rgba(34, 197, 94, 0.1)", color: colors.primary, icon: CheckCircle2 };
      case "FLAGGED":
        return { label: "Needs review", helper: "Admin review found an issue", backgroundColor: "rgba(239, 68, 68, 0.1)", color: colors.error, icon: AlertCircle };
      case "TAKEN_DOWN":
        return { label: "Removed", helper: "This material is no longer public", backgroundColor: "rgba(239, 68, 68, 0.1)", color: colors.error, icon: AlertCircle };
      case "PENDING":
      default:
        return { label: "Pending approval", helper: "Only you can use it until admin approves", backgroundColor: "rgba(245, 158, 11, 0.1)", color: colors.warning, icon: Clock };
    }
  };

  const renderUpload = (item: Material) => {
    const status = getStatusConfig(item.verification_status);
    const StatusIcon = status.icon;

    return (
      <TouchableOpacity key={item.id} style={styles.uploadItem} activeOpacity={0.75} onPress={() => navigation.navigate("StudyMode", { materialId: item.id })}>
        <View style={styles.fileIcon}>
          <FileText size={19} color={colors.primary} />
        </View>
        <View style={styles.uploadInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.title.toUpperCase()}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{item.course_code || "General"}</Text>
            <View style={styles.dot} />
            <CalendarDays size={10} color={colors.textMuted} />
            <Text style={styles.metaText}>{formatDate(item.updated_at || item.created_at)}</Text>
          </View>
          <Text style={styles.statusHelper} numberOfLines={2}>{status.helper}</Text>
        </View>
        <View style={styles.trailing}>
          <View style={[styles.statusPill, { backgroundColor: status.backgroundColor }]}>
            <StatusIcon size={10} color={status.color} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <ChevronRight size={17} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={{ flex: 1 }} title="My Uploads" onBack={() => navigation.goBack()}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUploads(); }} tintColor={colors.primary} />}
        >
          {showUploadSuccess && (
            <View style={styles.successBanner}>
              <Text style={styles.successTitle}>Upload complete</Text>
              <Text style={styles.successText}>Your material is filed under its course, level, and semester. Other students will see it after admin approval.</Text>
            </View>
          )}

          {error ? (
            <TouchableOpacity onPress={fetchUploads} style={styles.retryCard}>
              <RefreshCw size={16} color={colors.warning} />
              <Text style={styles.retryText}>{error} Tap to retry.</Text>
            </TouchableOpacity>
          ) : groupedUploads.length > 0 ? (
            groupedUploads.map((group) => (
              <View key={group.title} style={styles.uploadGroup}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
                <View style={styles.groupCard}>{group.uploads.map(renderUpload)}</View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><CloudUpload size={30} color={colors.primary} /></View>
              <Text style={styles.emptyTitle}>No uploads yet</Text>
              <Text style={styles.emptySubtitle}>Upload materials from Library. Akademi will file them by course, level, and semester.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 18, paddingBottom: 40 },
  successBanner: { backgroundColor: "rgba(34, 197, 94, 0.1)", borderWidth: 1, borderColor: "rgba(34, 197, 94, 0.35)", borderRadius: 10, padding: 14, marginBottom: 14 },
  successTitle: { color: colors.primary, fontSize: 13, fontFamily: "Inter-Bold", fontWeight: "700" },
  successText: { color: colors.textSecondary, fontSize: 11, fontFamily: "Inter-Regular", lineHeight: 16, marginTop: 4 },
  uploadGroup: { marginBottom: 18 },
  groupTitle: { ...typography.h3, color: colors.textPrimary, fontSize: 16 },
  groupSubtitle: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginTop: 3, marginBottom: 10 },
  groupCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  uploadItem: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  fileIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(34, 197, 94, 0.1)", justifyContent: "center", alignItems: "center", marginRight: 13 },
  uploadInfo: { flex: 1, minWidth: 0 },
  fileName: { ...typography.h3, color: colors.textPrimary, fontSize: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  metaText: { fontSize: 10, color: colors.textMuted, fontFamily: "SpaceMono-Regular" },
  dot: { width: 2, height: 2, borderRadius: 1, backgroundColor: colors.textMuted, marginHorizontal: 4 },
  statusPill: { alignItems: "center", flexDirection: "row", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, maxWidth: 104 },
  statusIcon: { marginRight: 3 },
  statusText: { fontSize: 8, fontWeight: "700", fontFamily: "Inter-Bold", textAlign: "center" },
  trailing: { alignItems: "flex-end", gap: 12, marginLeft: 8 },
  statusHelper: { fontSize: 10, color: colors.textSecondary, fontFamily: "Inter-Regular", marginTop: 6, lineHeight: 14 },
  emptyState: { justifyContent: "center", alignItems: "center", padding: 40, minHeight: 420 },
  emptyIcon: { alignItems: "center", backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 8, height: 58, justifyContent: "center", marginBottom: 18, width: 58 },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, marginTop: 20 },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: 8 },
  retryCard: { alignItems: "center", backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.28)", borderRadius: 10, borderWidth: 1, flexDirection: "row", padding: 13 },
  retryText: { ...typography.bodySmall, color: colors.warning, flex: 1, fontSize: 11, marginLeft: 8 },
});
