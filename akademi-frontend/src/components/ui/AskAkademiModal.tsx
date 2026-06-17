import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { BookOpen, ClipboardList, GraduationCap, ListChecks, Send, Sparkles, X } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "./Button";
import { Avatar } from "./Avatar";
import { sessionService } from "../../services/session";

interface AskAkademiModalProps {
  visible: boolean;
  onClose: () => void;
  contextText: string;
  courseCode?: string;
  materialTitle?: string;
}

export const AskAkademiModal: React.FC<AskAkademiModalProps> = ({
  visible,
  onClose,
  contextText,
  courseCode,
  materialTitle,
}) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"ask" | "summarize" | "explain" | "teach" | "practice">("ask");

  useEffect(() => {
    if (visible) {
      setQuestion("");
      setResponse(null);
      setSessionId(null);
      setActiveAction("ask");
    }
  }, [visible]);

  const buildPrompt = (action: typeof activeAction) => {
    const trimmedQuestion = question.trim();
    const safeContext = contextText.trim();
    const materialLine = materialTitle ? `Material: ${materialTitle}\n` : "";

    switch (action) {
      case "summarize":
        return `${materialLine}Summarize this material context clearly for a student.\n\nContext:\n${safeContext}`;
      case "explain":
        return `${materialLine}Explain this material context step by step. Use simple language and connect it to ${courseCode || "this course"}.\n\nContext:\n${safeContext}`;
      case "teach":
        return `${materialLine}Teach this material context in depth like a patient university tutor. Start from intuition, then definitions, examples, likely exam angles, and common mistakes.\n\nContext:\n${safeContext}`;
      case "practice":
        return `${materialLine}Create a short CBT-style practice from this material context. Give 5 multiple-choice questions with options, answers, and explanations.\n\nContext:\n${safeContext}`;
      case "ask":
      default:
        return `${materialLine}Use this material context, then answer the student's question.\n\nContext:\n${safeContext}\n\nStudent question:\n${trimmedQuestion}`;
    }
  };

  const handleAction = async (action: typeof activeAction = activeAction) => {
    if (action === "ask" && !question.trim()) return;
    if (!contextText.trim()) return;

    Keyboard.dismiss();
    setLoading(true);
    setActiveAction(action);
    try {
      const activeSessionId = sessionId || (
        await sessionService.createSession({
          session_type: "STUDY",
          course_code: courseCode || "GENERAL",
          reply_mode: action === "practice" ? "QUESTION" : "STUDY",
        })
      ).id;

      if (!sessionId) setSessionId(activeSessionId);

      const aiMessage = await sessionService.sendMessage(activeSessionId, {
        content: buildPrompt(action),
        reply_mode: action === "practice" ? "QUESTION" : "STUDY",
      });

      setResponse(aiMessage.content);
    } catch (error) {
      console.error("Failed to ask Akademi:", error);
      setResponse("I could not reach Akademi AI for this material yet. Please try again in a moment.");
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
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
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
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.contextBox}>
                <Text style={[styles.contextLabel, typography.mono]}>CONTEXT</Text>
                <Text style={[styles.contextText, typography.bodySmall]} numberOfLines={3}>
                  {materialTitle ? `${materialTitle}\n` : ""}{contextText}
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

              {response ? (
                <View style={styles.responseContainer}>
                  <View style={styles.aiHeader}>
                    <Avatar size={24} name="Akademi" />
                    <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700", marginLeft: 8 }]}>
                      Akademi AI
                    </Text>
                  </View>
                  <Text style={[styles.responseText, typography.bodySmall]}>
                    {response}
                  </Text>
                  <View style={styles.responseActions}>
                    <Button
                      label="Ask another"
                      variant="ghost"
                      onPress={() => {
                        setResponse(null);
                        setQuestion("");
                        setActiveAction("ask");
                      }}
                      style={styles.clearBtn}
                    />
                    <Button
                      label="Done"
                      onPress={onClose}
                      style={styles.doneBtn}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.inputArea}>
                  <Text style={[styles.inputLabel, typography.bodySmall]}>
                    What would you like to know about this?
                  </Text>
                  <TextInput
                    style={[styles.input, typography.bodySmall]}
                    placeholder="Type your question here..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    value={question}
                    onChangeText={setQuestion}
                    autoFocus
                  />
                </View>
              )}
            </ScrollView>

            {!response && (
              <View style={styles.footer}>
                <Button
                  label="Ask Akademi"
                  onPress={() => handleAction("ask")}
                  loading={loading}
                  disabled={!question.trim()}
                  icon={<Send size={18} color="#FFFFFF" />}
                />
              </View>
            )}
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
    maxHeight: "72%",
    minHeight: "48%",
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
    backgroundColor: colors.primary + "22",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
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
  inputArea: {
    marginBottom: 20,
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
    minHeight: 100,
    textAlignVertical: "top",
  },
  responseContainer: {
    backgroundColor: colors.surfaceElevated,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  responseActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    justifyContent: "space-between",
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  aiName: {
    color: colors.primary,
  },
  responseText: {
    color: "#FFFFFF",
    lineHeight: 20,
  },
  clearBtn: {
    flex: 1,
  },
  doneBtn: {
    flex: 1,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
