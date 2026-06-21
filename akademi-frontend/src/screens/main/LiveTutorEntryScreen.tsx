import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BookOpen, ChevronRight, GraduationCap, RotateCcw, Sparkles } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { materialService, Material } from "../../services/material";
import { Session, sessionService } from "../../services/session";
import { useAuthStore } from "../../store/useAuthStore";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";

const getSessionTopic = (session: Session) => session.topic?.trim() || session.material?.title?.trim() || "AI tutor session";

const formatSessionTime = (session: Session) => {
  const raw = session.started_at || session.created_at;
  if (!raw) return "Recent";
  return new Date(raw).toLocaleDateString();
};

const dedupeMaterials = (items: Material[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export const LiveTutorEntryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params || {};
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [recentTutorSessions, setRecentTutorSessions] = useState<Session[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(params.materialId || null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTutorEntryState();
  }, [user?.department, user?.university]);

  const materialSessionMap = useMemo(() => {
    const map = new Map<string, Session>();
    recentTutorSessions.forEach((session) => {
      if (session.material_id && !map.has(session.material_id)) {
        map.set(session.material_id, session);
      }
    });
    return map;
  }, [recentTutorSessions]);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === selectedMaterialId) || null,
    [materials, selectedMaterialId],
  );

  const existingSessionForSelectedMaterial = selectedMaterialId
    ? materialSessionMap.get(selectedMaterialId) || null
    : null;

  const loadTutorEntryState = async () => {
    try {
      setLoading(true);
      setError(null);

      const [libraryMaterials, uploads, sessions] = await Promise.all([
        materialService.getMaterials({
          university: user?.university,
          department: user?.department,
        }),
        materialService.getMyUploads(),
        sessionService.getRecentSessions(50),
      ]);

      const tutorMaterials = dedupeMaterials(
        [...uploads, ...libraryMaterials].sort((a, b) => {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          return bTime - aTime;
        }),
      );

      const tutorSessions = sessions
        .filter((session) => session.session_type === "TUTOR" && !!session.material_id)
        .slice(0, 8);

      setMaterials(tutorMaterials);
      setRecentTutorSessions(tutorSessions);

      if (!selectedMaterialId && tutorMaterials[0]) {
        setSelectedMaterialId(tutorMaterials[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load tutor entry state:", err);
      setError(err?.response?.data?.message || "We could not load your tutor materials right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async () => {
    if (!selectedMaterial || starting) return;

    setStarting(true);
    try {
      const session = await sessionService.createSession({
        session_type: "TUTOR",
        course_code: selectedMaterial.course_code || "",
        material_id: selectedMaterial.id,
      });

      navigation.navigate("LiveTutorSession", { sessionId: session.id });
    } catch (error: any) {
      console.error("Could not open AI tutor session:", error);
      Alert.alert(
        "Could not open AI Tutor",
        error?.response?.data?.message || "Please try again in a moment.",
      );
    } finally {
      setStarting(false);
    }
  };

  const renderMaterialCard = (material: Material) => {
    const linkedSession = materialSessionMap.get(material.id);
    const selected = material.id === selectedMaterialId;

    return (
      <TouchableOpacity
        key={material.id}
        activeOpacity={0.84}
        style={[styles.materialCard, selected && styles.materialCardSelected]}
        onPress={() => setSelectedMaterialId(material.id)}
      >
        <View style={styles.materialTop}>
          <View style={styles.materialBadge}>
            <BookOpen size={16} color={selected ? colors.background : colors.primary} />
          </View>
          <View style={styles.materialCopy}>
            <Text style={[styles.materialTitle, typography.body]} numberOfLines={2}>
              {material.title}
            </Text>
            <Text style={[styles.materialMeta, typography.caption]}>
              {material.course_code || "General material"} · {material.verification_status === "VERIFIED" ? "Ready to teach" : "Your upload"}
            </Text>
          </View>
        </View>

        <View style={styles.materialFooter}>
          <Text style={[styles.materialFooterText, typography.bodySmall]}>
            {linkedSession ? "Resume existing tutor session" : "Start tutor from the beginning"}
          </Text>
          {linkedSession ? (
            <RotateCcw size={16} color={selected ? colors.background : colors.primary} />
          ) : (
            <ChevronRight size={16} color={selected ? colors.background : colors.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRecentSessions = () => {
    if (recentTutorSessions.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Sparkles size={16} color={colors.primary} />
          <Text style={[styles.sectionTitle, typography.h3]}>Recent material sessions</Text>
        </View>

        {recentTutorSessions.slice(0, 4).map((session) => (
          <TouchableOpacity
            key={session.id}
            activeOpacity={0.82}
            style={styles.sessionCard}
            onPress={() => navigation.navigate("LiveTutorSession", { sessionId: session.id })}
          >
            <View style={styles.sessionLeft}>
              <Text style={[styles.sessionCourse, typography.mono]}>
                {session.course_code || "MATERIAL"}
              </Text>
              <Text style={[styles.sessionTopic, typography.bodySmall]} numberOfLines={1}>
                {getSessionTopic(session)}
              </Text>
            </View>
            <View style={styles.sessionRight}>
              <Text style={[styles.sessionDate, typography.caption]}>{formatSessionTime(session)}</Text>
              <ChevronRight size={16} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyCard}>
      <GraduationCap size={28} color={colors.primary} />
      <Text style={[styles.emptyTitle, typography.h3]}>AI Tutor needs a material</Text>
      <Text style={[styles.emptyText, typography.bodySmall]}>
        Upload or access a material first. The tutor now teaches one material from beginning to end, so it does not open without a material.
      </Text>
      <Button
        label="Go to Library"
        onPress={() => navigation.navigate("MainTabs", { screen: "Library" })}
        style={styles.emptyButton}
      />
    </View>
  );

  return (
    <Screen hideHeader scrollable>
      <View style={styles.container}>
        <Text style={[styles.kicker, typography.mono]}>AI TUTOR</Text>
        <Text style={[styles.title, typography.h1]}>Study one material properly</Text>
        <Text style={[styles.subtitle, typography.bodySmall]}>
          Pick a material, then let Akademi teach it from the beginning, pause for feedback, and keep your progress in one continuous tutor session.
        </Text>

        {loading ? (
          <View style={styles.skeletonWrap}>
            <Skeleton height={140} width="100%" borderRadius={18} />
            <Skeleton height={92} width="100%" borderRadius={18} />
            <Skeleton height={92} width="100%" borderRadius={18} />
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={[styles.errorTitle, typography.h3]}>Tutor materials unavailable</Text>
            <Text style={[styles.errorText, typography.bodySmall]}>{error}</Text>
            <Button label="Try again" onPress={loadTutorEntryState} style={styles.retryButton} />
          </View>
        ) : materials.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, typography.h3]}>Choose a material</Text>
              <Text style={[styles.sectionSubtext, typography.bodySmall]}>
                One material gets one tutor session. Reopening the same material will resume that same lesson path.
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.materialRow}
              >
                {materials.map(renderMaterialCard)}
              </ScrollView>
            </View>

            {selectedMaterial && (
              <View style={styles.selectedSummary}>
                <Text style={[styles.selectedLabel, typography.mono]}>SELECTED MATERIAL</Text>
                <Text style={[styles.selectedTitle, typography.body]}>{selectedMaterial.title}</Text>
                <Text style={[styles.selectedMeta, typography.bodySmall]}>
                  {selectedMaterial.course_code || "General material"} · {existingSessionForSelectedMaterial ? "Resume where you stopped" : "Start from the beginning"}
                </Text>
              </View>
            )}

            {renderRecentSessions()}
          </>
        )}

        <Button
          label={
            existingSessionForSelectedMaterial
              ? "Resume AI Tutor"
              : "Start AI Tutor"
          }
          onPress={handleOpenSession}
          loading={starting}
          disabled={!selectedMaterial || loading || !!error || starting}
          style={styles.startButton}
        />
      </View>
    </Screen>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      padding: 24,
      paddingBottom: 32,
      gap: 18,
    },
    kicker: {
      color: colors.primary,
      letterSpacing: 0.8,
    },
    title: {
      color: colors.textPrimary,
      marginTop: -4,
    },
    subtitle: {
      color: colors.textSecondary,
      lineHeight: 22,
      marginTop: -8,
    },
    section: {
      gap: 10,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sectionTitle: {
      color: colors.textPrimary,
    },
    sectionSubtext: {
      color: colors.textSecondary,
    },
    materialRow: {
      gap: 12,
      paddingRight: 24,
    },
    materialCard: {
      width: 272,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 18,
    },
    materialCardSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}12`,
    },
    materialTop: {
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    materialBadge: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.primary}18`,
    },
    materialCopy: {
      flex: 1,
      gap: 6,
    },
    materialTitle: {
      color: colors.textPrimary,
      lineHeight: 22,
    },
    materialMeta: {
      color: colors.textSecondary,
    },
    materialFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    materialFooterText: {
      color: colors.primary,
      flex: 1,
    },
    selectedSummary: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 8,
    },
    selectedLabel: {
      color: colors.textMuted,
      letterSpacing: 0.8,
    },
    selectedTitle: {
      color: colors.textPrimary,
    },
    selectedMeta: {
      color: colors.textSecondary,
    },
    sessionCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sessionLeft: {
      flex: 1,
      gap: 4,
      paddingRight: 10,
    },
    sessionRight: {
      alignItems: "flex-end",
      gap: 6,
    },
    sessionCourse: {
      color: colors.primary,
    },
    sessionTopic: {
      color: colors.textPrimary,
    },
    sessionDate: {
      color: colors.textMuted,
    },
    emptyCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 24,
      alignItems: "flex-start",
      gap: 14,
    },
    emptyTitle: {
      color: colors.textPrimary,
    },
    emptyText: {
      color: colors.textSecondary,
      lineHeight: 22,
    },
    emptyButton: {
      width: "100%",
      marginTop: 4,
    },
    errorCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 22,
      gap: 10,
    },
    errorTitle: {
      color: colors.textPrimary,
    },
    errorText: {
      color: colors.textSecondary,
      lineHeight: 22,
    },
    retryButton: {
      marginTop: 6,
    },
    skeletonWrap: {
      gap: 14,
    },
    startButton: {
      marginTop: 4,
    },
  });
