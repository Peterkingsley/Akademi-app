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
import { ArrowLeft, Mic, MicOff, Route as RouteIcon, Send, Upload } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { Screen } from "../../components/layout/Screen";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { RichMathText } from "../../components/ui/RichMathText";
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
  addLiveRecognitionListener,
  estimateSpeechDurationMs,
  getLiveRecognitionAvailability,
  requestLiveRecognitionPermission,
  speakAiText,
  startLiveRecognition,
  stopAiSpeech,
  stopLiveRecognition,
} from "../../services/voice";

type StudyCompanionRoute = RouteProp<MainStackParamList, "StudyCompanion">;
type StartMode = "beginning" | "continue" | "specific" | "roadmap";
type TutorRuntimeState = "idle" | "ai_speaking" | "listening" | "student_speaking" | "thinking" | "muted";
type UiMessage = Message & { displayContent: string; interrupted?: boolean };

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

const toUiMessage = (message: Message): UiMessage => ({
  ...message,
  displayContent: message.content,
});

export const StudyCompanionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<StudyCompanionRoute>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sessionId, materialTitle, courseCode } = route.params;

  const [sessionTitle, setSessionTitle] = useState(materialTitle);
  const [sessionCourseCode, setSessionCourseCode] = useState(courseCode);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [companionState, setCompanionState] = useState<StudyCompanionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [runtimeState, setRuntimeState] = useState<TutorRuntimeState>("idle");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [roadmapVisible, setRoadmapVisible] = useState(false);
  const [specificSection, setSpecificSection] = useState("");
  const [micMuted, setMicMuted] = useState(false);
  const [liveRecognitionAvailable] = useState(() => getLiveRecognitionAvailability());
  const [liveRecognitionReady, setLiveRecognitionReady] = useState(false);
  const [recognitionTranscript, setRecognitionTranscript] = useState("");

  const listRef = useRef<FlatList<UiMessage>>(null);
  const runtimeStateRef = useRef<TutorRuntimeState>("idle");
  const micMutedRef = useRef(false);
  const currentAiMessageIdRef = useRef<string | null>(null);
  const playbackTokenRef = useRef(0);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionActiveRef = useRef(false);
  const pendingAutoContinueRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const interruptingRef = useRef(false);
  const latestTranscriptRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedContinueRef = useRef<Message | null>(null);
  const continuePrefetchPromiseRef = useRef<Promise<Message | null> | null>(null);
  const continuePrefetchTokenRef = useRef(0);

  const setTutorState = useCallback((state: TutorRuntimeState) => {
    runtimeStateRef.current = state;
    setRuntimeState(state);
  }, []);

  const cancelRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopPlaybackNow = useCallback(async () => {
    playbackTokenRef.current += 1;
    pendingAutoContinueRef.current = false;
    continuePrefetchTokenRef.current += 1;
    prefetchedContinueRef.current = null;
    continuePrefetchPromiseRef.current = null;
    cancelRevealTimer();
    await stopAiSpeech();
  }, [cancelRevealTimer]);

  const refreshCompanionState = useCallback(async () => {
    const state = await sessionService.getCompanionState(sessionId);
    setCompanionState(state);
  }, [sessionId]);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [session, list, state] = await Promise.all([
        sessionService.getSession(sessionId),
        sessionService.listMessages(sessionId),
        sessionService.getCompanionState(sessionId),
      ]);
      setMessages(list.map(toUiMessage));
      setCompanionState(state);
      setSessionTitle(session.material?.title || session.topic || materialTitle);
      setSessionCourseCode(session.material?.course_code || session.course_code || courseCode);
      setStartModalVisible(!list.some((item) => item.role === "AI"));
      setTutorState(micMutedRef.current ? "muted" : "idle");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load AI Tutor session.");
    } finally {
      setLoading(false);
    }
  }, [courseCode, materialTitle, sessionId, setTutorState]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    runtimeStateRef.current = runtimeState;
  }, [runtimeState]);

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages]);

  const startListening = useCallback(async () => {
    if (!liveRecognitionAvailable || micMutedRef.current || recognitionActiveRef.current) {
      return;
    }
    if (runtimeStateRef.current === "thinking") {
      return;
    }
    await startLiveRecognition();
    recognitionActiveRef.current = true;
    setTutorState("listening");
  }, [liveRecognitionAvailable, setTutorState]);

  const stopListening = useCallback(async () => {
    if (!recognitionActiveRef.current) return;
    recognitionActiveRef.current = false;
    await stopLiveRecognition();
  }, []);

  const finalizeAiMessage = useCallback((messageId: string, fullContent: string) => {
    setMessages((prev) =>
      prev.map((item) =>
        item.id === messageId
          ? {
              ...item,
              displayContent: fullContent,
            }
          : item,
      ),
    );
  }, []);

  const appendStudentMessage = useCallback((content: string) => {
    const studentMessage: UiMessage = {
      id: `student-${Date.now()}`,
      session_id: sessionId,
      user_id: "me",
      role: "STUDENT",
      content,
      displayContent: content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, studentMessage]);
  }, [sessionId]);

  const beginAutoContinuePrefetch = useCallback((message: Message) => {
    const metadata = message.metadata;
    if (!metadata) return null;
    if (metadata.waitForStudent) {
      pendingAutoContinueRef.current = false;
      continuePrefetchTokenRef.current += 1;
      prefetchedContinueRef.current = null;
      continuePrefetchPromiseRef.current = null;
      return null;
    }

    if (metadata.autoContinue) {
      pendingAutoContinueRef.current = true;
      const token = continuePrefetchTokenRef.current + 1;
      continuePrefetchTokenRef.current = token;
      prefetchedContinueRef.current = null;
      const prefetchPromise = sessionService
        .sendCompanionTurn(sessionId, {
          action: "tutor:continue",
        })
        .then(async (nextMessage) => {
          await refreshCompanionState();
          if (continuePrefetchTokenRef.current !== token) {
            return null;
          }
          prefetchedContinueRef.current = nextMessage;
          return nextMessage;
        })
        .catch((err: any) => {
          if (continuePrefetchTokenRef.current === token) {
            setError(err?.response?.data?.message || "Could not continue the tutor flow.");
          }
          return null;
        });
      continuePrefetchPromiseRef.current = prefetchPromise;
      return prefetchPromise;
    }

    return null;
  }, [refreshCompanionState, sessionId]);

  const resolveAutoContinueAfterSpeech = useCallback(async (message: Message) => {
    const metadata = message.metadata;
    if (!metadata) return null;

    if (metadata.waitForStudent) {
      pendingAutoContinueRef.current = false;
      continuePrefetchTokenRef.current += 1;
      prefetchedContinueRef.current = null;
      continuePrefetchPromiseRef.current = null;
      if (micMutedRef.current) {
        setTutorState("muted");
      } else if (liveRecognitionAvailable) {
        await startListening();
      } else {
        setTutorState("idle");
      }
      return null;
    }

    if (!metadata.autoContinue) {
      pendingAutoContinueRef.current = false;
      continuePrefetchTokenRef.current += 1;
      prefetchedContinueRef.current = null;
      continuePrefetchPromiseRef.current = null;
      setTutorState(micMutedRef.current ? "muted" : "idle");
      return null;
    }

    if (prefetchedContinueRef.current) {
      const prefetched = prefetchedContinueRef.current;
      prefetchedContinueRef.current = null;
      continuePrefetchPromiseRef.current = null;
      pendingAutoContinueRef.current = false;
      return prefetched;
    }

    setTutorState("thinking");
    const awaitedMessage = continuePrefetchPromiseRef.current
      ? await continuePrefetchPromiseRef.current
      : null;
    continuePrefetchPromiseRef.current = null;
    prefetchedContinueRef.current = null;
    pendingAutoContinueRef.current = false;
    if (!awaitedMessage) {
      setTutorState(micMutedRef.current ? "muted" : "idle");
    }
    return awaitedMessage;
  }, [liveRecognitionAvailable, setTutorState, startListening]);

  const playAiTurn = useCallback(async (message: Message) => {
    const token = playbackTokenRef.current + 1;
    playbackTokenRef.current = token;
    currentAiMessageIdRef.current = message.id;
    cancelRevealTimer();
    setRecognitionTranscript("");
    setTutorState("ai_speaking");

    const fullContent = message.content || "";
    const words = fullContent.split(/\s+/).filter(Boolean);
    if (words.length) {
      const durationMs = estimateSpeechDurationMs(fullContent);
      const stepMs = Math.max(45, Math.floor(durationMs / words.length));
      let visibleCount = 0;
      revealTimerRef.current = setInterval(() => {
        if (playbackTokenRef.current !== token || currentAiMessageIdRef.current !== message.id) {
          cancelRevealTimer();
          return;
        }
        visibleCount = Math.min(words.length, visibleCount + 1);
        const displayContent = words.slice(0, visibleCount).join(" ");
        setMessages((prev) =>
          prev.map((item) => (item.id === message.id ? { ...item, displayContent } : item)),
        );
        if (visibleCount >= words.length) {
          cancelRevealTimer();
        }
      }, stepMs);
    }

    beginAutoContinuePrefetch(message);
    await speakAiText(fullContent);
    if (playbackTokenRef.current !== token) {
      return null;
    }

    cancelRevealTimer();
    finalizeAiMessage(message.id, fullContent);
    currentAiMessageIdRef.current = null;
    const nextMessage = await resolveAutoContinueAfterSpeech(message);
    if (nextMessage) {
      setMessages((prev) => [...prev, { ...toUiMessage(nextMessage), displayContent: "" }]);
      return playAiTurn(nextMessage);
    }
    return null;
  }, [beginAutoContinuePrefetch, cancelRevealTimer, finalizeAiMessage, resolveAutoContinueAfterSpeech, setTutorState]);

  const processTutorMessage = useCallback(async (message: Message) => {
    setMessages((prev) => [...prev, { ...toUiMessage(message), displayContent: "" }]);
    await playAiTurn(message);
  }, [playAiTurn]);

  const sendTypedOrSpokenResponse = useCallback(async (content: string, interrupted = false) => {
    const trimmed = content.trim();
    if (!trimmed || requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    pendingAutoContinueRef.current = false;
    interruptingRef.current = false;
    latestTranscriptRef.current = "";
    clearSilenceTimer();
    setRecognitionTranscript("");
    setInput("");
    appendStudentMessage(trimmed);
    setTutorState("thinking");

    try {
      const response = await sessionService.sendCompanionTurn(sessionId, {
        action: interrupted ? "tutor:interrupt" : "tutor:student_response",
        content: trimmed,
      });
      await refreshCompanionState();
      await processTutorMessage(response);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not send that response.");
      setTutorState(micMutedRef.current ? "muted" : "idle");
    } finally {
      requestInFlightRef.current = false;
    }
  }, [appendStudentMessage, clearSilenceTimer, processTutorMessage, refreshCompanionState, sessionId, setTutorState]);

  const handleBargeIn = useCallback(async (transcript: string) => {
    if (!transcript.trim() || interruptingRef.current) return;
    interruptingRef.current = true;
    setMessages((prev) =>
      prev.map((item) =>
        item.id === currentAiMessageIdRef.current ? { ...item, interrupted: true } : item,
      ),
    );
    await stopPlaybackNow();
    await sendTypedOrSpokenResponse(transcript, true);
  }, [sendTypedOrSpokenResponse, stopPlaybackNow]);

  useEffect(() => {
    if (!liveRecognitionAvailable) return;

    const resultListener = addLiveRecognitionListener("result", (event?: any) => {
      const transcript = String(event?.transcript || event?.results?.[0] || "").trim();
      if (!transcript) return;

      latestTranscriptRef.current = transcript;
      setRecognitionTranscript(transcript);
      if (runtimeStateRef.current === "ai_speaking" && !micMutedRef.current) {
        setTutorState("student_speaking");
        void handleBargeIn(transcript);
        return;
      }

      if (runtimeStateRef.current === "listening") {
        setTutorState("student_speaking");
      }

      if (runtimeStateRef.current === "listening" || runtimeStateRef.current === "student_speaking") {
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
          const finalTranscript = latestTranscriptRef.current.trim();
          if (finalTranscript && !requestInFlightRef.current) {
            latestTranscriptRef.current = "";
            void sendTypedOrSpokenResponse(finalTranscript, false);
          }
        }, 1200);
      }

      if (event?.isFinal) {
        clearSilenceTimer();
        latestTranscriptRef.current = "";
        void sendTypedOrSpokenResponse(transcript, false);
      }
    });

    const errorListener = addLiveRecognitionListener("error", () => {
      recognitionActiveRef.current = false;
      if (!micMutedRef.current && runtimeStateRef.current !== "ai_speaking" && runtimeStateRef.current !== "thinking") {
        setTutorState("idle");
      }
    });

    return () => {
      resultListener.remove();
      errorListener.remove();
    };
  }, [clearSilenceTimer, handleBargeIn, liveRecognitionAvailable, sendTypedOrSpokenResponse, setTutorState]);

  useEffect(() => {
    if (!liveRecognitionAvailable) {
      setLiveRecognitionReady(false);
      return;
    }

    let active = true;
    requestLiveRecognitionPermission()
      .then((granted) => {
        if (!active) return;
        setLiveRecognitionReady(granted);
        if (!granted) {
          setError("AI Tutor live mode requires live speech recognition permission in a development/custom build.");
        }
      })
      .catch(() => {
        if (!active) return;
        setLiveRecognitionReady(false);
      });

    return () => {
      active = false;
    };
  }, [liveRecognitionAvailable]);

  useEffect(() => {
    if (!liveRecognitionAvailable) {
      setError("AI Tutor live mode requires expo-speech-recognition in a development build or custom build. Expo Go cannot support the always-live mic or interruption flow.");
    }
  }, [liveRecognitionAvailable]);

  useEffect(() => {
    if (!liveRecognitionAvailable || !liveRecognitionReady) return;

    if (micMuted) {
      void stopListening();
      setTutorState("muted");
      return;
    }

    if (runtimeStateRef.current === "idle" || runtimeStateRef.current === "listening") {
      void startListening();
    }
  }, [liveRecognitionAvailable, liveRecognitionReady, micMuted, setTutorState, startListening, stopListening]);

  useEffect(() => {
    return () => {
      void stopListening();
      void stopAiSpeech();
      cancelRevealTimer();
      clearSilenceTimer();
    };
  }, [cancelRevealTimer, clearSilenceTimer, stopListening]);

  const handleStart = useCallback(async (mode: StartMode, sectionTitle?: string) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setError(null);
    setTutorState("thinking");

    try {
      const message = await sessionService.sendCompanionTurn(sessionId, {
        action: "tutor:start",
        mode,
        section_title: sectionTitle,
      });
      setStartModalVisible(false);
      setSpecificSection("");
      await refreshCompanionState();
      await processTutorMessage(message);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not start the AI Tutor.");
      setTutorState(micMutedRef.current ? "muted" : "idle");
    } finally {
      requestInFlightRef.current = false;
    }
  }, [processTutorMessage, refreshCompanionState, sessionId, setTutorState]);

  const handleSendText = useCallback(async () => {
    await sendTypedOrSpokenResponse(input, false);
  }, [input, sendTypedOrSpokenResponse]);

  const handleMicPress = useCallback(async () => {
    if (!liveRecognitionAvailable) {
      setError("AI Tutor live mode requires expo-speech-recognition in a development build or custom build. Expo Go cannot support the always-live mic or interruption flow.");
      return;
    }
    setMicMuted((prev) => !prev);
  }, [liveRecognitionAvailable]);

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

      requestInFlightRef.current = true;
      setTutorState("thinking");
      setError(null);
      const response = await sessionService.sendPhotoMessage(sessionId, result.assets[0].uri);
      appendStudentMessage(response.extractedText);
      await refreshCompanionState();
      await processTutorMessage(response.message);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not upload the solution image.");
      setTutorState(micMutedRef.current ? "muted" : "idle");
    } finally {
      requestInFlightRef.current = false;
    }
  }, [appendStudentMessage, processTutorMessage, refreshCompanionState, sessionId, setTutorState]);

  const phaseLabel = companionState ? phaseLabels[companionState.phase] || "Guided study" : "Guided study";

  const micStatusText = liveRecognitionAvailable
    ? micMuted
      ? "Mic muted"
      : recognitionTranscript
        ? `Listening: ${recognitionTranscript}`
        : runtimeState === "student_speaking"
          ? "Student speaking"
          : "Mic live"
    : "Live tutor build setup required";

  const renderMessage = ({ item }: { item: UiMessage }) => {
    const isStudent = item.role === "STUDENT";
    const content = isStudent ? item.content : item.displayContent;
    const shouldUseMathRenderer = !isStudent && looksMathHeavy(item.content || "");
    return (
      <View style={[styles.messageRow, isStudent ? styles.messageRowStudent : styles.messageRowAi]}>
        <View style={[styles.messageBubble, isStudent ? styles.studentBubble : styles.aiBubble]}>
          {isStudent ? (
            <Text style={styles.studentText}>{content}</Text>
          ) : content && shouldUseMathRenderer ? (
            <RichMathText content={content} textColor={colors.textPrimary} fontSize={15} lineHeight={1.55} />
          ) : content ? (
            <Text style={styles.aiText}>{content}</Text>
          ) : (
            <Text style={styles.aiFallbackText}>...</Text>
          )}
          {!isStudent && item.interrupted ? <Text style={styles.interruptedText}>Interrupted</Text> : null}
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

        <View style={styles.statusBar}>
          <Text style={styles.statusLabel}>{phaseLabel}</Text>
          <Text style={styles.statusValue}>{runtimeState.replace(/_/g, " ")}</Text>
        </View>

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
                Start the live tutor and Akademi will teach in spoken turns, wait for your answers, and keep the mic open.
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
            runtimeState === "thinking" ? (
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
              placeholder="Type if you prefer, or just speak"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />
            <View style={styles.composerStatusRow}>
              <Text style={styles.composerStatusText}>{micStatusText}</Text>
              <Text style={styles.composerStatusText}>{phaseLabel}</Text>
            </View>
            <View style={styles.composerActions}>
              <Pressable onPress={handleUploadSolution} style={styles.smallAction}>
                <Upload size={18} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={handleMicPress}
                style={[
                  styles.smallAction,
                  !micMuted && liveRecognitionAvailable ? styles.smallActionActive : null,
                ]}
              >
                {micMuted && liveRecognitionAvailable ? (
                  <MicOff size={18} color={colors.textSecondary} />
                ) : (
                  <Mic size={18} color={!micMuted ? "#08130C" : colors.textSecondary} />
                )}
              </Pressable>
              <Pressable
                onPress={() => void handleSendText()}
                style={[styles.sendButton, !input.trim() || requestInFlightRef.current ? styles.sendButtonDisabled : null]}
              >
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
                <Button title="Start from beginning" onPress={() => handleStart("beginning")} style={styles.startButton} />
                <Button title="Continue where I stopped" onPress={() => handleStart("continue")} variant="secondary" style={styles.startButton} />
                <Button title="Show roadmap first" onPress={() => handleStart("roadmap")} variant="outline" style={styles.startButton} />
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
    statusBar: {
      marginHorizontal: 18,
      marginBottom: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    statusLabel: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    statusValue: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      textTransform: "capitalize",
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
    interruptedText: {
      ...typography.bodySmall,
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 8,
      textTransform: "uppercase",
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
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    composerStatusText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      flex: 1,
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
  });
