import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { X, Download, CheckCircle2, ClipboardList, Headphones, BookOpen } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { useNavigation, useRoute } from "@react-navigation/native";
import { sessionService, Message } from "../../services/session";
import { materialService, Material, offlineService } from "../../services/material";
import { SelectableText } from "../../components/ui/SelectableText";
import { AskAkademiModal } from "../../components/ui/AskAkademiModal";

export const StudyModeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId, materialId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [material, setMaterial] = useState<Material | null>(null);
  const [isAskModalVisible, setIsAskModalVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const courseCode = material?.course_code || "General";
  const hasExtractedContent = Boolean(content.trim()) && content !== "No text content available for this material.";
  const materialContext = material
    ? [
        `Material title: ${material.title}`,
        `Course: ${courseCode}`,
        `University: ${material.university}`,
        `Department: ${material.department}`,
        `Level: ${material.level}L`,
        material.content ? `Extracted text:\n${material.content}` : "Extracted text is not available yet.",
      ].join("\n")
    : content;

  useEffect(() => {
    const fetchContent = async () => {
      try {
        if (sessionId) {
          const messages = await sessionService.listMessages(sessionId);
          const aiMsg = [...messages].reverse().find((m: Message) => m.role === "AI");
          if (aiMsg) setContent(aiMsg.content);
        } else if (materialId) {
          const data = await materialService.getMaterialDetails(materialId);
          setMaterial(data);
          setContent(data.content || "No text content available for this material.");
          const downloaded = await offlineService.isDownloaded(materialId);
          setIsDownloaded(downloaded);
        }
      } catch (error) {
        console.error("Failed to fetch content:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [sessionId, materialId]);

  const handleAskAkademi = (text: string) => {
    setSelectedText(text || materialContext);
    setIsAskModalVisible(true);
  };

  const handleHighlight = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setHighlights((current) => current.includes(trimmed) ? current : [...current, trimmed]);
  };

  const handleDownload = async () => {
    if (!material) return;
    setDownloading(true);
    try {
      await offlineService.downloadMaterial(material);
      setIsDownloaded(true);
      Alert.alert("Success", "Material downloaded for offline use.");
    } catch (error) {
      console.error("Download failed:", error);
      Alert.alert("Error", "Failed to download material.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Screen style={styles.screen} hideHeader={true}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} hideHeader={true}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
          style={styles.headerBtn}
        >
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.h3]}>
          {material ? "Reading Material" : "Study Mode"}
        </Text>
        <View style={styles.headerRight}>
          {material && (
            <TouchableOpacity
              onPress={handleDownload}
              disabled={downloading || isDownloaded}
              style={styles.headerIconBtn}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : isDownloaded ? (
                <CheckCircle2 size={20} color={colors.success} />
              ) : (
                <Download size={20} color={colors.textPrimary} />
              )}
            </TouchableOpacity>
          )}
          <Badge label={material ? "Material" : "Study Reply"} variant="purple" />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {material && (
          <View style={styles.materialHeader}>
            <Text style={[styles.materialTitle, typography.h2]}>{material.title}</Text>
            <Text style={styles.materialMeta}>
              {[courseCode, material.university, `${material.level}L`].filter(Boolean).join(" · ")}
            </Text>
          </View>
        )}

        <Card style={styles.studyCard}>
          {!material && (
            <View style={styles.aiHeader}>
              <Avatar size={32} name="Scholar" />
              <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700", marginLeft: 12 }]}>
                Akademi AI Tutor
              </Text>
            </View>
          )}

          {material && !hasExtractedContent ? (
            <View style={styles.extractionPending}>
              <BookOpen size={24} color={colors.warning} style={styles.pendingIcon} />
              <Text style={styles.pendingTitle}>Text extraction is still pending</Text>
              <Text style={styles.pendingText}>
                You can still ask Akademi about this material using its title and course details while the uploaded file is being processed.
              </Text>
              <Button
                label="Ask Akademi"
                variant="secondary"
                onPress={() => handleAskAkademi(materialContext)}
                style={styles.pendingAskBtn}
              />
            </View>
          ) : (
            <SelectableText
              content={content || "No content available."}
              onAskAkademi={handleAskAkademi}
              onHighlight={handleHighlight}
            />
          )}
        </Card>

        {highlights.length > 0 && (
          <View style={styles.highlightSummary}>
            <Text style={[styles.highlightTitle, typography.bodySmall]}>
              {highlights.length} highlight{highlights.length === 1 ? "" : "s"} saved for this study session
            </Text>
            <Text style={[styles.highlightText, typography.caption]} numberOfLines={2}>
              {highlights[highlights.length - 1]}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.tutorBanner}
          onPress={() => navigation.navigate("LiveTutorEntry", {
            courseCode,
            topic: material?.title || courseCode,
            materialId: material?.id,
            materialTitle: material?.title,
            materialContext,
          })}
        >
          <View style={styles.tutorIcon}>
            <Headphones size={18} color={colors.primary} />
          </View>
          <View style={styles.tutorTextContainer}>
            <Text style={[styles.tutorText, typography.bodySmall]}>
              Still confused? Our scholars are online to help you 1-on-1.
            </Text>
            <Text style={styles.tutorLink}>Ask the Live Tutor</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.bottomBar}>
          {material && (
            <Button
              label="Practice CBT"
              icon={<ClipboardList size={18} color="#FFFFFF" />}
              onPress={() => navigation.navigate("MaterialPractice", { materialId: material.id, title: material.title })}
              style={styles.practiceBtn}
            />
          )}
          <Button
            label="Finish Study"
            onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
            style={styles.finishBtn}
          />
        </View>
      </ScrollView>

      <AskAkademiModal
        visible={isAskModalVisible}
        onClose={() => setIsAskModalVisible(false)}
        contextText={selectedText}
        courseCode={courseCode}
        materialTitle={material?.title}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerBtn: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  materialHeader: {
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  materialTitle: {
    color: colors.textPrimary,
    lineHeight: 27,
    marginBottom: 6,
  },
  materialMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  studyCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 20,
    padding: 18,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  aiName: {
    color: "#FFFFFF",
  },
  tutorBanner: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
    marginBottom: 28,
  },
  extractionPending: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  pendingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  pendingIcon: {
    marginBottom: 12,
  },
  pendingAskBtn: {
    marginTop: 16,
  },
  highlightSummary: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    marginTop: -12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primary + "55",
  },
  highlightTitle: {
    color: colors.primary,
    fontWeight: "700",
    marginBottom: 6,
  },
  highlightText: {
    color: colors.textSecondary,
    lineHeight: 16,
  },
  tutorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + "18",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  tutorTextContainer: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  tutorText: {
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  tutorLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "600",
  },
  bottomBar: {
    gap: 16,
  },
  backBtn: {
    flex: 1,
  },
  practiceBtn: {
    marginBottom: 12,
  },
  finishBtn: {
  },
});
