import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet, { BottomSheetFlatList, BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import Animated, { FadeInUp, Layout } from "react-native-reanimated";
import { AlertCircle, BookOpen, FileUp, Plus, RefreshCw, Upload } from "lucide-react-native";

import { Button } from "../../components/ui/Button";
import { CourseFilterTabs } from "../../components/ui/CourseFilterTabs";
import { Input } from "../../components/ui/Input";
import { MaterialCard } from "../../components/ui/MaterialCard";
import { Screen } from "../../components/layout/Screen";
import { Skeleton } from "../../components/ui/Skeleton";
import { Toast } from "../../components/ui/Toast";
import { materialService, Material } from "../../services/material";
import { AcademicProfile, CourseOption, StudentAcademicCourse, userService } from "../../services/user";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

const settle = async <T,>(promise: Promise<T>) => {
  try {
    const value = await promise;
    return { status: "fulfilled" as const, value };
  } catch (reason) {
    return { status: "rejected" as const, reason };
  }
};

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [academicProfile, setAcademicProfile] = useState<AcademicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["58%", "86%"], []);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCourseCode, setUploadCourseCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  const userCourses = useMemo(() => user?.courses || [], [user?.courses]);
  const defaultCourseCode = userCourses[0] || "";
  const userLevel = typeof user?.level === "number" ? user.level : 100;
  const hasAcademicProfile = Boolean(user?.university && user?.faculty && user?.department && user?.level);

  const fetchMaterials = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await materialService.getMaterials({
        university: user?.university,
        department: user?.department,
      });
      setMaterials(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load library materials.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchAcademicProfile();
  }, []);

  const fetchAcademicProfile = async () => {
    try {
      const [profileData, courseOptionData] = await Promise.all([
        userService.getAcademicProfile(),
        userService.getCourseOptions().catch(() => []),
      ]);
      setAcademicProfile(profileData);
      setCourseOptions(courseOptionData);
    } catch (err) {
      setAcademicProfile(null);
      setCourseOptions([]);
    }
  };

  const courseLookup = useMemo(() => {
    const map = new Map<string, StudentAcademicCourse>();
    for (const course of academicProfile?.student_courses || []) {
      map.set(course.code.toUpperCase(), course);
    }
    return map;
  }, [academicProfile]);

  const fallbackCourseOptions = useMemo<CourseOption[]>(
    () =>
      Array.from(
        new Map(
          (academicProfile?.student_courses || []).map((course) => [
            `${course.code}-${course.level}-${course.semester}`,
            {
              id: course.id || `${course.code}-${course.level}-${course.semester}`,
              code: course.code,
              name: course.name,
              level: course.level,
              semester: course.semester,
              source: course.source,
              usageCount: undefined,
            } satisfies CourseOption,
          ]),
        ).values(),
      ),
    [academicProfile],
  );

  const availableCourseOptions = useMemo(
    () => (courseOptions.length > 0 ? courseOptions : fallbackCourseOptions),
    [courseOptions, fallbackCourseOptions],
  );

  const selectedCourseMeta = useMemo(() => {
    const normalized = uploadCourseCode.trim().toUpperCase();
    return (
      availableCourseOptions.find((course) => course.code.toUpperCase() === normalized) ||
      courseLookup.get(normalized) ||
      null
    );
  }, [availableCourseOptions, courseLookup, uploadCourseCode]);

  useEffect(() => {
    if (!uploadCourseCode && defaultCourseCode) {
      setUploadCourseCode(defaultCourseCode);
    }
  }, [defaultCourseCode, uploadCourseCode]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMaterials();
  };

  const filteredMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return materials.filter((material) => {
      const courseCode = material.course_code || "General";
      const matchesCourse = selectedCourse === "All" || courseCode === selectedCourse;
      const matchesSearch =
        !query ||
        material.title.toLowerCase().includes(query) ||
        courseCode.toLowerCase().includes(query);

      return matchesCourse && matchesSearch;
    });
  }, [materials, searchQuery, selectedCourse]);

  const courses = useMemo(() => {
    const materialCourses = materials.map((material) => material.course_code || "General");
    return Array.from(new Set([...userCourses, ...materialCourses])).sort();
  }, [materials, userCourses]);

  // Exam Prep's "Study Now" navigates here with a course_code param scoped to that course.
  // Library is a persistent tab screen (not remounted per navigation), so re-apply the filter
  // on every focus rather than only on mount.
  useFocusEffect(
    useCallback(() => {
      const courseCode = route.params?.course_code;
      if (courseCode) {
        setSelectedCourse(courseCode);
      }
    }, [route.params?.course_code]),
  );

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "image/*",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        multiple: true,
      });

      if (!result.canceled) {
        const assets = result.assets.slice(0, 20);
        setSelectedFiles(assets);
        if (result.assets.length > 20) {
          setToast({ message: "Only the first 20 files were selected.", type: "warning" });
        }
        if (assets.length === 1 && !uploadTitle) {
          setUploadTitle(assets[0].name.split(".")[0].toUpperCase());
        } else if (assets.length > 1) {
          setUploadTitle("");
        }
      }
    } catch (err) {
      setToast({ message: "Could not open file picker.", type: "error" });
    }
  };

  const handleUpload = async () => {
    if (!uploadCourseCode || selectedFiles.length === 0 || !hasAcademicProfile) return;

    setUploading(true);
    try {
      const normalizedCourseCode = uploadCourseCode.trim().toUpperCase();
      const uploadResults = await Promise.all(
        selectedFiles.map(async (file, index) => {
          return settle((async () => {
            const fileExtension = file.name.split(".").pop()?.toUpperCase();
            const fileType =
              fileExtension === "PDF"
                ? "PDF"
                : ["JPG", "JPEG", "PNG", "WEBP"].includes(fileExtension || "")
                  ? "IMAGE"
                  : "DOC";
            const mimeType =
              file.mimeType ||
              (fileType === "PDF"
                ? "application/pdf"
                : fileType === "IMAGE"
                  ? fileExtension === "PNG"
                    ? "image/png"
                    : fileExtension === "WEBP"
                      ? "image/webp"
                      : "image/jpeg"
                  : fileExtension === "DOC"
                    ? "application/msword"
                    : fileExtension === "TXT"
                      ? "text/plain"
                      : fileExtension === "MD"
                        ? "text/markdown"
                        : fileExtension === "CSV"
                          ? "text/csv"
                          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            const fallbackTitle = file.name.replace(/\.[^.]+$/, "").toUpperCase();
            const title =
              selectedFiles.length === 1
                ? (uploadTitle.trim() || fallbackTitle).toUpperCase()
                : fallbackTitle;

            const { materialId, presignedUrl } = await materialService.uploadMaterial({
              title,
              course_code: normalizedCourseCode,
              university: user?.university || "",
              faculty: user?.faculty || "",
              department: user?.department || "",
              level: userLevel,
              semester: selectedCourseMeta?.semester || null,
              semester_start:
                "semester_start" in (selectedCourseMeta || {}) ? (selectedCourseMeta as StudentAcademicCourse).semester_start || null : null,
              semester_end:
                "semester_end" in (selectedCourseMeta || {}) ? (selectedCourseMeta as StudentAcademicCourse).semester_end || null : null,
              file_type: fileType,
              file_name: file.name,
              file_size: file.size || 0,
              mime_type: mimeType,
            });

            const localFileResponse = await fetch(file.uri);
            if (!localFileResponse.ok) {
              throw new Error(`Could not read selected file (${localFileResponse.status})`);
            }

            const blob = await localFileResponse.blob();
            const uploadResponse = await fetch(presignedUrl, {
              method: "PUT",
              body: blob,
              headers: { "Content-Type": mimeType },
            });

            if (!uploadResponse.ok) {
              throw new Error(`Cloud upload failed (${uploadResponse.status})`);
            }

            const confirmedMaterial = await materialService.confirmUpload(materialId);
            return { confirmedMaterial, index };
          })());
        }),
      );

      const successfulUploads = uploadResults.filter(
        (result): result is { status: "fulfilled"; value: { confirmedMaterial: Material; index: number } } =>
          result.status === "fulfilled",
      );
      const failedUploads = uploadResults.length - successfulUploads.length;

      if (successfulUploads.length === 0) {
        const firstFailure = uploadResults.find(
          (result): result is { status: "rejected"; reason: any } => result.status === "rejected",
        );
        throw new Error(
          firstFailure?.reason?.response?.data?.message ||
          firstFailure?.reason?.message ||
          "All uploads failed",
        );
      }

      bottomSheetRef.current?.close();
      setUploadTitle("");
      setUploadCourseCode(defaultCourseCode);
      setSelectedFiles([]);
      fetchMaterials();
      fetchAcademicProfile();
      const degradedNotice = successfulUploads.find(
        (result) => result.value.confirmedMaterial.processingNotice?.status === "degraded",
      );
      setToast({
        message: degradedNotice
          ? degradedNotice.value.confirmedMaterial.processingNotice?.message || "Some uploads were received in degraded mode."
          : failedUploads > 0
            ? `${successfulUploads.length} file(s) uploaded, ${failedUploads} failed.`
            : `${successfulUploads.length} file(s) uploaded. Pending admin approval.`,
        type: failedUploads > 0 ? "warning" : "success",
      });
      navigation.navigate("MyUploads", { uploadStatus: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Upload failed. Please try again.",
        type: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTypography}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.subtitle}>
          {materials.length} verified material{materials.length === 1 ? "" : "s"}
        </Text>
      </View>

      <View style={styles.searchBarContainer}>
        <Input
          label=""
          placeholder="Search materials or course code..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
      </View>

      <CourseFilterTabs
        courses={courses}
        selectedCourse={selectedCourse}
        onSelectCourse={setSelectedCourse}
        contentPaddingHorizontal={0}
      />
    </View>
  );

  const renderSkeleton = () => (
    <View style={styles.skeletonContent}>
      {[1, 2, 3, 4].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <Skeleton width={42} height={42} borderRadius={8} />
          <View style={styles.skeletonBody}>
            <Skeleton width="82%" height={16} />
            <Skeleton width="44%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <AlertCircle size={28} color={colors.warning} />
          </View>
          <Text style={styles.emptyTitle}>Library unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={fetchMaterials} style={styles.retryButton}>
            <RefreshCw size={16} color={colors.background} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <BookOpen size={28} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>
          {searchQuery || selectedCourse !== "All" ? "No matching materials" : "No verified materials yet"}
        </Text>
        <Text style={styles.emptyText}>
          {searchQuery || selectedCourse !== "All"
            ? "Try another course filter or search term."
            : "Upload a course material to help build your department library. It becomes public after admin approval."}
        </Text>
      </View>
    );
  };

  return (
    <Screen hideHeader style={styles.screen}>
      <FlatList
        data={loading && !refreshing ? [] : filteredMaterials}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(index * 45).duration(320)} layout={Layout.springify()}>
            <MaterialCard
              title={item.title}
              courseCode={item.course_code || "General"}
              fileType={item.file_type === "PDF" ? "PDF" : item.file_type === "IMAGE" ? "SYSTEM_FILE" : "STUDY_DOC"}
              isVerified={item.verification_status === "VERIFIED"}
              status={item.verification_status}
              date={new Date(item.updated_at || item.created_at || Date.now()).toLocaleDateString()}
              rating={item.rating}
              isBookmarked={item.isBookmarked}
              onPress={() => navigation.navigate("StudyMode", { materialId: item.id })}
            />
          </Animated.View>
        )}
        ListHeaderComponent={renderHeader}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          (filteredMaterials.length === 0 || error) && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={error || !loading ? renderEmpty : null}
      />

      {loading && !refreshing && renderSkeleton()}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => bottomSheetRef.current?.expand()}
        activeOpacity={0.82}
      >
        <Plus size={28} color={colors.background} />
      </TouchableOpacity>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetScrollView
          style={styles.bottomSheetContent}
          contentContainerStyle={styles.bottomSheetScrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <Text style={styles.sheetTitle}>Upload material</Text>
          <Text style={styles.sheetSubtitle}>
            Your upload goes to admin review before other students can see it.
          </Text>

          {!hasAcademicProfile && (
            <View style={styles.warningBox}>
              <AlertCircle size={16} color={colors.warning} />
              <Text style={styles.warningText}>
                Complete your university, faculty, department, and level before uploading.
              </Text>
            </View>
          )}

          <Button
            label={selectedFiles.length > 0 ? `${selectedFiles.length} FILE${selectedFiles.length === 1 ? "" : "S"} SELECTED` : "Select files"}
            variant="secondary"
            onPress={handleSelectFile}
            icon={<Upload size={20} color="#FFFFFF" />}
            style={styles.sheetButton}
          />

          {selectedFiles.length > 0 ? (
            <View style={styles.selectedFilesCard}>
              {selectedFiles.map((file) => (
                <Text key={`${file.uri}-${file.name}`} style={styles.selectedFileName} numberOfLines={1}>
                  {file.name.toUpperCase()}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.sheetLabel}>Course Code</Text>
            <Input
              label=""
              placeholder="e.g. EEE 301"
              value={uploadCourseCode}
              onChangeText={(value) => setUploadCourseCode(value.toUpperCase())}
            />
            {availableCourseOptions.length > 0 && (
              <View style={styles.quickCoursePills}>
                {availableCourseOptions.slice(0, 4).map(course => {
                  const isActive = course.code.toUpperCase() === uploadCourseCode.trim().toUpperCase();
                  return (
                    <TouchableOpacity
                      key={course.id}
                      style={[styles.coursePill, isActive && styles.coursePillActive]}
                      onPress={() => setUploadCourseCode(course.code.toUpperCase())}
                    >
                      <Text style={[styles.coursePillText, isActive && styles.coursePillTextActive]}>
                        {course.code.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {selectedFiles.length <= 1 ? (
            <View style={styles.inputGroup}>
              <Text style={styles.sheetLabel}>Material Title</Text>
              <Input
                label=""
                placeholder="e.g. Week 1 Lecture Note"
                value={uploadTitle}
                onChangeText={setUploadTitle}
              />
            </View>
          ) : (
            <Text style={styles.batchHelperText}>
              Multiple files use each file name as the material title.
            </Text>
          )}

          <Button
            label="Submit for review"
            onPress={handleUpload}
            loading={uploading}
            disabled={
              !uploadCourseCode ||
              selectedFiles.length === 0 ||
              (selectedFiles.length === 1 && !uploadTitle.trim()) ||
              !hasAcademicProfile
            }
            icon={<FileUp size={18} color="#FFFFFF" />}
            style={styles.uploadButton}
          />
        </BottomSheetScrollView>
      </BottomSheet>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={4500}
          onHide={() => setToast(null)}
        />
      )}
    </Screen>
  );
};



const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  list: {
    flex: 1,
  },
  header: {
    paddingTop: 0,
    marginBottom: 2,
  },
  headerTypography: {
    paddingHorizontal: 18,
    marginBottom: 20,
    marginTop: 12,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 28,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  searchBarContainer: {
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  searchInput: {
    marginBottom: 0,
  },
  listContent: {
    paddingBottom: 100,
    paddingHorizontal: 18,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  skeletonContent: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 136,
    position: "absolute",
    right: 0,
    top: 0,
  },
  skeletonCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 14,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    height: 58,
    justifyContent: "center",
    marginBottom: 18,
    width: 58,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: "row",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    ...typography.body,
    color: colors.background,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },
  fab: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    bottom: 24,
    elevation: 8,
    height: 56,
    justifyContent: "center",
    position: "absolute",
    right: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    width: 56,
  },
  sheetBackground: {
    backgroundColor: colors.surface,
  },
  sheetHandle: {
    backgroundColor: colors.border,
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetScrollContent: {
    padding: 24,
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 20,
    marginBottom: 6,
  },
  sheetSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  warningBox: {
    alignItems: "flex-start",
    backgroundColor: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.25)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 14,
    padding: 12,
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 8,
  },
  sheetButton: {
    borderRadius: 8,
    marginBottom: 18,
  },
  selectedFilesCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    maxHeight: 156,
    padding: 12,
  },
  selectedFileName: {
    ...typography.caption,
    color: colors.textPrimary,
    fontSize: 11,
    marginBottom: 6,
  },
  inputGroup: {
    marginBottom: 20,
  },
  sheetLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickCoursePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  coursePill: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coursePillActive: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.34)",
  },
  coursePillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  coursePillTextActive: {
    color: colors.primary,
  },
  batchHelperText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  uploadButton: {
    borderRadius: 8,
    marginTop: 18,
  },
});
