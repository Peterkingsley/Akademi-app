import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import { ArrowLeft, Share2, RefreshCw, Book, Send, ChevronRight, Download } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { SelectableText } from "../../components/ui/SelectableText";
import { AskAkademiModal } from "../../components/ui/AskAkademiModal";
import { RichMathText } from "../../components/ui/RichMathText";
import { GraphRenderer } from "../../components/graph/GraphRenderer";
import { GraphSpec } from "../../components/graph/types";
import { useNavigation, useRoute } from "@react-navigation/native";
import { sessionService, Message } from "../../services/session";
import { exportSolutionsAsPdf } from "../../services/pdfExport";
import { useVoiceComposer } from "../../hooks/useVoiceComposer";
import { appendTranscript } from "../../services/voice";
import { useAiVoicePlayback } from "../../hooks/useAiVoicePlayback";
import { VoiceInputButton } from "../../components/ui/VoiceInputButton";
import { AiVoiceToggleButton } from "../../components/ui/AiVoiceToggleButton";

export const AssignmentResultScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [graphSpec, setGraphSpec] = useState<GraphSpec | null>(null);
  const [replyMode, setReplyMode] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [initialAiMessageId, setInitialAiMessageId] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [isAskModalVisible, setIsAskModalVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [spokenKey, setSpokenKey] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { aiVoiceEnabled, toggleAiVoice, speakIfEnabled } = useAiVoicePlayback();
  const { isRecording, isTranscribing, toggleRecording } = useVoiceComposer({
    onTranscript: (transcript) => setFollowUp((prev) => appendTranscript(prev, transcript, true)),
    recordingName: "assignment-followup-voice.m4a",
    permissionMessage: "Allow microphone access so Akademi can capture your follow-up.",
    stopErrorTitle: "Voice input failed",
  });

  const modeLabels: Record<string, string> = {
    DIRECT: "Direct Answer",
    STUDY: "Study Reply",
    QUESTION: "Practice First",
    WRONGLY: "Find The Mistake",
  };

  const cleanMarkdown = (value?: string | null) => {
    if (!value) return "";

    return value
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .trim();
  };

  const loadSession = async () => {
    if (!sessionId) {
      setLoadFailed(true);
      setLoading(false);
      return;
    }

    try {
      const [session, sessionMessages] = await Promise.all([
        sessionService.getSession(sessionId),
        sessionService.listMessages(sessionId),
      ]);
      const studentMsg = sessionMessages.find((m: Message) => m.role === "STUDENT");
      const firstAiMsg = sessionMessages.find((m: Message) => m.role === "AI");
      const latestAiMsg = [...sessionMessages].reverse().find((m: Message) => m.role === "AI");

      setMessages(sessionMessages);
      setInitialAiMessageId(firstAiMsg?.id || null);
      setReplyMode(session.reply_mode || latestAiMsg?.reply_mode || firstAiMsg?.reply_mode || null);
      if (studentMsg) setQuestion(studentMsg.content);
      if (firstAiMsg) setAnswer(firstAiMsg.content);
      setGraphSpec(firstAiMsg?.metadata?.graph?.payload || null);
      setLoadFailed(false);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    const latestAiMessage = [...messages].reverse().find((message) => message.role === "AI");
    if (!latestAiMessage) return;
    const key = `${latestAiMessage.id}:${latestAiMessage.created_at}`;
    if (spokenKey === key) return;
    setSpokenKey(key);
    speakIfEnabled(latestAiMessage.content).catch(() => undefined);
  }, [messages, speakIfEnabled, spokenKey]);

  const handleFollowUp = async () => {
    const content = followUp.trim();
    if (!content || !sessionId || sendingFollowUp) return;

    setSendingFollowUp(true);
    try {
      setFollowUp("");
      await sessionService.sendMessage(sessionId, {
        content,
        reply_mode: (replyMode as any) || undefined,
      });
      await loadSession();
    } catch (error: any) {
      console.error("Failed to send follow-up:", error);
      setFollowUp(content);
      const tookTooLong = error?.code === "ECONNABORTED" || /timeout|network/i.test(error?.message || "");
      Alert.alert(
        "Could not send follow-up",
        tookTooLong
          ? "Akademi took too long to respond. Your reply is still here, so try again in a moment."
          : "Please check your connection and try again."
      );
    } finally {
      setSendingFollowUp(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Akademi AI Answer:\n\nQuestion: ${question}\n\nAnswer: ${answer}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf || !answer) return;

    setDownloadingPdf(true);
    try {
      await exportSolutionsAsPdf(
        [{ index: 0, question, answer }],
        { title: "Akademi Solution", subtitle: answerStatusLabel }
      );
    } catch (error: any) {
      Alert.alert(
        "Could not create PDF",
        error?.message || "Please check your connection and try again."
      );
    } finally {
      setDownloadingPdf(false);
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

  if (loadFailed) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.emptyTitle, typography.h3]}>Could not load this answer</Text>
          <Text style={[styles.emptyText, typography.bodySmall]}>
            Check your connection and try again. We will reopen this session once it loads.
          </Text>
          <Button label="Try again" onPress={loadSession} style={styles.retryButton} />
        </View>
      </Screen>
    );
  }

  const answerStatusLabel = modeLabels[replyMode || "DIRECT"] || "Akademi reply";
  const threadMessages = messages.filter((message) => message.id !== initialAiMessageId).slice(1);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, typography.h3]}>Assignment Result</Text>
        </View>
        <View style={styles.headerActions}>
          <Badge label={answerStatusLabel} variant="blue" />
          <AiVoiceToggleButton enabled={aiVoiceEnabled} onPress={toggleAiVoice} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.inquiryCard}>
          <Text style={[styles.monoLabel, typography.mono]}>YOUR INQUIRY</Text>
          <SelectableText
            content={question || "No question found."}
            onAskAkademi={(text) => {
              setSelectedText(text);
              setIsAskModalVisible(true);
            }}
          />
        </Card>

        <Card style={styles.aiResponseCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiProfile}>
              <Avatar size={32} name="Akademi Synthesis" />
              <View style={styles.aiNameContainer}>
                <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700" }]}>Akademi Synthesis</Text>
                <Text style={[styles.aiModel, typography.caption]}>{answerStatusLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.answerContainer}>
            <SelectableText
              content={answer || "Akademi is still preparing a reply."}
              onAskAkademi={(text) => {
                setSelectedText(text);
                setIsAskModalVisible(true);
              }}
            />
          </View>

          {graphSpec && (
            <View style={styles.graphContainer}>
              <GraphRenderer spec={graphSpec} />
            </View>
          )}
        </Card>

        {threadMessages.length > 0 && (
          <Card style={styles.threadCard}>
            <Text style={[styles.monoLabel, typography.mono]}>FOLLOW-UP THREAD</Text>
            {threadMessages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.threadRow,
                  message.role === "STUDENT" ? styles.studentRow : styles.aiRow,
                ]}
              >
                <View
                  style={[
                    styles.threadBubble,
                    message.role === "STUDENT" ? styles.studentBubble : styles.aiBubble,
                  ]}
                >
                  <Text style={[styles.threadRole, typography.caption]}>
                    {message.role === "STUDENT" ? "You" : "Akademi"}
                  </Text>
                  <RichMathText
                    content={cleanMarkdown(message.content)}
                    textColor={colors.textPrimary}
                    fontSize={14}
                    lineHeight={1.45}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        <Card style={styles.followUpCard}>
          <Text style={[styles.followUpTitle, typography.bodySmall, { fontWeight: "700" }]}>
            Continue this session
          </Text>
          <Text style={[styles.followUpHint, typography.caption]}>
            Ask for another example, ask for a slower explanation, or answer the question Akademi asked.
          </Text>
          <View style={styles.followUpRow}>
            <View style={styles.followUpInputWrap}>
              <TextInput
                value={followUp}
                onChangeText={setFollowUp}
                placeholder="Ask a follow-up..."
                placeholderTextColor={colors.textMuted}
                style={styles.followUpInput}
                multiline
              />
              <VoiceInputButton
                onPress={toggleRecording}
                isRecording={isRecording}
                isTranscribing={isTranscribing}
                style={styles.followUpVoiceButton}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, (!followUp.trim() || sendingFollowUp || isTranscribing) && styles.sendButtonDisabled]}
              onPress={handleFollowUp}
              disabled={!followUp.trim() || sendingFollowUp || isTranscribing}
            >
              {sendingFollowUp ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </Card>

        <TouchableOpacity
          style={styles.studyModeBanner}
          onPress={() => navigation.navigate("StudyMode", { sessionId })}
        >
          <View style={styles.bannerLeft}>
            <Book size={24} color={colors.warning} />
            <View style={styles.bannerTextContainer}>
              <Text style={[styles.bannerTitle, typography.bodySmall, { fontWeight: "700" }]}>
                Want to truly understand this?
              </Text>
              <Text style={[styles.bannerSubtext, typography.caption]}>
                Switch to Study Mode for a step-by-step learning walkthrough.
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Share2 size={20} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, typography.caption]}>SHARE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Download size={20} color={colors.textSecondary} />
            )}
            <Text style={[styles.actionLabel, typography.caption]}>PDF</Text>
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
    paddingHorizontal: 24,
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  aiResponseCard: {
    backgroundColor: colors.surface,
    padding: 20,
    marginBottom: 24,
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  graphContainer: {
    marginTop: 16,
  },
  threadCard: {
    backgroundColor: colors.surface,
    marginBottom: 24,
    padding: 16,
  },
  threadRow: {
    width: "100%",
    marginTop: 12,
  },
  studentRow: {
    alignItems: "flex-end",
  },
  aiRow: {
    alignItems: "flex-start",
  },
  threadBubble: {
    borderRadius: 12,
    padding: 12,
    width: "86%",
  },
  studentBubble: {
    backgroundColor: "rgba(34,197,94,0.18)",
    minWidth: "56%",
  },
  aiBubble: {
    backgroundColor: colors.surfaceElevated,
    minWidth: "62%",
  },
  threadRole: {
    color: colors.textMuted,
    marginBottom: 4,
  },
  threadText: {
    color: colors.textPrimary,
    lineHeight: 20,
  },
  followUpCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: 24,
    padding: 14,
  },
  followUpTitle: {
    color: colors.textPrimary,
  },
  followUpHint: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  followUpRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  followUpInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  followUpInput: {
    ...typography.bodySmall,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.textPrimary,
    flex: 1,
    maxHeight: 110,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  followUpVoiceButton: {
    marginBottom: 6,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  sendButtonDisabled: {
    opacity: 0.45,
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
  emptyTitle: {
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    marginBottom: 16,
    maxWidth: 280,
    textAlign: "center",
  },
  retryButton: {
    minWidth: 140,
  },
});
