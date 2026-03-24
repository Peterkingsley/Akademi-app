import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Search, Plus, Upload } from "lucide-react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import Animated, {
  FadeInUp,
  Layout
} from "react-native-reanimated";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/ui/Avatar";
import { MaterialCard } from "../../components/ui/MaterialCard";
import { CourseFilterTabs } from "../../components/ui/CourseFilterTabs";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { materialService, Material } from "../../services/material";
import { useAuthStore } from "../../store/useAuthStore";
import { useNavigation } from "@react-navigation/native";

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Upload Bottom Sheet state
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%", "80%"], []);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCourseCode, setUploadCourseCode] = useState("");
  const [uploading, setUploading] = useState(false);

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
      const matchesCourse = selectedCourse === "All" || m.course_code === selectedCourse;
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           m.course_code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCourse && matchesSearch;
    });
  }, [materials, selectedCourse, searchQuery]);

  const courses = useMemo(() => {
    const uniqueCourses = Array.from(new Set(materials.map(m => m.course_code)));
    return uniqueCourses.sort();
  }, [materials]);

  const handleUpload = async () => {
    if (!uploadTitle || !uploadCourseCode) return;

    setUploading(true);
    try {
      await materialService.uploadMaterial({
        title: uploadTitle,
        course_code: uploadCourseCode,
        university: user?.university || "",
        faculty: "Science",
        department: user?.department || "",
        level: 300,
        file_type: "PDF",
      });

      bottomSheetRef.current?.close();
      setUploadTitle("");
      setUploadCourseCode("");
      fetchMaterials();
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Avatar name={user?.name || "User"} size={40} />
        </TouchableOpacity>
        <Text style={[styles.branding, typography.h3]}>Akademi</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Search size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleSection}>
        <Text style={[styles.title, typography.h1]}>Library</Text>
        <Text style={[styles.subtitle, typography.bodySmall]}>
          Access your curated course materials
        </Text>
      </View>

      <CourseFilterTabs
        courses={courses}
        selectedCourse={selectedCourse}
        onSelectCourse={setSelectedCourse}
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
    <Screen style={styles.screen}>
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
              courseCode={item.course_code}
              fileType={item.file_type === "PDF" ? "PDF" : item.file_type === "IMAGE" ? "SYSTEM_FILE" : "STUDY_DOC"}
              isVerified={item.verification_status === "VERIFIED"}
              fileSize={"-"}
              date={new Date(item.updated_at).toLocaleDateString()}
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
            label="Select File"
            variant="secondary"
            onPress={() => {}}
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
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  branding: {
    color: colors.primary,
    fontWeight: "800",
  },
  iconBtn: {
    padding: 8,
  },
  titleSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: 4,
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
