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

import { sessionService } from "../../services/session";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { RichMathText } from "./RichMathText";

type AskAction = "ask" | "summarize" | "explain" | "teach" | "practice";

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
}) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<AskAction>("ask");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (visible) {
      setQuestion("");
      setMessages([]);
      setSessionId(null);
      setActiveAction("ask");
    }
  }, [visible]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages]);

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

  const buildPrompt = (action: AskAction, outgoingQuestion: string) => {
    const safeContext = contextText.trim();
    const highlighted = selectedPassage?.trim() || "";
    const nearbyPassage = surroundingPassage?.trim() || "";
    const widerMaterial = materialContext?.trim() || "";
    const location = [chapterTitle ? `Chapter: ${chapterTitle}` : "", pageTitle ? `Page: ${pageTitle}` : ""]
      .filter(Boolean)
      .join("\n");

    const sharedGuide = [
      "You are Akademi's in-material study companion.",
      "The student is actively reading one specific material.",
      "Your first job is to understand the highlighted part in the context of this material.",
      "Use the selected text first. If that text is incomplete or ambiguous, use the surrounding passage to infer what it refers to.",
      "If the student's question is still genuinely ambiguous after using the material context, ask one short clarifying question before explaining further.",
      "Do not jump into a long generic answer. Keep replies short, grounded, and conversational.",
      "Explain in the context of this material first. Any outside analogy must stay close to the material and should only support understanding.",
      "If the material's meaning and general-world meaning could differ, always privilege the meaning that fits this material.",
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
        return `${sharedGuide}\n\nTask: Teach this part like a patient tutor. Start with the exact confusion point, connect it to the material, then build understanding carefully.`;
      case "practice":
        return `${sharedGuide}\n\nTask: Create a short CBT-style practice from this exact part of the material only. Give 5 multiple-choice questions with options, answers, and short explanations.`;
      case "ask":
      default:
        return `${sharedGuide}\n\nStudent question:\n${outgoingQuestion}\n\nTask: Understand exactly what the student is confused about in this material. If the question is ambiguous, ask one short clarifying question first. Otherwise answer briefly and in-context, then end with one focused check-in question.`;
    }
  };

  const handleAction = async (action: AskAction = activeAction) => {
    if (!contextText.trim()) return;

    const outgoingQuestion =
      action === "ask"
        ? question.trim()
        : action === "summarize"
          ? "Please summarize this part for me."
          : action === "explain"
            ? "Please explain this part clearly."
            : action === "teach"
              ? "Teach me this part carefully."
              : "Give me practice questions from this part.";

    if (!outgoingQuestion) return;

    Keyboard.dismiss();
    setLoading(true);
    setActiveAction(action);

    try {
      const activeSessionId =
        sessionId ||
        (
          await sessionService.createSession({
            session_type: "STUDY",
            course_code: courseCode || "GENERAL",
            reply_mode: action === "practice" ? "QUESTION" : "STUDY",
            topic: materialTitle || chapterTitle || "Material study help",
          })
        ).id;

      if (!sessionId) setSessionId(activeSessionId);

      setMessages((current) => [
        ...current,
        {
          id: `student-${Date.now()}`,
          role: "student",
          content: outgoingQuestion,
        },
      ]);

      const aiMessage = await sessionService.sendMessage(activeSessionId, {
        content: buildPrompt(action, outgoingQuestion),
        reply_mode: action === "practice" ? "QUESTION" : "STUDY",
      });

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
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
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
                  Ask about the highlighted line, and Akademi will explain it using this material first.
                </Text>
              )}

              <View style={styles.inputArea}>
                <Text style={[styles.inputLabel, typography.bodySmall]}>
                  {messages.length > 0 ? "Reply to keep going" : "What would you like to know about this?"}
                </Text>
                <TextInput
                  style={[styles.input, typography.bodySmall]}
                  placeholder={
                    messages.length > 0
                      ? "Reply here..."
                      : "Tell Akademi exactly where you got confused..."
                  }
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={question}
                  onChangeText={setQuestion}
                  autoFocus
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                label={messages.length ? "Send reply" : "Ask Akademi"}
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
  inputArea: {
    marginBottom: 18,
  },
  inputLabel: {
    color: "#FFFFFF",
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    color: "#FFFFFF",
    minHeight: 96,
    textAlignVertical: "top",
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
