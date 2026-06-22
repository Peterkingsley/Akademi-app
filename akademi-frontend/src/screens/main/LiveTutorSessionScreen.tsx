import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Monitor, ArrowLeft, GraduationCap, Send, Bot } from "lucide-react-native";
import { socketService } from "../../services/socket";
import { sessionService } from "../../services/session";
import { RichMathText } from "../../components/ui/RichMathText";
import { useVoiceComposer } from "../../hooks/useVoiceComposer";
import { appendTranscript } from "../../services/voice";
import { useAiVoicePlayback } from "../../hooks/useAiVoicePlayback";
import { VoiceInputButton } from "../../components/ui/VoiceInputButton";
import { AiVoiceToggleButton } from "../../components/ui/AiVoiceToggleButton";

interface Message {
  id: string;
  type: "ai" | "student";
  content: string;
  metadata?: {
    academicInsight?: string;
    codeBlock?: string;
  };
}

const QUICK_REPLIES = [
  "Start from the beginning again",
  "Go slower here",
  "Give me another example",
  "Test my understanding",
];

const normalizeMarkdownText = (value: string) =>
  value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

export const LiveTutorSessionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const endFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigatedToSummaryRef = useRef(false);
  const spokenMessageIdsRef = useRef<Set<string>>(new Set());
  const sessionCourse = sessionData?.course_code || "General";
  const sessionTopic = sessionData?.material?.title?.trim() || sessionData?.topic?.trim() || "AI tutor session";
  const sessionDuration = sessionData?.duration ? `${sessionData.duration} min` : "Open-ended";
  const { aiVoiceEnabled, toggleAiVoice, speakIfEnabled } = useAiVoicePlayback();
  const {
    isRecording,
    isTranscribing,
    toggleRecording,
  } = useVoiceComposer({
    onTranscript: (transcript) => setInputText((prev) => appendTranscript(prev, transcript)),
    recordingName: "live-tutor-voice.m4a",
    permissionMessage: "Allow microphone access so Akademi can capture your tutor reply.",
    stopErrorTitle: "Voice input failed",
  });

  useEffect(() => {
    loadSession();
    let cleanupSocket: (() => void) | undefined;
    setupWebSocket().then((cleanup) => {
      cleanupSocket = cleanup;
    });
    const stopTimer = startTimer();
    return () => {
      stopTimer();
      if (endFallbackRef.current) clearTimeout(endFallbackRef.current);
      cleanupSocket?.();
      socketService.disconnect();
    };
  }, [sessionId]);

  useEffect(() => {
    const latestAiMessage = [...messages].reverse().find((message) => message.type === "ai");
    if (!latestAiMessage) return;
    if (spokenMessageIdsRef.current.has(latestAiMessage.id)) return;
    spokenMessageIdsRef.current.add(latestAiMessage.id);
    speakIfEnabled(latestAiMessage.content).catch(() => undefined);
  }, [messages, speakIfEnabled]);

  const loadSession = async () => {
    try {
      const session = await sessionService.getSession(sessionId);
      setSessionData(session);
      const existingMessages = await sessionService.listMessages(sessionId);
      setMessages(existingMessages.map((message) => ({
        id: message.id,
        type: message.role === "AI" ? "ai" : "student",
        content: message.content,
      })));
    } catch (error) {
      console.error("Failed to load tutor session:", error);
    }
  };

  const upsertMessage = (message: Message) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message];
    });
  };

  const navigateToSummary = (summary?: any) => {
    if (hasNavigatedToSummaryRef.current) return;
    hasNavigatedToSummaryRef.current = true;
    if (endFallbackRef.current) {
      clearTimeout(endFallbackRef.current);
      endFallbackRef.current = null;
    }
    setIsEnding(false);
    navigation.navigate("TutorSessionSummary", { sessionId, summary });
  };

  const endSessionWithRestFallback = async () => {
    try {
      await sessionService.endSession(sessionId);
    } catch (error) {
      console.error("REST end session fallback failed:", error);
    }

    try {
      const summary = await sessionService.getSessionSummary(sessionId);
      navigateToSummary(summary);
    } catch (error) {
      console.error("Summary fallback failed:", error);
      navigateToSummary();
    }
  };

  const setupWebSocket = async () => {
    const socket = await socketService.connect();

    const joinSession = () => {
      setIsSocketConnected(true);
      socket.emit("session:start", { sessionId });
    };

    const handleDisconnect = () => {
      setIsSocketConnected(false);
      setIsTyping(false);
    };

    const handleTyping = () => setIsTyping(true);

    const handleReceive = (data: any) => {
      setIsTyping(false);
      upsertMessage({
        id: data.messageId || Date.now().toString(),
        type: "ai",
        content: data.content,
        metadata: data.metadata,
      });
    };

    const handleSummary = (data: any) => navigateToSummary(data?.summary || data);

    const handleEnded = () => navigateToSummary();

    const handleError = async (data: any) => {
      setIsTyping(false);
      setIsEnding(false);
      console.error("Live Tutor socket error:", data);
      const rawMessage = data?.message || "";
      const safeMessage =
        rawMessage.includes("Claude") ||
        rawMessage.includes("Gemini") ||
        rawMessage.includes("GoogleGenerativeAI") ||
        rawMessage.includes("AI providers failed") ||
        rawMessage.includes("503")
          ? "AI tutor is temporarily busy. Please try again in a moment."
          : rawMessage || "Something went wrong. Please try again.";
      Alert.alert("Live Tutor", safeMessage);
    };

    socket.off("connect", joinSession);
    socket.off("disconnect", handleDisconnect);
    socket.off("message:typing", handleTyping);
    socket.off("message:receive", handleReceive);
    socket.off("session:summary", handleSummary);
    socket.off("session:ended", handleEnded);
    socket.off("error", handleError);

    socket.on("connect", joinSession);
    socket.on("disconnect", handleDisconnect);
    socket.on("message:typing", handleTyping);
    socket.on("message:receive", handleReceive);
    socket.on("session:summary", handleSummary);
    socket.on("session:ended", handleEnded);
    socket.on("error", handleError);

    if (socket.connected) joinSession();

    return () => {
      socket.off("connect", joinSession);
      socket.off("disconnect", handleDisconnect);
      socket.off("message:typing", handleTyping);
      socket.off("message:receive", handleReceive);
      socket.off("session:summary", handleSummary);
      socket.off("session:ended", handleEnded);
      socket.off("error", handleError);
    };
  };

  const startTimer = () => {
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendMessage = async (text?: string) => {
    const content = text || inputText;
    if (!content.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: "student",
      content: content.trim(),
    };

    upsertMessage(newMessage);
    setInputText("");

    const socket = socketService.getSocket();
    if (socket?.connected) {
      socketService.emit("message:send", { content: content.trim(), sessionId });
      return;
    }

    setIsTyping(true);
    try {
      const aiMessage = await sessionService.sendMessage(sessionId, { content: content.trim() });
      upsertMessage({
        id: aiMessage.id,
        type: "ai",
        content: aiMessage.content,
      });
    } catch (error) {
      console.error("Failed to send tutor message:", error);
      Alert.alert("Live Tutor", "I could not send that message. Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleEndSession = () => {
    if (isEnding || hasNavigatedToSummaryRef.current) return;
    setIsEnding(true);

    const socket = socketService.getSocket();
    if (socket?.connected) {
      socketService.emit("session:end", { sessionId });
      endFallbackRef.current = setTimeout(endSessionWithRestFallback, 3500);
      return;
    }

    endSessionWithRestFallback();
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <ArrowLeft size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, typography.h3]}>AI Tutor</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, !isSocketConnected && styles.statusDotOffline]} />
          <Text style={[styles.timerText, typography.mono]}>
            {isSocketConnected ? formatTimer(timer) : "reconnecting"}
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity onPress={() => navigation.navigate("WhiteboardTutor", { sessionId })} style={{ marginRight: 12 }}>
          <Monitor size={22} color={colors.primary} />
        </TouchableOpacity>
        <AiVoiceToggleButton enabled={aiVoiceEnabled} onPress={toggleAiVoice} />
        <TouchableOpacity onPress={handleEndSession} disabled={isEnding}>
          <Text style={[styles.endBtn, typography.bodySmall]}>{isEnding ? "Ending..." : "End Session"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMessageContent = (message: Message) => {
    const content = normalizeMarkdownText(message.content);

    return (
      <View>
        <RichMathText
          content={content}
          textColor={colors.textPrimary}
          fontSize={13}
          lineHeight={message.type === "ai" ? 1.65 : 1.5}
        />

        {message.metadata?.academicInsight && (
          <View style={styles.academicInsight}>
            <Text style={[styles.insightLabel, typography.mono]}>ACADEMIC INSIGHT</Text>
            <RichMathText
              content={message.metadata.academicInsight}
              textColor={colors.textPrimary}
              fontSize={14}
              lineHeight={1.45}
            />
          </View>
        )}

        {message.metadata?.codeBlock && (
          <View style={styles.codeBlock}>
            <Text style={[styles.codeText, typography.mono]}>{message.metadata.codeBlock}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen hideHeader style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {renderHeader()}

        <View style={styles.contextPill}>
          <GraduationCap size={16} color={colors.primary} />
          <Text style={[styles.contextText, typography.mono]} numberOfLines={1}>
            {sessionCourse} - {sessionTopic} - {sessionDuration}
          </Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                message.type === "ai" ? styles.aiWrapper : styles.studentWrapper
              ]}
            >
              {message.type === "ai" && (
                <View style={styles.aiAvatar}>
                  <Bot size={18} color={colors.textPrimary} />
                </View>
              )}
              <View
                style={[
                  styles.messageBubble,
                  message.type === "ai" ? styles.aiBubble : styles.studentBubble
                ]}
              >
                {renderMessageContent(message)}
              </View>
            </View>
          ))}

          {isTyping && (
            <View style={[styles.messageWrapper, styles.aiWrapper]}>
               <View style={styles.aiAvatar}>
                  <Bot size={18} color={colors.textPrimary} />
               </View>
               <View style={[styles.messageBubble, styles.aiBubble]}>
                 <Text style={[styles.messageText, styles.aiMessageText, { color: colors.textSecondary }]}>AI is thinking...</Text>
               </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickReplies}>
            {QUICK_REPLIES.map((reply) => (
              <TouchableOpacity
                key={reply}
                style={styles.replyPill}
                onPress={() => handleSendMessage(reply)}
              >
                <Text style={[styles.replyText, typography.bodySmall]}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.inputBar}>
            <View style={styles.inputIcon}>
              <Bot size={22} color={colors.textSecondary} />
            </View>
            <TextInput
              style={[styles.input, typography.body]}
              placeholder="Ask Akademi anything..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSendMessage()}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: inputText.trim() ? colors.primary : colors.surfaceElevated }
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim()}
            >
              <Send size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <VoiceInputButton
              onPress={toggleRecording}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              style={styles.voiceButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 4,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  statusDotOffline: {
    backgroundColor: colors.warning,
  },
  timerText: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  endBtn: {
    color: colors.textSecondary,
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    marginHorizontal: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  contextText: {
    color: colors.textPrimary,
    marginLeft: 8,
    flex: 1,
    fontSize: 7.5,
    letterSpacing: 0.5,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
  },
  messageWrapper: {
    flexDirection: "row",
    marginBottom: 14,
  },
  aiWrapper: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
    maxWidth: "94%",
  },
  studentWrapper: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
    maxWidth: "78%",
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentPurple,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    flexShrink: 1,
  },
  aiBubble: {
    backgroundColor: "#1E2D5E",
    borderBottomLeftRadius: 4,
    maxWidth: "100%",
  },
  studentBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
    maxWidth: "100%",
  },
  messageText: {
    flexShrink: 1,
  },
  aiMessageText: {
    fontSize: 13,
    lineHeight: 24,
  },
  studentMessageText: {
    fontSize: 13,
    lineHeight: 21,
  },
  academicInsight: {
    backgroundColor: "#0F1F3D",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  insightLabel: {
    color: colors.primary,
    fontSize: 7.5,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  insightText: {
    color: colors.textPrimary,
  },
  codeBlock: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  codeText: {
    color: colors.textPrimary,
    fontSize: 9,
  },
  bottomSection: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    paddingTop: 10,
  },
  quickReplies: {
    marginBottom: 16,
  },
  replyPill: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
  },
  replyText: {
    color: colors.textSecondary,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  inputIcon: {
    padding: 8,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  voiceButton: {
    marginLeft: 8,
  },
});
