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
import { X, Download, CheckCircle2, ClipboardList } from "lucide-react-native";
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
  const [downloading, setDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

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
    setSelectedText(text);
    setIsAskModalVisible(true);
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
          <X size={24} color="#FFFFFF" />
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
                <Download size={20} color="#FFFFFF" />
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
            <Text style={[styles.materialMeta, typography.caption]}>
              {material.course_code} • {material.university}
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

          <SelectableText
            content={content || "No content available."}
            onAskAkademi={handleAskAkademi}
          />
        </Card>

        <TouchableOpacity style={styles.tutorBanner} onPress={() => navigation.navigate("LiveTutorEntry")}>
          <Avatar size={32} name="Scholar" />
          <View style={styles.tutorTextContainer}>
            <Text style={[styles.tutorText, typography.bodySmall]}>
              Still confused? Our scholars are online to help you 1-on-1.
            </Text>
            <Text style={[styles.tutorLink, typography.bodySmall]}>Ask the Live Tutor →</Text>
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
        courseCode={material?.course_code}
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
    marginBottom: 20,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    padding: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  materialHeader: {
    marginBottom: 20,
  },
  materialTitle: {
    color: "#FFFFFF",
    marginBottom: 4,
  },
  materialMeta: {
    color: colors.textSecondary,
  },
  studyCard: {
    backgroundColor: colors.surface,
    padding: 20,
    marginBottom: 24,
    borderRadius: 16,
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
    backgroundColor: colors.surfaceElevated,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 40,
  },
  tutorTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  tutorText: {
    color: "#FFFFFF",
    lineHeight: 20,
    marginBottom: 4,
  },
  tutorLink: {
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
