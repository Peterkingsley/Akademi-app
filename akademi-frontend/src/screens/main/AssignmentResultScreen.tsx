import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import { ArrowLeft, Share2, Bookmark, RefreshCw, Book } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { SelectableText } from "../../components/ui/SelectableText";
import { AskAkademiModal } from "../../components/ui/AskAkademiModal";
import { useNavigation, useRoute } from "@react-navigation/native";
import { sessionService, Message } from "../../services/session";

export const AssignmentResultScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isAskModalVisible, setIsAskModalVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    const fetchMessages = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      try {
        const messages = await sessionService.listMessages(sessionId);
        const studentMsg = messages.find((m: Message) => m.role === "STUDENT");
        const aiMsg = [...messages].reverse().find((m: Message) => m.role === "AI");

        if (studentMsg) setQuestion(studentMsg.content);
        if (aiMsg) setAnswer(aiMsg.content);
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [sessionId]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Akademi AI Answer:\n\nQuestion: ${question}\n\nAnswer: ${answer}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  if (loading) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <AskAkademiModal
        visible={isAskModalVisible}
        onClose={() => setIsAskModalVisible(false)}
        contextText={selectedText}
      />
    </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, typography.h3]}>Assignment Result</Text>
        </View>
        <Badge label="Direct Answer" variant="blue" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.inquiryCard}>
          <Text style={[styles.monoLabel, typography.mono]}>YOUR INQUIRY</Text>
          <SelectableText
            content={question || "No question found."}
            onAskAkademi={(text) => { setSelectedText(text); setIsAskModalVisible(true); }}
          />
        </Card>

        <Card style={styles.aiResponseCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiProfile}>
              <Avatar size={32} name="Akademi Synthesis" />
              <View style={styles.aiNameContainer}>
                <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700" }]}>Akademi Synthesis</Text>
                <Text style={[styles.aiModel, typography.caption]}>v2.4 Technical Model</Text>
              </View>
            </View>
          </View>

          <View style={styles.answerContainer}>
            <SelectableText
              content={answer || "Thinking..."}
              onAskAkademi={(text) => { setSelectedText(text); setIsAskModalVisible(true); }}
            />
          </View>
        </Card>

        <TouchableOpacity
          style={styles.studyModeBanner}
          onPress={() => navigation.navigate("StudyMode", { sessionId })}
        >
          <View style={styles.bannerLeft}>
            <Book size={24} color={colors.warning} />
            <View style={styles.bannerTextContainer}>
              <Text style={[styles.bannerTitle, typography.bodySmall, { fontWeight: "700" }]}>Want to truly understand this?</Text>
              <Text style={[styles.bannerSubtext, typography.caption]}>Switch to Study Mode for a step-by-step Socratic walkthrough.</Text>
            </View>
          </View>
          <Text style={styles.bannerArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Share2 size={20} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, typography.caption]}>SHARE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Bookmark size={20} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, typography.caption]}>SAVE</Text>
          </TouchableOpacity>
          <Button
            label="Try Another"
            onPress={() => navigation.navigate("Solve")}
            icon={<RefreshCw size={18} color="#FFFFFF" />}
            style={styles.tryAnotherBtn}
          />
        </View>
      </ScrollView>
      <AskAkademiModal
        visible={isAskModalVisible}
        onClose={() => setIsAskModalVisible(false)}
        contextText={selectedText}
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  inquiryCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: "transparent",
    marginBottom: 24,
    paddingVertical: 12,
  },
  monoLabel: {
    color: colors.textMuted,
    fontSize: 8.25,
    marginBottom: 8,
  },
  questionText: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  aiResponseCard: {
    backgroundColor: colors.surface,
    padding: 20,
    marginBottom: 24,
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  aiProfile: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiNameContainer: {
    marginLeft: 12,
  },
  aiName: {
    color: "#FFFFFF",
  },
  aiModel: {
    color: colors.textMuted,
  },
  answerContainer: {
    marginTop: 8,
  },
  explanation: {
    color: "#FFFFFF",
    lineHeight: 24,
  },
  studyModeBanner: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 32,
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  bannerTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  bannerTitle: {
    color: "#FFFFFF",
  },
  bannerSubtext: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  bannerArrow: {
    color: colors.primary,
    fontSize: 15,
    marginLeft: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actionBtn: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  actionLabel: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  tryAnotherBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
  },
});
