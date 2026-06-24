import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BookOpen, ClipboardList, GraduationCap, ListChecks, Send, Sparkles, X } from "lucide-react-native";

import { sessionService, StudyCompanionState } from "../../services/session";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { RichMathText } from "./RichMathText";
import { useVoiceComposer } from "../../hooks/useVoiceComposer";
import { appendTranscript } from "../../services/voice";
import { useAiVoicePlayback } from "../../hooks/useAiVoicePlayback";
import { VoiceInputButton } from "./VoiceInputButton";
import { AiVoiceToggleButton } from "./AiVoiceToggleButton";

type AskAction = "ask" | "summarize" | "explain" | "teach" | "practice";
type CompanionStartMode = "continue" | "specific" | "beginning" | "roadmap";

interface ChatMessage {
  id: string;
  role: "student" | "ai";
  content: string;
}

interface AskAkademiModalProps {
  visible: boolean;
  onClose: () => void;
  contextText: string;
  courseCode?: string;
  materialTitle?: string;
  selectedPassage?: string;
  surroundingPassage?: string;
  chapterTitle?: string;
  pageTitle?: string;
  materialContext?: string;
  materialId?: string;
  roadmapSections?: string[];
}

export const AskAkademiModal: React.FC<AskAkademiModalProps> = ({
  visible,
  onClose,
  contextText,
  courseCode,
  materialTitle,
  selectedPassage,
  surroundingPassage,
  chapterTitle,
  pageTitle,
  materialContext,
  materialId,
  roadmapSections = [],
}) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<AskAction>("ask");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [companionStarted, setCompanionStarted] = useState(false);
  const [selectedRoadmapSection, setSelectedRoadmapSection] = useState<string | null>(null);
  const [companionState, setCompanionState] = useState<StudyCompanionState | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const spokenMessageIdsRef = useRef<Set<string>>(new Set());
  const { aiVoiceEnabled, toggleAiVoice, speakIfEnabled } = useAiVoicePlayback();
  const {
    isRecording,
    isTranscribing,
    toggleRecording,
  } = useVoiceComposer({
    onTranscript: (transcript) => setQuestion((prev) => appendTranscript(prev, transcript, true)),
    recordingName: "ask-akademi-voice.m4a",
    permissionMessage: "Allow microphone access so Akademi can capture your question.",
    stopErrorTitle: "Voice input failed",
  });

  const isStudyCompanionMode = Boolean(materialId && materialTitle);

  useEffect(() => {
    if (visible) {
      setQuestion("");
      setMessages([]);
      setSessionId(null);
      setActiveAction("ask");
      setCompanionStarted(false);
      setSelectedRoadmapSection(null);
      setCompanionState(null);
      spokenMessageIdsRef.current.clear();
    }
  }, [visible]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages]);

  useEffect(() => {
    const latestAiMessage = [...messages].reverse().find((message) => message.role === "ai");
    if (!latestAiMessage) return;
    if (spokenMessageIdsRef.current.has(latestAiMessage.id)) return;
    spokenMessageIdsRef.current.add(latestAiMessage.id);
    speakIfEnabled(latestAiMessage.content).catch(() => undefined);
  }, [messages, speakIfEnabled]);

  const previewContext = useMemo(() => {
    return [
      materialTitle ? `Material: ${materialTitle}` : "",
      chapterTitle ? `Chapter: ${chapterTitle}` : "",
      pageTitle && pageTitle !== chapterTitle ? `Page: ${pageTitle}` : "",
      selectedPassage ? `Selected: ${selectedPassage}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [chapterTitle, materialTitle, pageTitle, selectedPassage]);

  const roadmap = useMemo(
    () =>
      Array.from(
        new Set(
          roadmapSections
            .map((section) => section.trim())
            .filter(Boolean),
        ),
      ).slice(0, 18),
    [roadmapSections],
  );

  const buildPrompt = (action: AskAction, outgoingQuestion: string) => {
    const safeContext = contextText.trim();
    const highlighted = selectedPassage?.trim() || "";
    const nearbyPassage = surroundingPassage?.trim() || "";
    const widerMaterial = materialContext?.trim() || "";
    const location = [chapterTitle ? `Chapter: ${chapterTitle}` : "", pageTitle ? `Page: ${pageTitle}` : ""]
      .filter(Boolean)
      .join("\n");

    const sharedGuide = [
      "You are Akademi AI Study Companion.",
      "Your primary goal is to help the student pass exams using the selected material.",
      "The student is actively reading one specific material.",
      "This is not open-ended general chat. Stay inside the selected material and course context.",
      "Your first job is to understand the highlighted part in the context of this material.",
      "Use the selected text first. If that text is incomplete or ambiguous, use the surrounding passage to infer what it refers to.",
      "If the student's question is still genuinely ambiguous after using the material context, ask one short clarifying question before explaining further.",
      "Do not jump into a long generic answer. Keep replies short, grounded, conversational, and exam-focused.",
      "Explain in the context of this material first. Any outside analogy must stay close to the material and should only support understanding.",
      "If the material's meaning and general-world meaning could differ, always privilege the meaning that fits this material.",
      "If the material is unclear or incomplete, you may use external knowledge, but you must label it clearly as external support.",
      "When appropriate, follow a guided study flow: big picture, details, connections, teach-back, memory dump, and mastery.",
      "Whenever you write mathematics, use proper LaTeX delimiters: inline math in \\(...\\) and standalone math in \\[...\\].",
      "End in a way that keeps the conversation open so the student can reply from where they are stuck.",
      materialTitle ? `Material title: ${materialTitle}` : "",
      courseCode ? `Course code: ${courseCode}` : "",
      location,
      highlighted ? `Highlighted text:\n${highlighted}` : "",
      nearbyPassage ? `Surrounding passage:\n${nearbyPassage}` : "",
      widerMaterial ? `Material-wide context:\n${widerMaterial}` : "",
      safeContext ? `Reader context package:\n${safeContext}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    switch (action) {
      case "summarize":
        return `${sharedGuide}\n\nTask: Give a short study summary of this exact part of the material. Focus on what this section is saying and why it matters in this material.`;
      case "explain":
        return `${sharedGuide}\n\nTask: Explain this exact part step by step in simple language. Start from what the highlighted line is referring to in this material.`;
      case "teach":
        return `${sharedGuide}\n\nTask: Explain this part patiently. Start with the exact confusion point, connect it to the material, then build understanding carefully.`;
      case "practice":
        return `${sharedGuide}\n\nTask: Create a short CBT-style practice from this exact part of the material only. Give 5 multiple-choice questions with options, answers, and short explanations.`;
      case "ask":
      default:
        return `${sharedGuide}\n\nStudent question:\n${outgoingQuestion}\n\nTask: Understand exactly what the student is confused about in this material. If the question is ambiguous, ask one short clarifying question first. Otherwise answer briefly and in-context, then end with one focused check-in question.`;
    }
  };

  const ensureSession = async (replyMode: "STUDY" | "QUESTION" = "STUDY") => {
    if (sessionId) return sessionId;

    const created = await sessionService.createSession({
      session_type: "STUDY",
      course_code: courseCode || "GENERAL",
      reply_mode: replyMode,
      topic: materialTitle || chapterTitle || "AI Study Companion",
      material_id: materialId,
      metadata: {
        mode: "ai-study-companion",
        materialTitle,
        chapterTitle,
        roadmap,
      },
    });

    setSessionId(created.id);
    return created.id;
  };

  const handleCompanionStart = async (mode: CompanionStartMode, section?: string) => {
    if (!contextText.trim()) return;

    Keyboard.dismiss();
    setLoading(true);
    setCompanionStarted(true);
    if (section) setSelectedRoadmapSection(section);

    try {
      const activeSessionId = await ensureSession("STUDY");
      const aiMessage = await sessionService.startCompanion(activeSessionId, {
        mode,
        section_title: section,
      });

      if (aiMessage.metadata?.study_companion) {
        setCompanionState(aiMessage.metadata.study_companion);
      } else {
        const liveState = await sessionService.getCompanionState(activeSessionId);
        setCompanionState(liveState);
      }

      setMessages((current) => [
        ...current,
        { id: aiMessage.id || `ai-${Date.now()}`, role: "ai", content: aiMessage.content },
      ]);
    } catch (error) {
      console.error("Failed to start AI Study Companion:", error);
      setMessages((current) => [
        ...current,
        {
          id: `ai-error-${Date.now()}`,
          role: "ai",
          content: "I couldn't start the guided study session just yet. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: AskAction = activeAction) => {
    if (!contextText.trim()) return;

    const outgoingQuestion = isStudyCompanionMode
      ? question.trim()
      : (
      action === "ask"
        ? question.trim()
        : action === "summarize"
          ? "Please summarize this part for me."
          : action === "explain"
            ? "Please explain this part clearly."
            : action === "teach"
              ? "Teach me this part carefully."
            : "Give me practice questions from this part."
        );

    if (!outgoingQuestion) return;

    Keyboard.dismiss();
    setLoading(true);
    setActiveAction(action);

    try {
      const activeSessionId = await ensureSession(action === "practice" ? "QUESTION" : "STUDY");

      setMessages((current) => [
        ...current,
        {
          id: `student-${Date.now()}`,
          role: "student",
          content: outgoingQuestion,
        },
      ]);

      const aiMessage = await sessionService.sendMessage(activeSessionId, {
        content: isStudyCompanionMode ? outgoingQuestion : buildPrompt(action, outgoingQuestion),
        reply_mode: action === "practice" ? "QUESTION" : "STUDY",
      });

      if (aiMessage.metadata?.study_companion) {
        setCompanionState(aiMessage.metadata.study_companion);
      }

      setMessages((current) => [
        ...current,
        {
          id: aiMessage.id || `ai-${Date.now()}`,
          role: "ai",
          content: aiMessage.content,
        },
      ]);
      setQuestion("");
    } catch (error) {
      console.error("Failed to ask Akademi:", error);
      setMessages((current) => [
        ...current,
        {
          id: `ai-error-${Date.now()}`,
          role: "ai",
          content: "I could not reach Akademi AI for this material yet. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const actions = [
    { key: "summarize" as const, label: "Summarize", icon: <ListChecks size={16} color="#FFFFFF" /> },
    { key: "explain" as const, label: "Explain", icon: <BookOpen size={16} color="#FFFFFF" /> },
    { key: "teach" as const, label: "Teach", icon: <GraduationCap size={16} color="#FFFFFF" /> },
    { key: "practice" as const, label: "CBT", icon: <ClipboardList size={16} color="#FFFFFF" /> },
  ];

  const currentRoadmapSection =
    companionState?.roadmap?.[Math.max(0, Math.min(companionState.currentSectionIndex, (companionState.roadmap?.length || 1) - 1))] || null;
  const phaseLabel = companionState?.phase
    ? companionState.phase
        .replace(/^TEACHING_/, "")
        .replace(/^TEACHBACK_/, "TEACH BACK ")
        .replace(/_/g, " ")
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.overlayInner}>
          <Pressable style={styles.backdrop} onPress={Keyboard.dismiss} />
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <Sparkles size={20} color={colors.primary} />
                <Text style={[styles.title, typography.h3]}>Ask Akademi</Text>
              </View>
              <View style={styles.headerActions}>
                <AiVoiceToggleButton enabled={aiVoiceEnabled} onPress={toggleAiVoice} />
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.contextBox}>
                <Text style={[styles.contextLabel, typography.mono]}>CONTEXT</Text>
                <Text style={[styles.contextText, typography.bodySmall]} numberOfLines={4}>
                  {previewContext || contextText}
                </Text>
              </View>

              {isStudyCompanionMode && !companionStarted && messages.length === 0 ? (
                <View style={styles.companionIntroCard}>
                  <Text style={styles.companionEyebrow}>AI STUDY COMPANION</Text>
                  <Text style={styles.companionTitle}>Study this material with Akademi</Text>
                  <Text style={styles.companionBody}>
                    Akademi will guide this material section by section, push recall, and keep the session focused on exam success.
                  </Text>
                  <View style={styles.startActions}>
                    <TouchableOpacity style={styles.startButton} onPress={() => handleCompanionStart("continue")} disabled={loading}>
                      <Text style={styles.startButtonText}>Continue from last point</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.startButton} onPress={() => handleCompanionStart("beginning")} disabled={loading}>
                      <Text style={styles.startButtonText}>Start from beginning</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.startButton} onPress={() => handleCompanionStart("roadmap")} disabled={loading}>
                      <Text style={styles.startButtonText}>Create study roadmap</Text>
                    </TouchableOpacity>
                  </View>
                  {roadmap.length > 0 ? (
                    <View style={styles.roadmapCard}>
                      <Text style={styles.roadmapTitle}>Material roadmap</Text>
                      {roadmap.slice(0, 8).map((section, index) => (
                        <TouchableOpacity
                          key={`${section}-${index}`}
                          style={[
                            styles.roadmapRow,
                            selectedRoadmapSection === section && styles.roadmapRowActive,
                          ]}
                          onPress={() => handleCompanionStart("specific", section)}
                          disabled={loading}
                        >
                          <Text style={styles.roadmapIndex}>{index + 1}</Text>
                          <Text style={styles.roadmapLabel}>{section}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {companionState ? (
                <View style={styles.progressCard}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressTitle}>Study progress</Text>
                    {phaseLabel ? <Text style={styles.phaseBadge}>{phaseLabel}</Text> : null}
                  </View>
                  <Text style={styles.progressMeta}>
                    {companionState.progress.masteredSections}/{companionState.progress.totalSections} sections mastered
                    {companionState.lastMasteryScore !== null ? ` • Last score ${companionState.lastMasteryScore}%` : ""}
                  </Text>
                  {currentRoadmapSection ? (
                    <Text style={styles.currentSectionText}>
                      Current section: {currentRoadmapSection.title}
                    </Text>
                  ) : null}
                  <View style={styles.roadmapMiniList}>
                    {companionState.roadmap.slice(0, 8).map((section, index) => (
                      <TouchableOpacity
                        key={section.key}
                        style={[
                          styles.roadmapMiniRow,
                          index === companionState.currentSectionIndex && styles.roadmapMiniRowActive,
                        ]}
                        onPress={() => handleCompanionStart("specific", section.title)}
                        disabled={loading}
                      >
                        <Text style={styles.roadmapMiniIndex}>{index + 1}</Text>
                        <Text style={styles.roadmapMiniLabel}>{section.title}</Text>
                        <Text style={styles.roadmapMiniStatus}>{section.status.replace(/_/g, " ")}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  {actions.map((action) => (
                    <TouchableOpacity
                      key={action.key}
                      style={[styles.actionChip, activeAction === action.key && styles.actionChipActive]}
                      onPress={() => handleAction(action.key)}
                      disabled={loading}
                    >
                      {action.icon}
                      <Text style={[styles.actionText, typography.caption]}>{action.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {messages.length > 0 ? (
                <View style={styles.messagesContainer}>
                  {messages.map((message) => (
                    <View
                      key={message.id}
                      style={[
                        styles.messageBubble,
                        message.role === "student" ? styles.studentBubble : styles.aiBubble,
                      ]}
                    >
                      {message.role === "ai" ? (
                        <View style={styles.aiHeader}>
                          <Avatar size={24} name="Akademi" />
                          <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700", marginLeft: 8 }]}>
                            Akademi AI
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.studentLabel, typography.caption]}>You</Text>
                      )}
                      <RichMathText
                        content={message.content}
                        textColor="#FFFFFF"
                        fontSize={14}
                        lineHeight={1.45}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.helperText, typography.bodySmall]}>
                  {isStudyCompanionMode
                    ? "Start the study companion, then reply through each phase as Akademi guides you."
                    : "Ask about the highlighted line, and Akademi will explain it using this material first."}
                </Text>
              )}

              <View style={styles.inputArea}>
                <Text style={[styles.inputLabel, typography.bodySmall]}>
                  {isStudyCompanionMode
                    ? (messages.length > 0 ? "Reply to continue this study phase" : "Start a guided study session")
                    : (messages.length > 0 ? "Reply to keep going" : "What would you like to know about this?")}
                </Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, typography.bodySmall]}
                    placeholder={
                      isStudyCompanionMode
                        ? (messages.length > 0 ? "Give your teach-back, memory dump, or reply here..." : "Start with one of the study options above...")
                        : messages.length > 0
                          ? "Reply here..."
                          : "Tell Akademi exactly where you got confused..."
                    }
                    placeholderTextColor={colors.textMuted}
                    multiline
                    value={question}
                    onChangeText={setQuestion}
                    autoFocus
                  />
                  <VoiceInputButton
                    onPress={toggleRecording}
                    isRecording={isRecording}
                    isTranscribing={isTranscribing}
                    style={styles.voiceButton}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                label={
                  isStudyCompanionMode
                    ? (messages.length ? "Continue study" : "Start study")
                    : (messages.length ? "Send reply" : "Ask Akademi")
                }
                onPress={() => handleAction("ask")}
                loading={loading}
                disabled={!question.trim()}
                icon={<Send size={18} color="#FFFFFF" />}
                style={styles.askBtn}
              />
              <TouchableOpacity onPress={onClose} style={styles.doneInline}>
                <Text style={styles.doneInlineText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 32,
  },
  overlayInner: {
    flex: 1,
    justifyContent: "center",
    position: "relative",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingTop: 20,
    maxHeight: "78%",
    minHeight: "56%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: "#FFFFFF",
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  contextBox: {
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: 24,
  },
  contextLabel: {
    color: colors.textMuted,
    fontSize: 8,
    marginBottom: 4,
  },
  contextText: {
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionChipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  companionIntroCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  companionEyebrow: {
    ...typography.mono,
    color: colors.primary,
    fontSize: 10,
    marginBottom: 8,
  },
  companionTitle: {
    ...typography.h3,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  companionBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  startActions: {
    gap: 10,
    marginBottom: 14,
  },
  startButton: {
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  startButtonText: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  roadmapCard: {
    marginTop: 4,
    gap: 8,
  },
  roadmapTitle: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  roadmapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roadmapRowActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
  },
  roadmapIndex: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
    minWidth: 18,
  },
  roadmapLabel: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    flex: 1,
  },
  progressCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  progressTitle: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  phaseBadge: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  progressMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  currentSectionText: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  roadmapMiniList: {
    gap: 8,
  },
  roadmapMiniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  roadmapMiniRowActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}16`,
  },
  roadmapMiniIndex: {
    ...typography.caption,
    color: colors.primary,
    minWidth: 16,
    fontWeight: "700",
  },
  roadmapMiniLabel: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    flex: 1,
  },
  roadmapMiniStatus: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  inputArea: {
    marginBottom: 18,
  },
  inputLabel: {
    color: "#FFFFFF",
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    color: "#FFFFFF",
    minHeight: 96,
    textAlignVertical: "top",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  voiceButton: {
    marginBottom: 4,
  },
  messagesContainer: {
    gap: 12,
  },
  messageBubble: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  aiBubble: {
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  studentBubble: {
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  aiName: {
    color: colors.primary,
  },
  studentLabel: {
    color: colors.primary,
    fontWeight: "700",
    marginBottom: 8,
  },
  responseText: {
    color: "#FFFFFF",
    lineHeight: 20,
  },
  helperText: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 34 : 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
    alignItems: "center",
  },
  askBtn: {
    width: "100%",
  },
  doneInline: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  doneInlineText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
