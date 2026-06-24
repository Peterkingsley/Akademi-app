import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { RichMathText } from "../../components/ui/RichMathText";
import { Screen } from "../../components/layout/Screen";
import { MainStackParamList } from "../../navigation/types";
import {
  Message,
  sessionService,
  StudyCompanionState,
  StudyRoadmapSection,
} from "../../services/session";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import {
  ArrowLeft,
  Mic,
  Route as RouteIcon,
  Send,
  Upload,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { ExpoSpeechRecognitionModule, isRecognitionAvailable } from "expo-speech-recognition";

type StudyCompanionRoute = RouteProp<MainStackParamList, "StudyCompanion">;
type StartMode = "beginning" | "continue" | "specific" | "roadmap";

const phaseLabels: Record<string, string> = {
  MATERIAL_SELECTION_REQUIRED: "Choose material",
  MATERIAL_SELECTED: "Material selected",
  ROADMAP_GENERATED: "Roadmap ready",
  TEACHING_PASS_1_BIG_PICTURE: "Teaching Pass 1",
  TEACHING_PASS_2_DETAILS: "Teaching Pass 2",
  TEACHING_PASS_3_CONNECTIONS: "Teaching Pass 3",
  TEACHBACK_1_REQUESTED: "Teach-Back 1",
  TEACHBACK_1_EVALUATION: "Reviewing Teach-Back 1",
  GAP_RETEACH: "Gap reteach",
  TEACHBACK_2_REQUESTED: "Teach-Back 2",
  TEACHBACK_2_EVALUATION: "Reviewing Teach-Back 2",
  MEMORY_DUMP_REQUESTED: "Memory dump",
  MEMORY_DUMP_EVALUATION: "Scoring memory dump",
  MASTERY_PASSED: "Mastery passed",
  MASTERY_FAILED: "Needs review",
  SECTION_COMPLETED: "Section complete",
  NEXT_SECTION_READY: "Next section ready",
  SESSION_COMPLETED: "Session complete",
};

const statusColors = {
  NOT_STARTED: "#52525B",
  IN_PROGRESS: "#3B82F6",
  NEEDS_REVIEW: "#F59E0B",
  MASTERED: "#22C55E",
} as const;

const roadmapBadgeText: Record<StudyRoadmapSection["status"], string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  NEEDS_REVIEW: "Needs review",
  MASTERED: "Mastered",
};

const looksMathHeavy = (content: string) =>
  /\\\(|\\\[|[$=^_∫∑√≤≥≈πμλθβαγωσ÷×]/.test(content);

export const StudyCompanionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<StudyCompanionRoute>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sessionId, materialTitle, courseCode } = route.params;

  const [sessionTitle, setSessionTitle] = useState(materialTitle);
  const [sessionCourseCode, setSessionCourseCode] = useState(courseCode);
  const [messages, setMessages] = useState<Message[]>([]);
  const [companionState, setCompanionState] = useState<StudyCompanionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [roadmapVisible, setRoadmapVisible] = useState(false);
  const [specificSection, setSpecificSection] = useState("");
  const [isListening, setIsListening] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const latestVoiceTranscriptRef = useRef("");
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldAutoSendVoiceRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [session, list, state] = await Promise.all([
        sessionService.getSession(sessionId),
        sessionService.listMessages(sessionId),
        sessionService.getCompanionState(sessionId),
      ]);
      setMessages(list);
      setCompanionState(state);
      setSessionTitle(session.material?.title || session.topic || materialTitle);
      setSessionCourseCode(session.material?.course_code || session.course_code || courseCode);
      const hasAIMessages = list.some((item) => item.role === "AI");
      setStartModalVisible(!hasAIMessages);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load AI Tutor session.");
    } finally {
      setLoading(false);
    }
  }, [courseCode, materialTitle, sessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  const phaseLabel = companionState ? phaseLabels[companionState.phase] || "Guided study" : "Guided study";

  const handleStart = useCallback(
    async (mode: StartMode, sectionTitle?: string) => {
      try {
        setSending(true);
        setError(null);
        const message = await sessionService.startCompanion(sessionId, {
          mode,
          section_title: sectionTitle,
        });
        setMessages((prev) => [...prev, message]);
        setStartModalVisible(false);
        setSpecificSection("");
        const state = await sessionService.getCompanionState(sessionId);
        setCompanionState(state);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Could not start the AI Tutor.");
      } finally {
        setSending(false);
      }
    },
    [sessionId],
  );

  const sendDraft = useCallback(async (draftContent?: string) => {
    const trimmed = (draftContent ?? input).trim();
    if (!trimmed || sending) return;

    const optimistic: Message = {
      id: `local-${Date.now()}`,
      session_id: sessionId,
      user_id: "me",
      role: "STUDENT",
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const aiMessage = await sessionService.sendCompanionMessage(sessionId, trimmed);
      setMessages((prev) => [...prev.filter((msg) => msg.id !== optimistic.id), aiMessage]);
      const state = await sessionService.getCompanionState(sessionId);
      setCompanionState(state);
    } catch (err: any) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setInput(trimmed);
      setError(err?.response?.data?.message || "Could not send that response.");
    } finally {
      setSending(false);
    }
  }, [input, sending, sessionId]);

  const handleToggleVoice = useCallback(async () => {
    try {
      if (isListening) {
        clearSilenceTimer();
        shouldAutoSendVoiceRef.current = Boolean(latestVoiceTranscriptRef.current.trim());
        ExpoSpeechRecognitionModule.stop();
        return;
      }

      if (!isRecognitionAvailable()) {
        setError("Live speech recognition is not available on this device.");
        return;
      }

      const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissions.granted) {
        setError("Microphone and speech recognition permissions are required for live voice replies.");
        return;
      }

      clearSilenceTimer();
      latestVoiceTranscriptRef.current = "";
      shouldAutoSendVoiceRef.current = false;
      setError(null);
      setIsListening(true);

      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
        },
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Voice input failed.");
      setIsListening(false);
    }
  }, [clearSilenceTimer, isListening]);

  useEffect(() => {
    const resultSub = ExpoSpeechRecognitionModule.addListener("result", (event: any) => {
      const transcript = event?.results?.[0]?.transcript?.trim() || "";
      if (!transcript) return;

      latestVoiceTranscriptRef.current = transcript;
      setInput(transcript);
      clearSilenceTimer();

      if (event?.isFinal) {
        shouldAutoSendVoiceRef.current = false;
        setIsListening(false);
        void sendDraft(transcript);
        return;
      }

      shouldAutoSendVoiceRef.current = true;
      silenceTimeoutRef.current = setTimeout(() => {
        ExpoSpeechRecognitionModule.stop();
      }, 3000);
    });

    const endSub = ExpoSpeechRecognitionModule.addListener("end", () => {
      clearSilenceTimer();
      setIsListening(false);
      if (shouldAutoSendVoiceRef.current && latestVoiceTranscriptRef.current.trim()) {
        const finalTranscript = latestVoiceTranscriptRef.current.trim();
        shouldAutoSendVoiceRef.current = false;
        void sendDraft(finalTranscript);
      }
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener("error", (event: any) => {
      clearSilenceTimer();
      setIsListening(false);
      shouldAutoSendVoiceRef.current = false;
      if (event?.error !== "aborted" && event?.error !== "no-speech") {
        setError(event?.message || "Live voice input failed.");
      }
    });

    return () => {
      clearSilenceTimer();
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, [clearSilenceTimer, sendDraft]);

  const handleUploadSolution = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setSending(true);
      setError(null);
      const response = await sessionService.sendPhotoMessage(sessionId, result.assets[0].uri);
      setMessages((prev) => [
        ...prev,
        {
          id: `local-photo-${Date.now()}`,
          session_id: sessionId,
          user_id: "me",
          role: "STUDENT",
          content: response.extractedText,
          created_at: new Date().toISOString(),
        },
        response.message,
      ]);
      const state = await sessionService.getCompanionState(sessionId);
      setCompanionState(state);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not upload the solution image.");
    } finally {
      setSending(false);
    }
  }, [sessionId]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isStudent = item.role === "STUDENT";
    const shouldUseMathRenderer = !isStudent && looksMathHeavy(item.content || "");
    return (
      <View style={[styles.messageRow, isStudent ? styles.messageRowStudent : styles.messageRowAi]}>
        <View style={[styles.messageBubble, isStudent ? styles.studentBubble : styles.aiBubble]}>
          {isStudent ? (
            <Text style={styles.studentText}>{item.content}</Text>
          ) : item.content && shouldUseMathRenderer ? (
            <RichMathText content={item.content} textColor={colors.textPrimary} fontSize={15} lineHeight={1.55} />
          ) : item.content ? (
            <Text style={styles.aiText}>{item.content}</Text>
          ) : (
            <Text style={styles.aiFallbackText}>...</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <Screen hideHeader style={styles.screen}>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.centerStateText}>Loading AI Tutor...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen hideHeader style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} activeOpacity={0.85}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle}>AI Tutor</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {sessionCourseCode || sessionTitle}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setRoadmapVisible(true)} style={styles.iconButton} activeOpacity={0.85}>
            <RouteIcon size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Ready to begin</Text>
              <Text style={styles.emptyText}>
                Tap the button below to begin your study session with Akademi.
              </Text>
              {!startModalVisible ? (
                <Button
                  title="Start Session"
                  onPress={() => setStartModalVisible(true)}
                  style={styles.emptyActionButton}
                />
              ) : null}
            </View>
          }
          ListFooterComponent={
            sending ? (
              <View style={styles.typingRow}>
                <View style={styles.typingBubble}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={styles.typingText}>Akademi is thinking...</Text>
                </View>
              </View>
            ) : null
          }
        />

        <View style={styles.composer}>
          <View style={styles.composerBox}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={isListening ? "Listening... pause for 3 seconds to send" : "Reply to Akademi"}
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />
            <View style={styles.composerStatusRow}>
              <Text style={styles.composerStatusText}>
                {isListening ? `Live voice active - ${phaseLabel}` : phaseLabel}
              </Text>
            </View>
            <View style={styles.composerActions}>
              <Pressable onPress={handleUploadSolution} style={styles.smallAction}>
                <Upload size={18} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={handleToggleVoice} style={[styles.smallAction, isListening ? styles.smallActionActive : null]}>
                <Mic size={18} color={isListening ? "#08130C" : colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => void sendDraft()} style={[styles.sendButton, !input.trim() || sending ? styles.sendButtonDisabled : null]}>
                <Send size={18} color="#08130C" />
              </Pressable>
            </View>
          </View>
        </View>

        <Modal transparent visible={startModalVisible} animationType="slide" statusBarTranslucent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Start AI Tutor</Text>
              <Text style={styles.modalText}>
                Choose how you want Akademi to begin this study session.
              </Text>
              <View style={styles.startOptions}>
                <Button title="Start from beginning" onPress={() => handleStart("beginning")} loading={sending} style={styles.startButton} />
                <Button title="Continue where I stopped" onPress={() => handleStart("continue")} loading={sending} variant="secondary" style={styles.startButton} />
                <Button title="Show roadmap first" onPress={() => handleStart("roadmap")} loading={sending} variant="outline" style={styles.startButton} />
              </View>
              <View style={styles.specificSectionBox}>
                <Text style={styles.specificLabel}>Start from a specific section</Text>
                <TextInput
                  value={specificSection}
                  onChangeText={setSpecificSection}
                  placeholder="Type section title"
                  placeholderTextColor={colors.textMuted}
                  style={styles.specificInput}
                />
                <Button
                  title="Start this section"
                  onPress={() => handleStart("specific", specificSection.trim())}
                  disabled={!specificSection.trim()}
                  variant="ghost"
                  style={styles.specificButton}
                />
              </View>
            </View>
          </View>
        </Modal>

        {roadmapVisible ? (
          <BottomSheet index={0} snapPoints={["60%", "88%"]} onClose={() => setRoadmapVisible(false)}>
            <View style={styles.roadmapSheet}>
              <Text style={styles.roadmapTitle}>Study roadmap</Text>
              <Text style={styles.roadmapSubtitle}>
                Follow section progress and jump back in with context.
              </Text>
              {(companionState?.roadmap || []).map((section, index) => (
                <View key={section.key} style={styles.roadmapItem}>
                  <View style={styles.roadmapItemHeader}>
                    <Text style={styles.roadmapItemTitle}>
                      {index + 1}. {section.title}
                    </Text>
                    <View style={[styles.roadmapBadge, { backgroundColor: statusColors[section.status] }]}>
                      <Text style={styles.roadmapBadgeText}>{roadmapBadgeText[section.status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.roadmapMeta}>
                    Pages {section.pageStart} - {section.pageEnd}
                  </Text>
                  <Text style={styles.roadmapPreview} numberOfLines={2}>
                    {section.content}
                  </Text>
                  <Button
                    title="Start here"
                    variant="ghost"
                    onPress={() => {
                      setRoadmapVisible(false);
                      setStartModalVisible(true);
                      setSpecificSection(section.title);
                    }}
                    style={styles.jumpButton}
                  />
                </View>
              ))}
              {!(companionState?.roadmap || []).length ? (
                <View style={styles.emptyRoadmap}>
                  <Text style={styles.emptyRoadmapText}>
                    Start the AI Tutor first and the roadmap will appear here.
                  </Text>
                </View>
              ) : null}
            </View>
          </BottomSheet>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
    },
    centerStateText: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 14,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 12,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerBody: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 12,
    },
    headerTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      fontSize: 22,
    },
    headerSubtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 2,
      fontSize: 11,
    },
    errorBanner: {
      marginHorizontal: 18,
      borderRadius: 8,
      backgroundColor: "rgba(239,68,68,0.12)",
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.24)",
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 10,
    },
    errorText: {
      ...typography.bodySmall,
      color: "#FCA5A5",
      fontSize: 11,
      lineHeight: 17,
    },
    chatContent: {
      paddingHorizontal: 18,
      paddingBottom: 16,
      gap: 10,
    },
    messageRow: {
      width: "100%",
      marginBottom: 12,
    },
    messageRowStudent: {
      alignItems: "flex-end",
    },
    messageRowAi: {
      alignItems: "flex-start",
    },
    messageBubble: {
      maxWidth: "88%",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    studentBubble: {
      backgroundColor: colors.primary,
      borderTopRightRadius: 4,
    },
    aiBubble: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopLeftRadius: 4,
      width: "88%",
      alignSelf: "flex-start",
    },
    aiText: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 22,
    },
    studentText: {
      ...typography.body,
      color: "#08130C",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
      paddingHorizontal: 30,
    },
    emptyTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      fontSize: 18,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
    },
    emptyActionButton: {
      marginTop: 24,
      minWidth: 180,
    },
    aiFallbackText: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
    typingRow: {
      alignItems: "flex-start",
      marginTop: 6,
    },
    typingBubble: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    typingText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
    },
    composer: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: Platform.OS === "ios" ? 20 : 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    composerBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    input: {
      ...typography.body,
      color: colors.textPrimary,
      minHeight: 44,
      maxHeight: 130,
      textAlignVertical: "top",
      fontSize: 14,
      padding: 0,
      marginBottom: 12,
    },
    composerStatusRow: {
      marginBottom: 10,
    },
    composerStatusText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
    },
    composerActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
    },
    smallAction: {
      width: 38,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceElevated,
    },
    smallActionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.68)",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingHorizontal: 20,
      paddingBottom: 24,
      zIndex: 999,
    },
    modalCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 18,
    },
    modalTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      fontSize: 20,
      marginBottom: 8,
    },
    modalText: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 16,
    },
    startOptions: {
      gap: 10,
    },
    startButton: {
      height: 52,
    },
    specificSectionBox: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    specificLabel: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      marginBottom: 10,
      textTransform: "uppercase",
    },
    specificInput: {
      ...typography.body,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
    },
    specificButton: {
      marginTop: 10,
      alignSelf: "flex-start",
      width: "auto",
      paddingHorizontal: 0,
      height: 34,
    },
    roadmapSheet: {
      paddingHorizontal: 18,
      paddingTop: 4,
    },
    roadmapTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      fontSize: 20,
      marginBottom: 6,
    },
    roadmapSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 16,
    },
    roadmapItem: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 14,
      marginBottom: 12,
    },
    roadmapItemHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 8,
    },
    roadmapItemTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 14,
      flex: 1,
    },
    roadmapBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    roadmapBadgeText: {
      ...typography.bodySmall,
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "700",
    },
    roadmapMeta: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      marginBottom: 6,
    },
    roadmapPreview: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    jumpButton: {
      marginTop: 10,
      alignSelf: "flex-start",
      width: "auto",
      height: 34,
    },
    emptyRoadmap: {
      paddingVertical: 28,
      alignItems: "center",
    },
    emptyRoadmapText: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: "center",
    },
  });
