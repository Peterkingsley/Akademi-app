import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { useAuthStore } from "../../store/useAuthStore";
import { Settings, BookOpen, CheckCircle, AlertTriangle, Quote, Star } from "lucide-react-native";
import { sessionService, SessionSummary } from "../../services/session";
import { Skeleton } from "../../components/ui/Skeleton";

export const TutorSessionSummaryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId, summary: initialSummary } = route.params;
  const { user } = useAuthStore();

  const [summary, setSummary] = useState<SessionSummary | null>(initialSummary || null);
  const [loading, setLoading] = useState(!initialSummary);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const normalizedSummary = {
    topicsCovered: (summary as any)?.topicsCovered || summary?.key_points || [],
    conceptsMastered: (summary as any)?.conceptsMastered || [],
    areasToRevisit: (summary as any)?.areasToRevisit || summary?.next_steps?.map((step) => ({ name: step })) || [],
    bestQuestion: (summary as any)?.bestQuestion || null,
    aiInsight: (summary as any)?.aiInsight || summary?.summary || "",
  };

  useEffect(() => {
    if (!initialSummary) {
      fetchSummary();
    }
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await sessionService.getSessionSummary(sessionId);
      setSummary(data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToSessions = async () => {
    try {
      if (rating || feedback.trim()) {
        await sessionService.rateSession(sessionId, rating, feedback);
      }
    } catch (error) {
      console.warn("Session rating could not be saved yet:", error);
    } finally {
      navigation.navigate("MainTabs", { screen: "Home" });
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Avatar name={user?.name || "Student"} size={32} />
        <Text style={[styles.brandText, typography.h3]}>Akademi</Text>
      </View>
      <TouchableOpacity>
        <Settings size={24} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <Screen style={{ flex: 1 }}>
        <View style={styles.container}>
          {renderHeader()}
          <Skeleton height={100} width="100%" borderRadius={12} style={{ marginBottom: 20 }} />
          <Skeleton height={200} width="100%" borderRadius={12} style={{ marginBottom: 20 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ flex: 1 }} scrollable>
      <View style={styles.container}>
        {renderHeader()}

        <View style={styles.completionBanner}>
          <View style={styles.bannerText}>
            <Text style={[styles.completionTitle, typography.h2]}>Complete! 🎉</Text>
            <Text style={[styles.completionSubtitle, typography.bodySmall]}>
              You've covered {normalizedSummary.topicsCovered.length || 1} key topic in this session.
            </Text>
          </View>
          <BookOpen size={48} color={colors.primary} style={styles.bannerIcon} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <BookOpen size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, typography.h3]}>What you covered</Text>
          </View>
          <View style={styles.bulletList}>
            {normalizedSummary.topicsCovered.map((topic, index) => (
              <View key={index} style={styles.bulletItem}>
                <View style={styles.bullet} />
                <Text style={[styles.bulletText, typography.bodySmall]}>{topic}</Text>
              </View>
            ))}
            {normalizedSummary.topicsCovered.length === 0 && (
              <Text style={[styles.bulletText, typography.bodySmall]}>
                {summary?.summary || "This tutoring session has been saved."}
              </Text>
            )}
          </View>
        </View>

        {normalizedSummary.conceptsMastered.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <CheckCircle size={20} color={colors.success} />
              <Text style={[styles.cardTitle, typography.h3]}>Concepts mastered</Text>
            </View>
            {normalizedSummary.conceptsMastered.map((concept, index) => (
              <View key={index} style={styles.masteryRow}>
                <Text style={[styles.conceptName, typography.bodySmall]}>{concept.name}</Text>
                <Text style={[styles.masteryPercent, typography.bodySmall]}>{concept.mastery}%</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <AlertTriangle size={20} color={colors.warning} />
            <View>
              <Text style={[styles.cardTitle, typography.h3]}>Areas to revisit</Text>
              <Text style={[styles.cardSubtitle, typography.caption]}>AI detected slight hesitation</Text>
            </View>
          </View>
          {normalizedSummary.areasToRevisit.map((area, index) => (
            <View key={index} style={styles.revisitRow}>
              <Text style={[styles.revisitName, typography.bodySmall]}>{area.name}</Text>
              <TouchableOpacity style={styles.studyBtnPill}>
                <Text style={[styles.studyBtnText, typography.caption]}>STUDY THESE →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {normalizedSummary.bestQuestion && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Quote size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, typography.h3]}>Your questions</Text>
            </View>
            <View style={styles.quoteBlock}>
              <Text style={[styles.quoteText, typography.body]}>"{normalizedSummary.bestQuestion}"</Text>
            </View>
            <View style={styles.insightBox}>
               <Text style={[styles.insightLabel, typography.mono]}>AI TUTOR INSIGHT</Text>
               <Text style={[styles.insightText, typography.bodySmall]}>{normalizedSummary.aiInsight}</Text>
            </View>
          </View>
        )}

        <View style={styles.ratingSection}>
          <Text style={[styles.ratingTitle, typography.h3]}>How was this session?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)}>
                <Star
                  size={32}
                  color={s <= rating ? "#FBBF24" : colors.textMuted}
                  fill={s <= rating ? "#FBBF24" : "transparent"}
                />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.feedbackInput, typography.bodySmall]}
            placeholder="Any specific thoughts on today's lesson?"
            placeholderTextColor={colors.textMuted}
            value={feedback}
            onChangeText={setFeedback}
            multiline
          />
        </View>

        <View style={styles.footer}>
          <Button
            label="Save to Sessions"
            onPress={handleSaveToSessions}
            style={styles.footerBtn}
          />
          <Button
            label="Start Another Session"
            variant="secondary"
            onPress={() => navigation.navigate("LiveTutorEntry")}
            style={styles.footerBtn}
          />
          <TouchableOpacity onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}>
            <Text style={[styles.goHome, typography.body]}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandText: {
    marginLeft: 12,
    color: colors.primary,
    fontWeight: "700",
  },
  completionBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  bannerText: {
    flex: 1,
  },
  completionTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  completionSubtitle: {
    color: colors.textSecondary,
  },
  bannerIcon: {
    marginLeft: 16,
    opacity: 0.8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    color: colors.textPrimary,
    marginLeft: 10,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    marginLeft: 10,
    marginTop: 2,
  },
  bulletList: {
    paddingLeft: 4,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 10,
  },
  bulletText: {
    color: colors.textSecondary,
  },
  masteryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  conceptName: {
    color: colors.textPrimary,
  },
  masteryPercent: {
    color: colors.success,
    fontWeight: "600",
  },
  revisitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  revisitName: {
    color: colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  studyBtnPill: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  studyBtnText: {
    color: colors.warning,
    fontWeight: "700",
  },
  quoteBlock: {
    paddingHorizontal: 16,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    marginBottom: 16,
  },
  quoteText: {
    color: colors.textPrimary,
    fontStyle: "italic",
  },
  insightBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: 12,
  },
  insightLabel: {
    color: colors.textSecondary,
    fontSize: 7.5,
    marginBottom: 4,
  },
  insightText: {
    color: colors.textPrimary,
  },
  ratingSection: {
    marginTop: 16,
    alignItems: "center",
    marginBottom: 32,
  },
  ratingTitle: {
    color: colors.textPrimary,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  feedbackInput: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    alignItems: "center",
    paddingBottom: 40,
  },
  footerBtn: {
    width: "100%",
    marginBottom: 16,
  },
  goHome: {
    color: colors.textSecondary,
  },
});
