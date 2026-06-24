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
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react-native";
import Animated, { FadeInUp, Layout } from "react-native-reanimated";

import { Screen } from "../../components/layout/Screen";
import { CourseFilterTabs } from "../../components/ui/CourseFilterTabs";
import { Input } from "../../components/ui/Input";
import { MaterialCard } from "../../components/ui/MaterialCard";
import { Skeleton } from "../../components/ui/Skeleton";
import { materialService, Material } from "../../services/material";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

export const AITutorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    fetchMaterials();
  }, []);

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

  return (
    <Screen hideHeader style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>AI Tutor</Text>
            <Text style={styles.subtitle}>Choose a library material to start guided study</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Sparkles size={22} color={colors.primary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Study with Akademi</Text>
            <Text style={styles.heroText}>
              Select any verified material below. Akademi will guide you section by section and track mastery as you go.
            </Text>
          </View>
        </View>

        {isSearchActive ? (
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
        ) : null}

        <CourseFilterTabs
          courses={courses}
          selectedCourse={selectedCourse}
          onSelectCourse={setSelectedCourse}
          onSearchPress={() => setIsSearchActive(true)}
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <BookOpen size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>
                  {error
                    ? "AI Tutor unavailable"
                    : searchQuery || selectedCourse !== "All"
                      ? "No matching materials"
                      : "No verified materials yet"}
                </Text>
                <Text style={styles.emptyText}>
                  {error ||
                    (searchQuery || selectedCourse !== "All"
                      ? "Try another search or course filter."
                      : "Once materials are available in your library, you can start the AI Tutor from here.")}
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
    hero: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderColor: "rgba(34,197,94,0.24)",
      borderWidth: 1,
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(34,197,94,0.12)",
      marginRight: 12,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
    },
    heroTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      marginBottom: 6,
    },
    heroText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      lineHeight: 18,
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
      paddingTop: 12,
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
  });
