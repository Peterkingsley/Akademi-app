import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Animated, Alert } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowLeft, GraduationCap, Mic, Send, Pause, Play, Bot } from "lucide-react-native";
import { socketService } from "../../services/socket";
import { sessionService } from "../../services/session";

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
  "Can you simplify that?",
  "Give me an example",
  "Show me step by step",
  "Test me on this",
];

const WaveformBar = ({ index }: { index: number }) => {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: Math.random() * 20 + 5,
          duration: 400 + Math.random() * 300,
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 5,
          duration: 400 + Math.random() * 300,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        { height: anim, marginHorizontal: 2 }
      ]}
    />
  );
};

export const LiveTutorSessionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [timer, setTimer] = useState(0);
  const [sessionActive, setSessionActive] = useState(true);
  const [isAudioStreaming, setIsAudioStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadSession();
    setupWebSocket();
    const stopTimer = startTimer();
    return () => {
      stopTimer();
      socketService.disconnect();
    };
  }, []);

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

  const setupWebSocket = async () => {
    const socket = await socketService.connect();

    socket.emit("session:start", { sessionId });

    socket.on("message:typing", () => setIsTyping(true));

    socket.on("message:receive", (data: any) => {
      setIsTyping(false);
      const newMessage: Message = {
        id: data.messageId || Date.now().toString(),
        type: "ai",
        content: data.content,
        metadata: data.metadata,
      };
      setMessages((prev) => [...prev, newMessage]);
    });

    socket.on("audio:stream", () => setIsAudioStreaming(true));
    socket.on("audio:stop", () => setIsAudioStreaming(false));

    socket.on("session:paused", () => setIsPaused(true));
    socket.on("session:resumed", () => setIsPaused(false));

    socket.on("session:summary", (data: any) => {
      navigation.navigate("TutorSessionSummary", { sessionId, summary: data });
    });

    socket.on("session:ended", () => {
      setSessionActive(false);
      navigation.navigate("TutorSessionSummary", { sessionId });
    });

    socket.on("error", async (data: any) => {
      setIsTyping(false);
      console.error("Live Tutor socket error:", data);
      Alert.alert("Live Tutor", data?.message || "Something went wrong. Please try again.");
    });
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

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    const socket = socketService.getSocket();
    if (socket?.connected) {
      socketService.emit("message:send", { content: content.trim(), sessionId });
      return;
    }

    setIsTyping(true);
    try {
      const aiMessage = await sessionService.sendMessage(sessionId, { content: content.trim() });
      setMessages((prev) => [...prev, {
        id: aiMessage.id,
        type: "ai",
        content: aiMessage.content,
      }]);
    } catch (error) {
      console.error("Failed to send tutor message:", error);
      Alert.alert("Live Tutor", "I could not send that message. Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleEndSession = () => {
    socketService.emit("session:end", { sessionId });
  };

  const togglePause = () => {
    if (isPaused) {
      socketService.emit("session:resume", { sessionId });
    } else {
      socketService.emit("session:pause", { sessionId, position: 0 });
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <ArrowLeft size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, typography.h3]}>Live Tutor</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={[styles.timerText, typography.mono]}>{formatTimer(timer)}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={handleEndSession}>
        <Text style={[styles.endBtn, typography.bodySmall]}>End Session</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMessageContent = (message: Message) => {
    const parts = message.content.split(/(\*\*.*?\*\*)/g);

    return (
      <View>
        <Text style={[
          styles.messageText,
          { color: colors.textPrimary },
          message.type === "ai" ? { fontSize: 11.25, lineHeight: 24 } : {}
        ]}>
          {parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <Text key={i} style={{ fontWeight: "700" }}>{part.slice(2, -2)}</Text>;
            }
            return part;
          })}
        </Text>

        {message.metadata?.academicInsight && (
          <View style={styles.academicInsight}>
            <Text style={[styles.insightLabel, typography.mono]}>ACADEMIC INSIGHT</Text>
            <Text style={[styles.insightText, typography.bodySmall]}>{message.metadata.academicInsight}</Text>
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
    <Screen style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {renderHeader()}

        <View style={styles.contextPill}>
          <GraduationCap size={16} color={colors.primary} />
          <Text style={[styles.contextText, typography.mono]}>
            {sessionData?.course_code || "EEE 301"} • {sessionData?.topic?.toUpperCase() || "THEVENIN'S THEOREM"}
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
            <View style={styles.aiWrapper}>
               <View style={styles.aiAvatar}>
                  <Bot size={18} color={colors.textPrimary} />
               </View>
               <View style={styles.aiBubble}>
                 <Text style={{color: colors.textSecondary}}>AI is thinking...</Text>
               </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomSection}>
          {isAudioStreaming && (
            <View style={styles.audioControls}>
              <View style={styles.waveformContainer}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <WaveformBar key={i} index={i} />
                ))}
              </View>
              <TouchableOpacity style={styles.pauseBtn} onPress={togglePause}>
                {isPaused ? <Play size={20} color={colors.textPrimary} fill={colors.textPrimary} /> : <Pause size={20} color={colors.textPrimary} fill={colors.textPrimary} />}
              </TouchableOpacity>
            </View>
          )}

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
            <TouchableOpacity style={styles.iconBtn}>
              <Mic size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, typography.body]}
              placeholder="Ask Lumina anything..."
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
    paddingVertical: 12,
  },
  headerCenter: {
    alignItems: "center",
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
    marginTop: 8,
    marginBottom: 8,
  },
  contextText: {
    color: colors.textPrimary,
    marginLeft: 8,
    fontSize: 7.5,
    letterSpacing: 0.5,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 20,
    paddingBottom: 40,
  },
  messageWrapper: {
    flexDirection: "row",
    marginBottom: 20,
    maxWidth: "85%",
  },
  aiWrapper: {
    alignSelf: "flex-start",
    alignItems: "flex-end",
  },
  studentWrapper: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
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
    padding: 14,
    borderRadius: 12,
  },
  aiBubble: {
    backgroundColor: "#1E2D5E",
    borderBottomLeftRadius: 4,
  },
  studentBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 11.25,
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
  audioControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    height: 30,
    justifyContent: "center",
  },
  waveformBar: {
    width: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  pauseBtn: {
    backgroundColor: colors.surfaceElevated,
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
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
  iconBtn: {
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
});
