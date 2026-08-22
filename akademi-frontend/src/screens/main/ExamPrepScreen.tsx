import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AxiosError } from "axios";
import { BookOpen, ChevronLeft, FileQuestion, Search } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import examPrepService, { ExamPrepMaterialItem } from "../../services/examPrep";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { MainStackParamList } from "../../navigation/types";

const requestMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ message?: string }>)?.response?.data?.message || fallback;

export const ExamPrepScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<MainStackParamList>>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [materials, setMaterials] = useState<ExamPrepMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadMaterials = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      setMaterials(await examPrepService.getMaterials());
    } catch (requestError: unknown) {
      setError(requestMessage(requestError, "Could not load Exam Prep materials."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadMaterials();
  }, [loadMaterials]));

  const filteredMaterials = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return materials;
    return materials.filter((material) =>
      material.title.toLowerCase().includes(normalized) || material.courseCode?.toLowerCase().includes(normalized),
    );
  }, [materials, query]);

  const startSession = async (material: ExamPrepMaterialItem) => {
    if (material.status === "UNAVAILABLE") return;
    try {
      setStartingId(material.id);
      setError(null);
      const session = await examPrepService.startGuidedSession(material.id);
      navigation.navigate("ExamPrepSession", { sessionId: session.id });
    } catch (requestError: unknown) {
      setError(requestMessage(requestError, "This study session could not be started yet."));
    } finally {
      setStartingId(null);
    }
  };

  return (
    <Screen hideHeader>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exam Prep</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void loadMaterials(true)} tintColor={colors.primary} />
      }>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><BookOpen size={28} color={colors.brand.foreground} /></View>
          <Text style={styles.heroTitle}>Learn through questions</Text>
          <Text style={styles.heroCopy}>
            Choose a material and Akademi will teach you one question at a time. Explain your thinking, then learn why every option fits—or does not.
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Search size={18} color={colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search materials or course codes" placeholderTextColor={colors.textMuted} style={styles.searchInput} autoCapitalize="none" accessibilityLabel="Search Exam Prep materials" />
        </View>

        <Text style={styles.sectionLabel}>CHOOSE A MATERIAL</Text>
        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Button label="Try again" variant="outline" onPress={() => void loadMaterials()} style={styles.retryButton} />
          </Card>
        ) : loading ? (
          <View style={styles.skeletons}>
            <Skeleton width="100%" height={150} borderRadius={14} />
            <Skeleton width="100%" height={150} borderRadius={14} />
          </View>
        ) : filteredMaterials.length === 0 ? (
          <View style={styles.emptyState}>
            <FileQuestion size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{query ? "No matching materials" : "No study materials yet"}</Text>
            <Text style={styles.emptyCopy}>{query ? "Try a different title or course code." : "Verified materials with usable study questions will appear here."}</Text>
          </View>
        ) : filteredMaterials.map((material) => {
          const unavailable = material.status === "UNAVAILABLE";
          const building = material.status === "BUILDING";
          return (
            <Card key={material.id} style={styles.materialCard}>
              <View style={styles.materialHeader}>
                <View style={styles.materialIcon}><FileQuestion size={22} color={colors.brand.foreground} /></View>
                <View style={styles.materialTitleWrap}>
                  <Text style={styles.materialTitle}>{material.title}</Text>
                  <Text style={styles.materialMeta}>{material.courseCode || "General"} · {material.questionCount} {material.questionCount === 1 ? "question" : "questions"}</Text>
                </View>
                <View style={[styles.statusBadge, building && styles.statusBuilding, unavailable && styles.statusUnavailable]}>
                  <Text style={[styles.statusText, building && styles.statusTextBuilding, unavailable && styles.statusTextUnavailable]}>{material.status === "READY" ? "READY" : building ? "PREPARING" : "UNAVAILABLE"}</Text>
                </View>
              </View>
              <Button label={building ? "Prepare questions" : unavailable ? "Questions unavailable" : "Start Exam Prep"} disabled={unavailable} loading={startingId === material.id} onPress={() => void startSession(material)} />
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSpacer: { width: 44 },
  content: { paddingBottom: 48, paddingHorizontal: 20 },
  hero: { alignItems: "center", paddingBottom: 26, paddingTop: 14 },
  heroIcon: { alignItems: "center", backgroundColor: colors.brand.subtle, borderRadius: 18, height: 58, justifyContent: "center", marginBottom: 16, width: 58 },
  heroTitle: { ...typography.h1, color: colors.textPrimary, marginBottom: 10, textAlign: "center" },
  heroCopy: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, maxWidth: 520, textAlign: "center" },
  searchBox: { alignItems: "center", backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: "row", marginBottom: 24, minHeight: 50, paddingHorizontal: 14 },
  searchInput: { color: colors.textPrimary, flex: 1, fontSize: 14, marginLeft: 10, paddingVertical: 10 },
  sectionLabel: { ...typography.mono, color: colors.textMuted, fontSize: 10, letterSpacing: 1.2, marginBottom: 12 },
  materialCard: { marginBottom: 14, padding: 16 },
  materialHeader: { alignItems: "center", flexDirection: "row", marginBottom: 16 },
  materialIcon: { alignItems: "center", backgroundColor: colors.brand.subtle, borderRadius: 11, height: 44, justifyContent: "center", width: 44 },
  materialTitleWrap: { flex: 1, marginHorizontal: 12 },
  materialTitle: { ...typography.h3, color: colors.textPrimary, fontSize: 15, lineHeight: 21, marginBottom: 5 },
  materialMeta: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11 },
  statusBadge: { backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border, borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 },
  statusBuilding: { backgroundColor: colors.status.warning.bg, borderColor: colors.status.warning.border },
  statusUnavailable: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
  statusText: { color: colors.status.success.fg, fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  statusTextBuilding: { color: colors.status.warning.fg },
  statusTextUnavailable: { color: colors.textMuted },
  errorCard: { borderColor: colors.status.error.border, marginBottom: 16 },
  errorText: { color: colors.status.error.fg, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  retryButton: { minHeight: 42 },
  skeletons: { gap: 14 },
  emptyState: { alignItems: "center", paddingHorizontal: 28, paddingTop: 52 },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: 8, marginTop: 18 },
  emptyCopy: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: "center" },
});
