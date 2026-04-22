import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { X, Book, CheckCircle2 } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { useNavigation, useRoute } from "@react-navigation/native";
import { sessionService, Message } from "../../services/session";

export const StudyModeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId, materialId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");

  useEffect(() => {
    const fetchContent = async () => {
      // Prioritize sessionId (AI discussion), fallback to materialId (static content)
      if (sessionId) {
        try {
          const messages = await sessionService.listMessages(sessionId);
          const aiMsg = [...messages].reverse().find((m: Message) => m.role === "AI");
          if (aiMsg) setContent(aiMsg.content);
        } catch (error) {
          console.error("Failed to fetch messages:", error);
        }
      } else if (materialId) {
        // Mock static content for materials if no sessionId is provided
        setContent("Static material content for ID: " + materialId);
      }
      setLoading(false);
    };

    fetchContent();
  }, [sessionId, materialId]);

  if (loading) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Home")} style={styles.headerBtn}>
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.h3]}>Study Mode</Text>
        <Badge label="Study Reply" variant="purple" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.studyCard}>
          <View style={styles.aiHeader}>
            <Avatar size={32} name="Scholar" />
            <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700", marginLeft: 12 }]}>
              Akademi AI Tutor
            </Text>
          </View>
          <Text style={[styles.studyText, typography.bodySmall]}>
            {content || "No explanation available."}
          </Text>
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
          <Button
            label="Back to Result"
            variant="ghost"
            onPress={() => sessionId ? navigation.navigate("AssignmentResult", { sessionId }) : navigation.goBack()}
            style={styles.backBtn}
          />
          <Button
            label="Finish Study"
            onPress={() => navigation.navigate("Home")}
            style={styles.finishBtn}
          />
        </View>
      </ScrollView>
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
    marginBottom: 32,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  studyCard: {
    backgroundColor: colors.surface,
    padding: 20,
    marginBottom: 24,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  aiName: {
    color: "#FFFFFF",
  },
  studyText: {
    color: "#FFFFFF",
    lineHeight: 24,
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
    flexDirection: "row",
    gap: 16,
  },
  backBtn: {
    flex: 1,
  },
  finishBtn: {
    flex: 2,
  },
});
