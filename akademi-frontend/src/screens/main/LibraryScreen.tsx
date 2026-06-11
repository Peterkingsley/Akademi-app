import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as DocumentPicker from "expo-document-picker";
import { useNavigation } from "@react-navigation/native";
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
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["58%", "86%"], []);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCourseCode, setUploadCourseCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
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
  }, []);

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

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "image/*",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });

      if (!result.canceled) {
        setSelectedFile(result);
        if (!uploadTitle) {
          setUploadTitle(result.assets[0].name.split(".")[0]);
        }
      }
    } catch (err) {
      setToast({ message: "Could not open file picker.", type: "error" });
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle || !uploadCourseCode || !selectedFile || selectedFile.canceled || !hasAcademicProfile) return;

    setUploading(true);
    try {
      const file = selectedFile.assets[0];
      const fileExtension = file.name.split(".").pop()?.toUpperCase();
      const fileType =
        fileExtension === "PDF"
          ? "PDF"
          : ["JPG", "JPEG", "PNG"].includes(fileExtension || "")
            ? "IMAGE"
            : "DOC";

      const { materialId, presignedUrl } = await materialService.uploadMaterial({
        title: uploadTitle.trim(),
        course_code: uploadCourseCode.trim().toUpperCase(),
        university: user?.university || "",
        faculty: user?.faculty || "",
        department: user?.department || "",
        level: userLevel,
        file_type: fileType,
      });

      const response = await fetch(file.uri);
      const blob = await response.blob();

      await fetch(presignedUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "application/octet-stream" },
      });

      await materialService.confirmUpload(materialId);

      bottomSheetRef.current?.close();
      setUploadTitle("");
      setUploadCourseCode(defaultCourseCode);
      setSelectedFile(null);
      fetchMaterials();
      setToast({
        message: "Upload received. It is pending admin approval.",
        type: "success",
      });
      navigation.navigate("MyUploads", { uploadStatus: "success" });
    } catch (err) {
      setToast({
        message: "Upload failed. Please check your connection and try again.",
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
        <BottomSheetView style={styles.bottomSheetContent}>
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
            label={selectedFile && !selectedFile.canceled ? selectedFile.assets[0].name : "Select file"}
            variant="secondary"
            onPress={handleSelectFile}
            icon={<Upload size={20} color="#FFFFFF" />}
            style={styles.sheetButton}
          />

          <Input
            label="Course Code"
            placeholder="e.g. EEE 301"
            value={uploadCourseCode}
            onChangeText={setUploadCourseCode}
          />

          <Input
            label="Material Title"
            placeholder="e.g. Week 1 Lecture Note"
            value={uploadTitle}
            onChangeText={setUploadTitle}
          />

          <View style={styles.profileCard}>
            <InfoRow label="University" value={user?.university || "Not set"} />
            <InfoRow label="Faculty" value={user?.faculty || "Not set"} />
            <InfoRow label="Department" value={user?.department || "Not set"} />
            <InfoRow label="Level" value={user?.level ? `${user.level}L` : "Not set"} />
          </View>

          <Button
            label="Submit for review"
            onPress={handleUpload}
            loading={uploading}
            disabled={!uploadTitle || !uploadCourseCode || !selectedFile || selectedFile.canceled || !hasAcademicProfile}
            icon={<FileUp size={18} color="#FFFFFF" />}
            style={styles.uploadButton}
          />
        </BottomSheetView>
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
