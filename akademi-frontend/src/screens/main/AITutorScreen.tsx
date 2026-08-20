import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Search } from "lucide-react-native";
import Animated, { FadeInUp, Layout } from "react-native-reanimated";

import { Screen } from "../../components/layout/Screen";
import { CourseFilterTabs } from "../../components/ui/CourseFilterTabs";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { materialService, Material } from "../../services/material";
import { sessionService } from "../../services/session";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

export const AITutorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const isTutorAdmin = Boolean(user?.admin_role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startingMaterialId, setStartingMaterialId] = useState<string | null>(null);

  const fetchMaterials = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await materialService.getMaterials({
        university: user?.university,
        department: user?.department,
      });
      setMaterials(data.filter((item) => item.verification_status === "VERIFIED"));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load AI Tutor materials.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isTutorAdmin) {
      setLoading(false);
      return;
    }

    void fetchMaterials();
  }, [isTutorAdmin]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMaterials();
  };

  const courses = useMemo(() => {
    const materialCourses = materials.map((material) => material.course_code || "General");
    return Array.from(new Set([...(user?.courses || []), ...materialCourses])).sort();
  }, [materials, user?.courses]);

  const filteredMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const seen = new Set<string>();

    return materials.filter((material) => {
      const courseCode = material.course_code || "General";
      const matchesCourse = selectedCourse === "All" || courseCode === selectedCourse;
      const matchesSearch =
        !query ||
        material.title.toLowerCase().includes(query) ||
        courseCode.toLowerCase().includes(query);
      if (!matchesCourse || !matchesSearch) return false;

      const materialKey = `${courseCode}:${material.title}`.trim().toLowerCase().replace(/\s+/g, " ");
      if (seen.has(materialKey)) return false;
      seen.add(materialKey);
      return true;
    });
  }, [materials, searchQuery, selectedCourse]);

  const openCompanion = async (item: Material) => {
    if (!isTutorAdmin) return;

    try {
      setStartingMaterialId(item.id);
      setError(null);
      const session = await sessionService.createSession({
        session_type: "STUDY",
        course_code: item.course_code || "General",
        material_id: item.id,
        topic: item.title,
        metadata: {
          mode: "ai-tutor",
        },
      });

      navigation.navigate("StudyCompanion", {
        sessionId: session.id,
        materialTitle: item.title,
        courseCode: item.course_code || "General",
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not open AI Tutor for this material.");
    } finally {
      setStartingMaterialId(null);
    }
  };

  if (!isTutorAdmin) {
    return (
      <Screen hideHeader style={styles.screen}>
        <View style={styles.restrictedContainer}>
          <View style={styles.restrictedIcon}>
            <BookOpen size={24} color={colors.primary} />
          </View>
          <Text style={styles.restrictedTitle}>AI Tutor is coming soon</Text>
          <Text style={styles.restrictedText}>
            Guided tutoring is still in testing and is not available to students yet.
          </Text>
          <TouchableOpacity
            style={styles.restrictedBackButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.restrictedBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen hideHeader style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Guided study</Text>
            <Text style={styles.subtitle}>Choose a material. Akademi teaches by asking, not telling.</Text>
          </View>
        </View>

        <Input
          label=""
          placeholder="Search materials"
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={19} color={colors.textMuted} />}
          enableVoiceInput={false}
          style={styles.searchInput}
        />

        <CourseFilterTabs
          courses={courses}
          selectedCourse={selectedCourse}
          onSelectCourse={setSelectedCourse}
          contentPaddingHorizontal={0}
        />

        {loading ? (
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
        ) : (
          <FlatList
            data={filteredMaterials}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              filteredMaterials.length === 0 && styles.emptyListContent,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInUp.delay(index * 45).duration(320)} layout={Layout.springify()}>
                <TouchableOpacity
                  activeOpacity={0.78}
                  disabled={startingMaterialId === item.id}
                  onPress={() => openCompanion(item)}
                  style={styles.materialRow}
                  accessibilityRole="button"
                  accessibilityLabel={`Start tutoring with ${item.title}`}
                >
                  <View style={styles.materialIcon}>
                    <BookOpen size={20} color={colors.primary} />
                  </View>
                  <View style={styles.materialCopy}>
                    <Text style={styles.materialTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.materialMetaRow}>
                      <Text style={styles.courseCode}>{item.course_code || "General"}</Text>
                      <View style={styles.metaDivider} />
                      <CheckCircle2 size={12} color={colors.primary} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                    <Text style={styles.updatedText}>
                      Updated {new Date(item.updated_at || item.created_at || Date.now()).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.startAction}>
                    <Text style={styles.startActionText}>{startingMaterialId === item.id ? "Starting" : "Start tutor"}</Text>
                    <ArrowRight size={15} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                  {error
                    ? "AI Tutor Unavailable"
                    : searchQuery || selectedCourse !== "All"
                      ? "No matching materials found"
                      : "No verified materials in library yet"}
                </Text>
                <Text style={styles.emptyText}>
                  {error ||
                    (searchQuery || selectedCourse !== "All"
                      ? "Try searching for a different course code or keyword."
                      : "Verified library materials will appear here so you can start a guided 1-on-1 AI Tutor session.")}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      flex: 1,
      paddingHorizontal: 18,
      paddingTop: 8,
    },
    restrictedContainer: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    restrictedIcon: {
      alignItems: "center",
      backgroundColor: colors.brand.subtle,
      borderRadius: 14,
      height: 52,
      justifyContent: "center",
      marginBottom: 16,
      width: 52,
    },
    restrictedTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      fontSize: 20,
      textAlign: "center",
    },
    restrictedText: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 22,
      marginTop: 8,
      maxWidth: 300,
      textAlign: "center",
    },
    restrictedBackButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: "center",
      marginTop: 24,
      minHeight: 44,
      paddingHorizontal: 18,
    },
    restrictedBackText: {
      ...typography.h4,
      color: colors.textPrimary,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
      fontSize: 22,
    },
    subtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    searchInput: {
      marginBottom: 0,
    },
    listContent: {
      paddingTop: 4,
      paddingBottom: 40,
    },
    emptyListContent: {
      flexGrow: 1,
    },
    skeletonContent: {
      paddingTop: 14,
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
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
      paddingTop: 30,
    },
    emptyIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 58,
      height: 58,
      borderRadius: 8,
      backgroundColor: "rgba(34,197,94,0.12)",
      marginBottom: 18,
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
    materialRow: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      marginBottom: 12,
      minHeight: 100,
      padding: 14,
    },
    materialIcon: {
      alignItems: "center",
      backgroundColor: colors.primary + "14",
      borderRadius: 12,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    materialCopy: {
      flex: 1,
      marginLeft: 12,
      marginRight: 10,
      minWidth: 0,
    },
    materialTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 20,
    },
    materialMetaRow: {
      alignItems: "center",
      flexDirection: "row",
      marginTop: 7,
    },
    courseCode: {
      ...typography.caption,
      color: colors.primary,
      fontSize: 10,
      fontWeight: "700",
    },
    metaDivider: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 3,
      marginHorizontal: 7,
      width: 3,
    },
    verifiedText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontSize: 10,
      marginLeft: 4,
    },
    updatedText: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 5,
    },
    startAction: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
    },
    startActionText: {
      ...typography.caption,
      color: colors.primary,
      fontSize: 11,
      fontWeight: "700",
    },
  });
