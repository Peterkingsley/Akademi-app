import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { type AudioRecorder, useAudioRecorder } from "expo-audio";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Mic, Route as RouteIcon, Send, Upload, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { Screen } from "../../components/layout/Screen";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { RichMathText } from "../../components/ui/RichMathText";
import { WhiteboardRenderer } from "../../components/whiteboard/WhiteboardRenderer";
import { sampleLimitWhiteboardPlan } from "../../components/whiteboard/samplePlans";
import { WhiteboardRendererMode } from "../../components/whiteboard/types";
import { MainStackParamList } from "../../navigation/types";
import {
  Message,
  sessionService,
  StudyCompanionState,
  StudyRoadmapSection,
  StudyVisualPlan,
} from "../../services/session";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import {
  akademiRecordingOptions,
  prepareAudioRecording,
  requestMicrophonePermission,
  speakAiTextStream,
  stopAiSpeech,
  stopRecording,
  transcribeAudioUri,
} from "../../services/voice";

type StudyCompanionRoute = RouteProp<MainStackParamList, "StudyCompanion">;
type StartMode = "beginning" | "continue" | "specific" | "roadmap";
type TutorRuntimeState = "idle" | "ai_speaking" | "recording" | "student_speaking" | "thinking";
type UiMessage = Message & { displayContent: string; interrupted?: boolean };
type StudyCompanionPhaseName = StudyCompanionState["phase"];

const phaseLabels: Record<string, string> = {
  MATERIAL_SELECTION_REQUIRED: "Choose Material",
  MATERIAL_SELECTED: "Material Ready",
  ROADMAP_GENERATED: "Syllabus Roadmap Ready",
  TEACHING_PASS_1_BIG_PICTURE: "Step 1: Core Concept",
  TEACHING_PASS_2_DETAILS: "Step 2: Deep Breakdown",
  TEACHING_PASS_3_CONNECTIONS: "Step 3: Real-World Context",
  TEACHBACK_1_REQUESTED: "Teach-Back Check 🎯",
  TEACHBACK_1_EVALUATION: "Evaluating Your Answer...",
  GAP_RETEACH: "Targeted Reteach 💡",
  TEACHBACK_2_REQUESTED: "Final Teach-Back Check 🎯",
  TEACHBACK_2_EVALUATION: "Scoring Answer...",
  MEMORY_DUMP_REQUESTED: "Active Recall Challenge 🧠",
  MEMORY_DUMP_EVALUATION: "Scoring Recall...",
  MASTERY_PASSED: "Mastery Achieved 🎉",
  MASTERY_FAILED: "Needs Review 📚",
  SECTION_COMPLETED: "Section Complete ✨",
  NEXT_SECTION_READY: "Next Topic Ready",
  SESSION_COMPLETED: "Session Completed 🏆",
};

const statusColors = {
  NOT_STARTED: "#52525B",
  IN_PROGRESS: "#3B82F6",
  NEEDS_REVIEW: "#F59E0B",
  MASTERED: "#22C55E",
} as const;

const runtimeLabels: Record<TutorRuntimeState, string> = {
  idle: "Your turn",
  ai_speaking: "Tutor speaking",
  recording: "Recording",
  student_speaking: "Sending answer",
  thinking: "Tutor thinking",
};

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

function normalizeTranscriptMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function isLikelyAiSpeechEcho(transcript: string, aiText: string) {
  const spoken = normalizeTranscriptMatch(transcript);
  const ai = normalizeTranscriptMatch(aiText);
  if (!spoken || !ai) return false;
  return ai.includes(spoken);
}

const lockedStudyPhases = new Set<StudyCompanionPhaseName>([
  "TEACHBACK_1_REQUESTED",
  "TEACHBACK_2_REQUESTED",
  "MEMORY_DUMP_REQUESTED",
  "NEXT_SECTION_READY",
  "ROADMAP_GENERATED",
]);

const autoContinueStudyPhases = new Set<StudyCompanionPhaseName>([
  "TEACHING_PASS_1_BIG_PICTURE",
  "TEACHING_PASS_2_DETAILS",
  "TEACHING_PASS_3_CONNECTIONS",
  // The backend marks a gap-reteach explanation autoContinue:true/nextAction:'continue_teaching'
  // (study-companion.service.ts) the same way it does the three initial teaching passes - it
  // was missing here, so the client silently ignored that signal and sat idle waiting for the
  // student to type something, even though nothing was actually being asked of them yet.
  "GAP_RETEACH",
]);

function isAutoContinueLockedTurn(message: Message) {
  const metadata = message.metadata;
  const phase = metadata?.study_companion?.phase;

  return Boolean(
    metadata?.waitForStudent ||
      metadata?.turnType === "checkpoint_question" ||
      metadata?.nextAction === "evaluate_answer" ||
      (phase && lockedStudyPhases.has(phase)),
  );
}

function canAutoContinueTutorTurn(message: Message) {
  const phase = message.metadata?.study_companion?.phase;
  return Boolean(
    message.metadata?.autoContinue &&
      phase &&
      autoContinueStudyPhases.has(phase) &&
      !isAutoContinueLockedTurn(message),
  );
}

function hasMeaningfulStudentTranscript(transcript: string, currentAiText = "") {
  const normalized = normalizeTranscriptMatch(transcript);
  if (!normalized) return false;
  if (normalized.length < 3) return false;
  if (normalized.split(/\s+/).filter(Boolean).length === 1 && normalized.length < 4) return false;
  if (currentAiText && isLikelyAiSpeechEcho(transcript, currentAiText)) return false;
  return true;
}

// Memoized row: the word-reveal timer re-renders the screen every ~45ms, and without
// memoization every bubble re-renders too - handing already-mounted RichMathText WebViews
// a fresh source object each tick, which can force them to reload and blink. Message
// objects keep referential identity unless their own displayContent changes, so memo on
// `item` means only the actively-streaming bubble re-renders.
const MessageRow = React.memo(
  ({
    item,
    styles,
    textColor,
  }: {
    item: UiMessage;
    styles: ReturnType<typeof createStyles>;
    textColor: string;
  }) => {
    const isStudent = item.role === "STUDENT";
    const content = isStudent ? item.content : item.displayContent;
    const shouldUseMathRenderer = !isStudent && looksMathHeavy(item.content || "");
    return (
      <View style={[styles.messageRow, isStudent ? styles.messageRowStudent : styles.messageRowAi]}>
        <View style={[styles.messageBubble, isStudent ? styles.studentBubble : styles.aiBubble]}>
          {isStudent ? (
            <Text style={styles.studentText}>{content}</Text>
          ) : content && shouldUseMathRenderer ? (
            <RichMathText content={content} textColor={textColor} fontSize={15} lineHeight={1.55} />
          ) : content ? (
            <Text style={styles.aiText}>{content}</Text>
          ) : (
            <Text style={styles.aiFallbackText}>...</Text>
          )}
          {!isStudent && item.interrupted ? <Text style={styles.interruptedText}>Interrupted</Text> : null}
        </View>
      </View>
    );
  },
);

export const StudyCompanionScreen: React.FC = () => {
  const route = useRoute<StudyCompanionRoute>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sessionId, materialTitle, courseCode } = route.params;

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [companionState, setCompanionState] = useState<StudyCompanionState | null>(null);
  const [visualPlan, setVisualPlan] = useState<StudyVisualPlan | null>(null);
  const [whiteboardVisible, setWhiteboardVisible] = useState(false);
  const [whiteboardMode, setWhiteboardMode] = useState<WhiteboardRendererMode>("static");
  const [loading, setLoading] = useState(true);
  const [runtimeState, setRuntimeState] = useState<TutorRuntimeState>("idle");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [startingMode, setStartingMode] = useState<StartMode | null>(null);
  const [selectedStartMode, setSelectedStartMode] = useState<StartMode>("beginning");
  const [specificSection, setSpecificSection] = useState("");
  const recorder = useAudioRecorder(akademiRecordingOptions);
  const [recording, setRecording] = useState<AudioRecorder | null>(null);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [voiceUnavailable, setVoiceUnavailable] = useState<{ messageId: string; content: string } | null>(null);
  const [composerVisible, setComposerVisible] = useState(true);
  const whiteboardExperimentsEnabled =
    process.env.EXPO_PUBLIC_ENABLE_WHITEBOARD_EXPERIMENTS === "true";

  const listRef = useRef<FlatList<UiMessage>>(null);
  const runtimeStateRef = useRef<TutorRuntimeState>("idle");
  const currentAiMessageIdRef = useRef<string | null>(null);
  const currentAiSpeechTextRef = useRef("");
  const playbackTokenRef = useRef(0);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingAutoContinueRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const prefetchedContinueRef = useRef<Message | null>(null);
  const continuePrefetchPromiseRef = useRef<Promise<Message | null> | null>(null);
  const continuePrefetchTokenRef = useRef(0);

  const canContinue = (companionState?.currentSectionIndex ?? 0) > 0;
  const currentSectionNumber = Math.max(1, (companionState?.currentSectionIndex ?? 0) + 1);
  const totalSections = companionState?.progress.totalSections ?? companionState?.roadmap.length ?? 0;
  const sectionSuggestions = useMemo(() => {
    const query = specificSection.trim().toLowerCase();
    if (!query) return [];
    return (companionState?.roadmap ?? [])
      .filter((section) => section.title.toLowerCase().includes(query))
      .slice(0, 3);
  }, [companionState?.roadmap, specificSection]);
  const lastScrollOffsetRef = useRef(0);
  const lastLessonTapRef = useRef(0);
  const composerHeightRef = useRef(0);
  const suppressComposerHideUntilRef = useRef(0);

  const handleLessonScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextOffset = Math.max(0, event.nativeEvent.contentOffset.y);
    const movedDown = nextOffset - lastScrollOffsetRef.current > 6;
    if (
      Date.now() >= suppressComposerHideUntilRef.current &&
      nextOffset > 20 &&
      movedDown
    ) {
      setComposerVisible(false);
    }
    lastScrollOffsetRef.current = nextOffset;
  }, []);

  const rememberComposerHeight = useCallback((event: LayoutChangeEvent) => {
    composerHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const handleLessonTouchEnd = useCallback(() => {
    const now = Date.now();
    if (now - lastLessonTapRef.current <= 320) {
      lastLessonTapRef.current = 0;
      if (!composerVisible) {
        // Revealing the dock shrinks the list and emits a synthetic downward scroll.
        // Ignore that scroll, then move the reading position above the revealed dock.
        suppressComposerHideUntilRef.current = now + 700;
        setComposerVisible(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const adjustedOffset = lastScrollOffsetRef.current + composerHeightRef.current;
            listRef.current?.scrollToOffset({ offset: adjustedOffset, animated: false });
          });
        });
      }
      return;
    }
    lastLessonTapRef.current = now;
  }, [composerVisible]);

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
      const [list, state] = await Promise.all([
        sessionService.listMessages(sessionId),
        sessionService.getCompanionState(sessionId),
      ]);
      setMessages(list.map(toUiMessage));
      setCompanionState(state);
      setStartModalVisible(!list.some((item) => item.role === "AI"));
      setTutorState("idle");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load AI Tutor session.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, setTutorState]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    runtimeStateRef.current = runtimeState;
  }, [runtimeState]);

  // Depend on messages.length, not the array itself: the word-reveal timer mutates message
  // objects every ~45ms, and scrolling (animated) on every tick causes visible jitter.
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  useEffect(() => {
    if (!sessionId || companionState?.currentSectionIndex === undefined || companionState?.currentSectionIndex === null) {
      setVisualPlan(null);
      return;
    }

    let active = true;
    void sessionService
      .getVisualPlan(sessionId)
      .then((plan) => {
        if (active) {
          setVisualPlan(plan);
        }
      })
      .catch((err: any) => {
        console.warn("visual_plan_fetch_failed", err?.response?.data?.message || err?.message || err);
        if (active) {
          setVisualPlan(null);
        }
      });

    return () => {
      active = false;
    };
  }, [companionState?.currentSectionIndex, sessionId]);

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
    if (isAutoContinueLockedTurn(message)) {
      pendingAutoContinueRef.current = false;
      continuePrefetchTokenRef.current += 1;
      prefetchedContinueRef.current = null;
      continuePrefetchPromiseRef.current = null;
      return null;
    }

    if (canAutoContinueTutorTurn(message)) {
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

    if (isAutoContinueLockedTurn(message)) {
      pendingAutoContinueRef.current = false;
      continuePrefetchTokenRef.current += 1;
      prefetchedContinueRef.current = null;
      continuePrefetchPromiseRef.current = null;
      setTutorState("idle");
      return null;
    }

    if (!canAutoContinueTutorTurn(message)) {
      pendingAutoContinueRef.current = false;
      continuePrefetchTokenRef.current += 1;
      prefetchedContinueRef.current = null;
      continuePrefetchPromiseRef.current = null;
      setTutorState("idle");
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
      setTutorState("idle");
    }
    return awaitedMessage;
  }, [setTutorState]);

  const playAiTurn = useCallback(async (message: Message) => {
    const token = playbackTokenRef.current + 1;
    playbackTokenRef.current = token;
    currentAiMessageIdRef.current = message.id;
    cancelRevealTimer();
    setTutorState("ai_speaking");

    const fullContent = message.content || "";
    currentAiSpeechTextRef.current = fullContent;

    // Text is the primary learning path. Voice is optional and must never delay
    // a student from reading the complete Tutor response.
    finalizeAiMessage(message.id, fullContent);

    beginAutoContinuePrefetch(message);
    const voiceResult = await speakAiTextStream(sessionId, fullContent);
    if (playbackTokenRef.current !== token) {
      return null;
    }
    setVoiceUnavailable(voiceResult.ok ? null : { messageId: message.id, content: fullContent });

    cancelRevealTimer();
    finalizeAiMessage(message.id, fullContent);
    currentAiMessageIdRef.current = null;
    currentAiSpeechTextRef.current = "";
    const nextMessage = await resolveAutoContinueAfterSpeech(message);
    if (nextMessage) {
      setMessages((prev) => [...prev, { ...toUiMessage(nextMessage), displayContent: "" }]);
      return playAiTurn(nextMessage);
    }
    return null;
  }, [beginAutoContinuePrefetch, cancelRevealTimer, finalizeAiMessage, resolveAutoContinueAfterSpeech, setTutorState]);

  const retryVoicePlayback = useCallback(async () => {
    if (!voiceUnavailable) return;
    const { messageId, content } = voiceUnavailable;
    setVoiceUnavailable(null);
    const result = await speakAiTextStream(sessionId, content);
    if (!result.ok) {
      setVoiceUnavailable({ messageId, content });
    }
  }, [sessionId, voiceUnavailable]);

  const processTutorMessage = useCallback(async (message: Message) => {
    setMessages((prev) => [...prev, { ...toUiMessage(message), displayContent: "" }]);
    await playAiTurn(message);
  }, [playAiTurn]);

  const sendTypedOrSpokenResponse = useCallback(async (content: string, interrupted = false) => {
    const trimmed = content.trim();
    if (!hasMeaningfulStudentTranscript(trimmed, interrupted ? currentAiSpeechTextRef.current : "") || requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    pendingAutoContinueRef.current = false;
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
      setTutorState("idle");
    } finally {
      requestInFlightRef.current = false;
    }
  }, [appendStudentMessage, processTutorMessage, refreshCompanionState, sessionId, setTutorState]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stop().catch(() => undefined);
      }
      void stopAiSpeech();
      cancelRevealTimer();
    };
  }, [cancelRevealTimer, recording]);

  useEffect(() => {
    let stopped = false;
    const recordUsage = async () => {
      try {
        await sessionService.recordTutorUsage(30);
      } catch (err: any) {
        if (stopped) return;
        setError(err?.response?.data?.message || "Your AI Tutor allowance has ended.");
        setTutorState("idle");
        stopped = true;
      }
    };
    void recordUsage();
    const timer = setInterval(() => { if (!stopped) void recordUsage(); }, 30_000);
    return () => { stopped = true; clearInterval(timer); };
  }, [setTutorState]);

  const handleStart = useCallback(async (mode: StartMode, sectionTitle?: string) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setStartingMode(mode);
    setError(null);
    setTutorState("thinking");
    setStartModalVisible(false);

    try {
      const message = await sessionService.sendCompanionTurn(sessionId, {
        action: "tutor:start",
        mode,
        section_title: sectionTitle,
      });
      setSpecificSection("");
      await refreshCompanionState();
      await processTutorMessage(message);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not start the AI Tutor.");
      setTutorState("idle");
    } finally {
      requestInFlightRef.current = false;
      setStartingMode(null);
    }
  }, [processTutorMessage, refreshCompanionState, sessionId, setTutorState]);

  const handleSendText = useCallback(async () => {
    await sendTypedOrSpokenResponse(input, false);
  }, [input, sendTypedOrSpokenResponse]);

  const handleMicPress = useCallback(async () => {
    if (requestInFlightRef.current) {
      return;
    }

    try {
      if (!recording) {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          Alert.alert("Microphone permission", "Microphone permission is required to record your response.");
          return;
        }

        setError(null);
        if (runtimeStateRef.current === "ai_speaking") {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === currentAiMessageIdRef.current ? { ...item, interrupted: true } : item,
            ),
          );
          await stopPlaybackNow();
        }

        const nextRecording = await prepareAudioRecording(recorder);
        setRecording(nextRecording);
        setRecordingStatus("Recording...");
        setTutorState("recording");
        return;
      }

      setTutorState("thinking");
      setRecordingStatus("Transcribing...");
      const uri = await stopRecording(recording);
      setRecording(null);

      if (!uri) {
        setRecordingStatus("");
        setTutorState("idle");
        setError("I couldn't hear anything clearly. Please try again.");
        return;
      }

      const transcript = await transcribeAudioUri(uri, "ai-tutor-response.m4a");
      setRecordingStatus("");

      if (!hasMeaningfulStudentTranscript(transcript)) {
        setTutorState("idle");
        setError("I couldn't hear anything clearly. Please try again.");
        return;
      }

      setTutorState("student_speaking");
      await sendTypedOrSpokenResponse(transcript, false);
    } catch (err: any) {
      setRecording(null);
      setRecordingStatus("");
      setTutorState("idle");
      setError(err?.message || "Voice recording failed. Please try again.");
    }
  }, [recording, sendTypedOrSpokenResponse, setTutorState, stopPlaybackNow]);

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
      setTutorState("idle");
    } finally {
      requestInFlightRef.current = false;
    }
  }, [appendStudentMessage, processTutorMessage, refreshCompanionState, sessionId, setTutorState]);

  const phaseLabel = companionState ? phaseLabels[companionState.phase] || "Guided study" : "Guided study";

  const progressLabel = (() => {
    if (!companionState) return "";
    const sectionOfTotal = companionState.progress.totalSections
      ? `Section ${companionState.currentSectionIndex + 1} of ${companionState.progress.totalSections}`
      : "";
    const passOfTotal = companionState.passNumber
      ? `Pass ${companionState.passNumber} of ${companionState.totalPasses}`
      : "";
    return [sectionOfTotal, passOfTotal].filter(Boolean).join(" · ");
  })();

  const micStatusText =
    recordingStatus ||
    (runtimeState === "student_speaking"
      ? "Sending your response..."
      : runtimeState === "recording"
        ? "Recording..."
        : "Tap mic to record");

  const renderMessage = useCallback(
    ({ item }: { item: UiMessage }) => (
      <MessageRow item={item} styles={styles} textColor={colors.textPrimary} />
    ),
    [colors.textPrimary, styles],
  );

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
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statusBar}>
          <Text style={styles.statusLabel}>{phaseLabel}</Text>
          {progressLabel ? <Text style={styles.statusValue}>{progressLabel}</Text> : null}
          <Text style={styles.statusValue}>{runtimeLabels[runtimeState]}</Text>
        </View>

        {whiteboardExperimentsEnabled ? (
          <View style={styles.whiteboardDevRow}>
            <Pressable
              onPress={() => setWhiteboardVisible((current) => !current)}
              style={[
                styles.whiteboardDevChip,
                whiteboardVisible ? styles.whiteboardDevChipActive : null,
              ]}
            >
              <Text
                style={[
                  styles.whiteboardDevChipText,
                  whiteboardVisible ? styles.whiteboardDevChipTextActive : null,
                ]}
              >
                Whiteboard Test
              </Text>
            </Pressable>
          </View>
        ) : null}

        {visualPlan?.visuals?.length ? (
          <View style={styles.visualPlanBanner}>
            <Text style={styles.visualPlanText}>Visual aid available</Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleLessonScroll}
          onTouchEnd={handleLessonTouchEnd}
          scrollEventThrottle={16}
          ListHeaderComponent={
            whiteboardExperimentsEnabled && whiteboardVisible ? (
              <View style={styles.whiteboardPanel}>
                <Text style={styles.whiteboardPanelTitle}>Experimental Whiteboard</Text>
                <Text style={styles.whiteboardPanelText}>
                  This is a dev/test renderer comparison panel using a sample whiteboard plan only.
                </Text>
                <WhiteboardRenderer
                  plan={sampleLimitWhiteboardPlan}
                  mode={whiteboardMode}
                  onModeChange={setWhiteboardMode}
                  showModeSwitcher
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{runtimeState === "thinking" ? "Preparing your first lesson" : "Ready to begin"}</Text>
              <Text style={styles.emptyText}>
                {runtimeState === "thinking"
                  ? "Akademi is grounding the lesson in your selected material."
                  : "Start the tutor for short explanations, guided questions, and teach-back checks."}
              </Text>
              {!startModalVisible && runtimeState !== "thinking" ? (
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

        {voiceUnavailable ? (
          <View style={styles.voiceUnavailableRow}>
            <Pressable onPress={() => void retryVoicePlayback()} style={styles.voiceUnavailableChip}>
              <Text style={styles.voiceUnavailableText}>Voice unavailable · Tap to retry</Text>
            </Pressable>
          </View>
        ) : null}

        {composerVisible ? (
          <View style={styles.composer} onLayout={rememberComposerHeight}>
            <View style={styles.composerBox}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type if you prefer, or just speak"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
              accessibilityLabel="Your answer"
            />
            <View style={styles.composerStatusRow}>
              <Text style={styles.composerStatusText}>{micStatusText}</Text>
              <Text style={styles.composerStatusText}>{phaseLabel}</Text>
            </View>
            <View style={styles.composerActions}>
              <Pressable onPress={handleUploadSolution} style={styles.smallAction} accessibilityRole="button" accessibilityLabel="Upload solution image">
                <Upload size={18} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={handleMicPress}
                style={[
                  styles.smallAction,
                  recording ? styles.smallActionActive : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={recording ? "Stop recording" : "Record answer"}
              >
                <Mic size={18} color={recording ? "#08130C" : colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => void handleSendText()}
                style={[styles.sendButton, !input.trim() || requestInFlightRef.current ? styles.sendButtonDisabled : null]}
                disabled={!input.trim() || requestInFlightRef.current}
                accessibilityRole="button"
                accessibilityLabel="Send answer"
                accessibilityState={{ disabled: !input.trim() || requestInFlightRef.current }}
              >
                <Send size={18} color="#08130C" />
              </Pressable>
            </View>
            </View>
          </View>
        ) : null}

        <Modal transparent visible={startModalVisible} animationType="fade" statusBarTranslucent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalHeaderTitleWrap}>
                  <Text style={styles.modalTitle}>Start tutoring</Text>
                  <Text style={styles.modalText}>
                    {courseCode} · {materialTitle}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setStartModalVisible(false)}
                  style={styles.modalCloseButton}
                  disabled={Boolean(startingMode)}
                  accessibilityRole="button"
                  accessibilityLabel="Close start options"
                >
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalProgressText}>
                {totalSections > 0
                  ? `You are on section ${currentSectionNumber} of ${totalSections}.`
                  : "Choose where you want to begin."}
              </Text>

              <View style={styles.startOptions}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[styles.startOption, selectedStartMode === "beginning" && styles.startOptionSelected]}
                  onPress={() => setSelectedStartMode("beginning")}
                  disabled={Boolean(startingMode)}
                  accessibilityRole="button"
                  accessibilityLabel="Start from beginning"
                  accessibilityState={{ disabled: Boolean(startingMode), selected: selectedStartMode === "beginning" }}
                >
                  <View style={styles.startOptionRadio}>
                    {selectedStartMode === "beginning" ? <View style={styles.startOptionRadioDot} /> : null}
                  </View>
                  <View style={styles.startOptionCopy}>
                    <Text style={styles.startOptionTitle}>Start from section 1</Text>
                    <Text style={styles.startOptionDescription}>Build the foundation before moving ahead.</Text>
                  </View>
                </TouchableOpacity>

                {canContinue ? (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={[styles.startOption, selectedStartMode === "continue" && styles.startOptionSelected]}
                    onPress={() => setSelectedStartMode("continue")}
                    disabled={Boolean(startingMode)}
                    accessibilityRole="button"
                    accessibilityLabel="Continue from current section"
                    accessibilityState={{ disabled: Boolean(startingMode), selected: selectedStartMode === "continue" }}
                  >
                    <View style={styles.startOptionRadio}>
                      {selectedStartMode === "continue" ? <View style={styles.startOptionRadioDot} /> : null}
                    </View>
                    <View style={styles.startOptionCopy}>
                      <Text style={styles.startOptionTitle}>Continue from section {currentSectionNumber}</Text>
                      <Text style={styles.startOptionDescription}>Pick up from your last active study point.</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.specificSectionBox}>
                <Text style={styles.specificLabel}>Jump to a section</Text>
                <TextInput
                  value={specificSection}
                  onChangeText={(value) => {
                    setSpecificSection(value);
                    if (value.trim()) setSelectedStartMode("specific");
                  }}
                  onFocus={() => setSelectedStartMode("specific")}
                  placeholder="Search sections"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.specificInput, selectedStartMode === "specific" && styles.specificInputSelected]}
                  editable={!startingMode}
                  accessibilityLabel="Search sections"
                />
                {sectionSuggestions.map((section) => (
                  <TouchableOpacity
                    key={section.key}
                    style={styles.sectionSuggestion}
                    onPress={() => {
                      setSpecificSection(section.title);
                      setSelectedStartMode("specific");
                    }}
                    disabled={Boolean(startingMode)}
                    accessibilityRole="button"
                    accessibilityLabel={`Start from ${section.title}`}
                  >
                    <Text numberOfLines={1} style={styles.sectionSuggestionText}>{section.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                label="Start tutoring"
                onPress={() => handleStart(
                  selectedStartMode,
                  selectedStartMode === "specific" ? specificSection.trim() : undefined,
                )}
                loading={Boolean(startingMode)}
                disabled={selectedStartMode === "specific" && !specificSection.trim()}
                pressScale={0.98}
                style={styles.startTutorButton}
              />
            </View>
          </View>
        </Modal>
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
    visualPlanBanner: {
      marginHorizontal: 18,
      marginBottom: 10,
      alignSelf: "flex-start",
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    visualPlanText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    whiteboardDevRow: {
      marginHorizontal: 18,
      marginBottom: 10,
      alignItems: "flex-start",
    },
    whiteboardDevChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    whiteboardDevChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    whiteboardDevChipText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    whiteboardDevChipTextActive: {
      color: "#08130C",
    },
    voiceUnavailableRow: {
      marginHorizontal: 18,
      marginBottom: 10,
      alignItems: "flex-start",
    },
    voiceUnavailableChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    voiceUnavailableText: {
      ...typography.bodySmall,
      color: colors.warning,
      fontSize: 11,
      fontWeight: "700",
    },
    whiteboardPanel: {
      marginBottom: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 10,
    },
    whiteboardPanelTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 16,
    },
    whiteboardPanelText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
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
      backgroundColor: "rgba(0,0,0,0.52)",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingHorizontal: 16,
      paddingBottom: 24,
      zIndex: 999,
    },
    modalCard: {
      width: "100%",
      maxWidth: 440,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: 20,
    },
    modalHeaderRow: {
      flexDirection: "row",
      marginBottom: 16,
    },
    modalHeaderTitleWrap: {
      flex: 1,
    },
    modalCloseButton: {
      alignItems: "center",
      borderRadius: 12,
      height: 44,
      justifyContent: "center",
      marginLeft: 8,
      width: 44,
    },
    modalTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      fontSize: 22,
      marginBottom: 4,
    },
    modalText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    modalProgressText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 16,
    },
    startOptions: {
      gap: 12,
    },
    startOption: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 76,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    startOptionSelected: {
      backgroundColor: `${colors.primary}14`,
      borderColor: colors.primary,
    },
    startOptionRadio: {
      alignItems: "center",
      borderColor: colors.textMuted,
      borderRadius: 9,
      borderWidth: 1.5,
      height: 18,
      justifyContent: "center",
      marginRight: 12,
      width: 18,
    },
    startOptionRadioDot: {
      backgroundColor: colors.primary,
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    startOptionCopy: {
      flex: 1,
    },
    startOptionTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 14,
      marginBottom: 3,
    },
    startOptionDescription: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
    specificSectionBox: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    specificLabel: {
      ...typography.label,
      color: colors.textMuted,
      fontSize: 11,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    specificInput: {
      ...typography.body,
      flex: 1,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 13,
    },
    specificInputSelected: {
      borderColor: colors.primary,
    },
    sectionSuggestion: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: 2,
      paddingVertical: 10,
    },
    sectionSuggestionText: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      fontSize: 13,
    },
    startTutorButton: {
      marginTop: 18,
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
