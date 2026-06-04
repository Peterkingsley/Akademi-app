import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Plus, Upload, Search } from "lucide-react-native";
import Animated, { FadeInUp, Layout } from "react-native-reanimated";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { MaterialCard } from "../../components/ui/MaterialCard";
import { CourseFilterTabs } from "../../components/ui/CourseFilterTabs";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import * as DocumentPicker from "expo-document-picker";
import { materialService, Material } from "../../services/material";
import { useAuthStore } from "../../store/useAuthStore";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Upload Bottom Sheet state
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%", "80%"], []);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCourseCode, setUploadCourseCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const data = await materialService.getMaterials({
        university: user?.university,
        department: user?.department,
      });
      setMaterials(data);
    } catch (error) {
      console.error("Error fetching materials:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMaterials();
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const courseCode = m.course_code || "General";
      const matchesCourse = selectedCourse === "All" || courseCode === selectedCourse;
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           courseCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCourse && matchesSearch;
    });
  }, [materials, selectedCourse, searchQuery]);

  const courses = useMemo(() => {
    const uniqueCourses = Array.from(new Set(materials.map(m => m.course_code || "General")));
    return uniqueCourses.sort();
  }, [materials]);


  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      });

      if (!result.canceled) {
        setSelectedFile(result);
        if (!uploadTitle) {
          setUploadTitle(result.assets[0].name.split(".")[0]);
        }
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  };

    const handleUpload = async () => {
    if (!uploadTitle || !uploadCourseCode || !selectedFile || selectedFile.canceled) return;

    setUploading(true);
    try {
      const file = selectedFile.assets[0];
      const fileExtension = file.name.split(".").pop()?.toUpperCase();
      const fileType = fileExtension === "PDF" ? "PDF" : (["JPG", "JPEG", "PNG"].includes(fileExtension || "") ? "IMAGE" : "DOC");

      // 1. Create upload entry and get presigned URL
      const { materialId, presignedUrl } = await materialService.uploadMaterial({
        title: uploadTitle,
        course_code: uploadCourseCode,
        university: user?.university || "",
        faculty: "Science", // Ideally this should be dynamic or from user profile
        department: user?.department || "",
        level: 300, // Ideally dynamic
        file_type: fileType,
      });

      // 2. Upload to S2/R2
      const response = await fetch(file.uri);
      const blob = await response.blob();

      await fetch(presignedUrl, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });

      // 3. Confirm upload
      await materialService.confirmUpload(materialId);

      bottomSheetRef.current?.close();
      setUploadTitle("");
      setUploadCourseCode("");
      setSelectedFile(null);
      fetchMaterials();
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleSection}>
        <Text style={[styles.title, typography.h1]}>Library</Text>
        <Text style={[styles.subtitle, typography.bodySmall]}>
          Access your curated course materials
        </Text>
      </View>

      {isSearchActive && (
        <View style={styles.searchBarContainer}>
           <Input
            label=""
            placeholder="Search materials..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          <TouchableOpacity onPress={() => {setIsSearchActive(false); setSearchQuery("");}} style={styles.cancelSearch}>
            <Text style={[typography.caption, {color: colors.primary}]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <CourseFilterTabs
        courses={courses}
        selectedCourse={selectedCourse}
        onSelectCourse={setSelectedCourse}
        onSearchPress={() => setIsSearchActive(true)}
      />
    </View>
  );

  const renderSkeleton = () => (
    <View style={styles.listContent}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width={40} height={40} borderRadius={8} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <Skeleton width="80%" height={16} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <Screen hideHeader style={styles.screen}>
      <FlatList
        data={filteredMaterials}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInUp.delay(index * 50).duration(400)}
            layout={Layout.springify()}
          >
            <MaterialCard
              title={item.title}
              courseCode={item.course_code || "General"}
              fileType={item.file_type === "PDF" ? "PDF" : item.file_type === "IMAGE" ? "SYSTEM_FILE" : "STUDY_DOC"}
              isVerified={item.verification_status === "VERIFIED"}
              fileSize={"-"}
              date={new Date(item.updated_at || item.created_at || Date.now()).toLocaleDateString()}
              rating={item.rating}
              isBookmarked={item.isBookmarked}
              onPress={() => navigation.navigate("StudyMode", { materialId: item.id })}
            />
          </Animated.View>
        )}
        ListHeaderComponent={renderHeader}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          filteredMaterials.length === 0 && { flexGrow: 1, justifyContent: "center" }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, typography.body]}>No materials found</Text>
            </View>
          ) : null
        }
      />

      {loading && !refreshing && renderSkeleton()}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => bottomSheetRef.current?.expand()}
        activeOpacity={0.8}
      >
        <Plus size={32} color="#FFFFFF" />
      </TouchableOpacity>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <Text style={[styles.sheetTitle, typography.h2]}>Upload Material</Text>

                    <Button
            label={selectedFile && !selectedFile.canceled ? selectedFile.assets[0].name : "Select File"}
            variant="secondary"
            onPress={handleSelectFile}
            icon={<Upload size={20} color="#FFFFFF" />}
            style={styles.sheetBtn}
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

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, typography.caption]}>University:</Text>
            <Text style={[styles.infoValue, typography.caption]}>{user?.university || "Not set"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, typography.caption]}>Department:</Text>
            <Text style={[styles.infoValue, typography.caption]}>{user?.department || "Not set"}</Text>
          </View>

          <Button
            label="Upload"
            onPress={handleUpload}
            loading={uploading}
            style={styles.uploadBtn}
          />
        </BottomSheetView>
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    paddingTop: 10,
  },
  titleSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  cancelSearch: {
    marginLeft: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  skeletonCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bottomSheetContent: {
    padding: 24,
    flex: 1,
  },
  sheetTitle: {
    color: "#FFFFFF",
    marginBottom: 24,
  },
  sheetBtn: {
    marginBottom: 20,
  },
  uploadBtn: {
    marginTop: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: {
    color: colors.textSecondary,
  },
  infoValue: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
});
