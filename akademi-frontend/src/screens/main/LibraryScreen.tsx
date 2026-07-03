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
  const [isSearchActive, setIsSearchActive] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["58%", "86%"], []);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCourseCode, setUploadCourseCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [courseInputMode, setCourseInputMode] = useState<"select" | "manual">("select");
  const [showCourseOptions, setShowCourseOptions] = useState(false);
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
      setShowCourseOptions(false);
      setCourseInputMode("select");
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
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <BookOpen size={22} color={colors.primary} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Library</Text>
          <Text style={styles.subtitle}>
            {materials.length} verified material{materials.length === 1 ? "" : "s"} for your department
          </Text>
        </View>
      </View>

      {isSearchActive && (
        <View style={styles.searchBarContainer}>
          <Input
            label=""
            placeholder="Search title or course code"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          <TouchableOpacity
            onPress={() => {
              setIsSearchActive(false);
              setSearchQuery("");
            }}
            style={styles.cancelSearch}
          >
            <Text style={styles.cancelSearchText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <CourseFilterTabs
        courses={courses}
        selectedCourse={selectedCourse}
        onSelectCourse={setSelectedCourse}
        onSearchPress={() => setIsSearchActive(true)}
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

          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeToggleChip, courseInputMode === "select" && styles.modeToggleChipActive]}
              onPress={() => setCourseInputMode("select")}
              activeOpacity={0.85}
            >
              <Text style={[styles.modeToggleText, courseInputMode === "select" && styles.modeToggleTextActive]}>
                Select saved code
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggleChip, courseInputMode === "manual" && styles.modeToggleChipActive]}
              onPress={() => setCourseInputMode("manual")}
              activeOpacity={0.85}
            >
              <Text style={[styles.modeToggleText, courseInputMode === "manual" && styles.modeToggleTextActive]}>
                Type new code
              </Text>
            </TouchableOpacity>
          </View>

          {courseInputMode === "select" ? (
            <View>
              <TouchableOpacity
                style={styles.coursePicker}
                onPress={() => setShowCourseOptions((current) => !current)}
                activeOpacity={0.85}
              >
                <Text style={[styles.coursePickerText, !uploadCourseCode && styles.coursePickerPlaceholder]}>
                  {uploadCourseCode || "Choose course code"}
                </Text>
              </TouchableOpacity>

              {showCourseOptions ? (
                <BottomSheetFlatList
                  style={styles.courseOptionsCard}
                  data={availableCourseOptions}
                  keyExtractor={(course) => `${course.code}-${course.level}-${course.semester}`}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.courseOptionsContent}
                  nestedScrollEnabled
                  renderItem={({ item: course }) => {
                      const active = course.code.toUpperCase() === uploadCourseCode.trim().toUpperCase();
                      return (
                        <TouchableOpacity
                          style={[styles.courseOptionRow, active && styles.courseOptionRowActive]}
                          onPress={() => {
                            setUploadCourseCode(course.code.toUpperCase());
                            setShowCourseOptions(false);
                        }}
                        activeOpacity={0.82}
                      >
                        <Text style={styles.courseOptionCode}>{course.code.toUpperCase()}</Text>
                        <Text style={styles.courseOptionMeta}>SEMESTER {course.semester}</Text>
                        </TouchableOpacity>
                      );
                    }}
                />
              ) : null}
            </View>
          ) : (
            <Input
              label="Course Code"
              placeholder="e.g. EEE 301"
              value={uploadCourseCode}
              onChangeText={(value) => setUploadCourseCode(value.toUpperCase())}
            />
          )}

          {selectedFiles.length <= 1 ? (
            <Input
              label="Material Title"
              placeholder="e.g. Week 1 Lecture Note"
              value={uploadTitle}
              onChangeText={setUploadTitle}
            />
          ) : (
            <Text style={styles.batchHelperText}>
              Multiple files use each file name as the material title, in uppercase.
            </Text>
          )}

          <View style={styles.profileCard}>
            <InfoRow label="University" value={user?.university || "Not set"} />
            <InfoRow label="Faculty" value={user?.faculty || "Not set"} />
            <InfoRow label="Department" value={user?.department || "Not set"} />
            <InfoRow label="Level" value={user?.level ? `${user.level}L` : "Not set"} />
            <InfoRow
              label="Semester"
              value={
                selectedCourseMeta?.semester
                  ? `Semester ${selectedCourseMeta.semester}`
                  : "Matched after save"
              }
            />
          </View>

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

const InfoRow = ({ label, value }: { label: string; value: string }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
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
  hero: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(34,197,94,0.24)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 16,
    padding: 16,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    marginRight: 12,
    width: 44,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 21,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  searchBarContainer: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  cancelSearch: {
    marginLeft: 12,
  },
  cancelSearchText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
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
  modeToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  modeToggleChip: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeToggleChipActive: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.34)",
  },
  modeToggleText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  modeToggleTextActive: {
    color: colors.primary,
  },
  coursePicker: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    marginBottom: 12,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  coursePickerText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  coursePickerPlaceholder: {
    color: colors.textMuted,
  },
  courseOptionsCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    maxHeight: 208,
  },
  courseOptionsContent: {
    paddingBottom: 4,
  },
  courseOptionRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  courseOptionRowActive: {
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  courseOptionCode: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  courseOptionMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  batchHelperText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  profileCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
    padding: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  infoValue: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 12,
    textAlign: "right",
  },
  uploadButton: {
    borderRadius: 8,
    marginTop: 18,
  },
});
