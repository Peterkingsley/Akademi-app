import React, { useEffect, useState, useRef } from "react";
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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ArrowLeft, Share2, Book, Send, Sparkles } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { SelectableText } from "../../components/ui/SelectableText";
import { AskAkademiModal } from "../../components/ui/AskAkademiModal";
import { RichMathText } from "../../components/ui/RichMathText";
import { GraphRenderer } from "../../components/graph/GraphRenderer";
import { GraphSpec } from "../../components/graph/types";
import { useNavigation, useRoute } from "@react-navigation/native";
import { sessionService, Message } from "../../services/session";
import { useVoiceComposer } from "../../hooks/useVoiceComposer";
import { appendTranscript } from "../../services/voice";
import { useAiVoicePlayback } from "../../hooks/useAiVoicePlayback";
import { VoiceInputButton } from "../../components/ui/VoiceInputButton";
import { AiVoiceToggleButton } from "../../components/ui/AiVoiceToggleButton";
import { AnimatedPressable } from "../../components/ui/AnimatedPressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

export const AssignmentResultScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params || {};
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const scrollViewRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [graphSpec, setGraphSpec] = useState<GraphSpec | null>(null);
  const [replyMode, setReplyMode] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [initialAiMessageId, setInitialAiMessageId] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [isAskModalVisible, setIsAskModalVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [spokenKey, setSpokenKey] = useState<string | null>(null);

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
      const firstAiMsg = sessionMessages.find((m: Message) => m.role === "AI");
      const latestAiMsg = [...sessionMessages].reverse().find((m: Message) => m.role === "AI");

      setMessages(sessionMessages);
      setInitialAiMessageId(firstAiMsg?.id || null);
      setReplyMode(session.reply_mode || latestAiMsg?.reply_mode || firstAiMsg?.reply_mode || null);
      setGraphSpec(firstAiMsg?.metadata?.graph?.payload || null);
      setLoadFailed(false);
      
      // Auto scroll to bottom if loading new messages
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300);
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
    const optimisticMsg: Message = {
      id: Date.now().toString(),
      session_id: sessionId,
      user_id: "temp",
      role: "STUDENT",
      content,
      created_at: new Date().toISOString()
    };

    try {
      setFollowUp("");
      // Optimistic update
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

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
      // Remove optimistic
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    } finally {
      setSendingFollowUp(false);
    }
  };

  const handleShare = async () => {
    try {
      const q = messages.find(m => m.role === "STUDENT")?.content || "";
      const a = messages.find(m => m.role === "AI")?.content || "";
      await Share.share({
        message: `Akademi AI Answer:\n\nQuestion: ${q}\n\nAnswer: ${a}`,
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
        <AskAkademiModal visible={isAskModalVisible} onClose={() => setIsAskModalVisible(false)} contextText={selectedText} />
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

  return (
    <Screen style={styles.screen} hideHeader>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* FROSTED GLASS HEADER */}
        <BlurView 
          intensity={80} 
          tint={isDark ? "dark" : "light"} 
          style={[styles.headerBlur, { paddingTop: Math.max(insets.top, 16) }]}
        >
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={24} color={colors.textPrimary} />
              </AnimatedPressable>
              <Text style={[styles.headerTitle, typography.h3]}>Result</Text>
            </View>
            <View style={styles.headerActions}>
              <AiVoiceToggleButton enabled={aiVoiceEnabled} onPress={toggleAiVoice} />
              <AnimatedPressable onPress={handleShare} style={styles.shareBtn}>
                <Share2 size={20} color={colors.textSecondary} />
              </AnimatedPressable>
            </View>
          </View>
        </BlurView>

        {/* CHAT STREAM */}
        <ScrollView 
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 70, paddingBottom: 100 }]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message, index) => {
            const isStudent = message.role === "STUDENT";
            const isFirstAI = !isStudent && message.id === initialAiMessageId;

            return (
              <View key={message.id || index.toString()} style={[styles.messageRow, isStudent ? styles.rowStudent : styles.rowAi]}>
                {!isStudent && (
                  <View style={styles.avatarWrap}>
                     <Avatar size={32} name="Akademi Synthesis" />
                  </View>
                )}
                
                <View style={[styles.bubble, isStudent ? styles.bubbleStudent : styles.bubbleAi]}>
                  {isFirstAI && (
                    <View style={styles.aiHeader}>
                      <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700" }]}>Akademi</Text>
                      <Badge label={answerStatusLabel} variant="blue" />
                    </View>
                  )}

                  {isFirstAI ? (
                    <SelectableText
                      content={message.content}
                      onAskAkademi={(text) => {
                        setSelectedText(text);
                        setIsAskModalVisible(true);
                      }}
                    />
                  ) : (
                    <RichMathText
                      content={cleanMarkdown(message.content)}
                      textColor={isStudent ? "#FFFFFF" : colors.textPrimary}
                      fontSize={15}
                      lineHeight={1.5}
                    />
                  )}

                  {isFirstAI && graphSpec && (
                    <View style={styles.graphContainer}>
                      <GraphRenderer spec={graphSpec} />
                    </View>
                  )}
                </View>

                {/* SMART CHIP FOR STUDY MODE */}
                {isFirstAI && replyMode !== "STUDY" && (
                  <AnimatedPressable 
                    style={styles.studyChip}
                    onPress={() => navigation.navigate("StudyMode", { sessionId })}
                  >
                    <Sparkles size={14} color={colors.primary} />
                    <Text style={[styles.studyChipText, typography.caption]}>Switch to Step-by-Step Study Mode</Text>
                  </AnimatedPressable>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* FLOATING COMPOSER */}
        <BlurView 
          intensity={90} 
          tint={isDark ? "dark" : "light"} 
          style={[styles.composerBlur, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.composerInner}>
             <TextInput
               value={followUp}
               onChangeText={setFollowUp}
               placeholder={isRecording ? "Listening..." : "Ask a follow-up..."}
               placeholderTextColor={colors.textMuted}
               style={styles.composerInput}
               multiline
             />
             <View style={styles.composerActions}>
               <VoiceInputButton
                 onPress={toggleRecording}
                 isRecording={isRecording}
                 isTranscribing={isTranscribing}
                 style={styles.composerVoiceBtn}
               />
               <AnimatedPressable
                 style={[styles.sendButton, (!followUp.trim() || sendingFollowUp || isTranscribing) && styles.sendButtonDisabled]}
                 onPress={handleFollowUp}
                 disabled={!followUp.trim() || sendingFollowUp || isTranscribing}
               >
                 {sendingFollowUp ? (
                   <ActivityIndicator size="small" color="#FFFFFF" />
                 ) : (
                   <Send size={16} color="#FFFFFF" />
                 )}
               </AnimatedPressable>
             </View>
          </View>
        </BlurView>

      </KeyboardAvoidingView>
      <AskAkademiModal visible={isAskModalVisible} onClose={() => setIsAskModalVisible(false)} contextText={selectedText} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  headerBlur: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  shareBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  messageRow: {
    width: "100%",
    marginBottom: 24,
  },
  rowStudent: {
    alignItems: "flex-end",
  },
  rowAi: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  avatarWrap: {
    marginRight: 12,
    marginTop: 4,
  },
  bubble: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    width: "88%",
  },
  bubbleStudent: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
    borderBottomRightRadius: 6,
  },
  bubbleAi: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 6,
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  aiName: {
    color: colors.textPrimary,
  },
  graphContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  studyChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(34,197,94,0.1)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    marginLeft: 44, 
    gap: 6,
  },
  studyChipText: {
    color: colors.primary,
    fontWeight: "600",
  },
  composerBlur: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  composerInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  composerInput: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    maxHeight: 120,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 2,
  },
  composerVoiceBtn: {
    marginRight: 2,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sendButtonDisabled: {
    opacity: 0.5,
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
