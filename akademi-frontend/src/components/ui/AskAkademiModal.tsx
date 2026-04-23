import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { X, Send, Sparkles } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "./Button";
import { Avatar } from "./Avatar";
import { sessionService, Message } from "../../services/session";

interface AskAkademiModalProps {
  visible: boolean;
  onClose: () => void;
  contextText: string;
  courseCode?: string;
}

export const AskAkademiModal: React.FC<AskAkademiModalProps> = ({
  visible,
  onClose,
  contextText,
  courseCode,
}) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setQuestion("");
      setResponse(null);
      setSessionId(null);
    }
  }, [visible]);

  const handleAsk = async () => {
    if (!question.trim()) return;

    setLoading(true);
    try {
      // In a real implementation, we might create a special session type or use an existing one
      // For this feature, we'll simulate the AI interaction
      // We send the contextText along with the question

      // Mocking AI response for now as we don't have a dedicated "quick ask" endpoint yet
      // but we could use createSession with metadata
      setTimeout(() => {
        setResponse(`Based on the text: "${contextText.substring(0, 50)}...", here is the answer: This concept refers to the fundamental principles of ${courseCode || 'the subject'}. It is important because it connects to later topics in the course.`);
        setLoading(false);
      }, 1500);
    } catch (error) {
      console.error("Failed to ask Akademi:", error);
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
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

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.contextBox}>
              <Text style={[styles.contextLabel, typography.mono]}>CONTEXT</Text>
              <Text style={[styles.contextText, typography.bodySmall]} numberOfLines={3}>
                "{contextText}"
              </Text>
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
                <Button
                  label="Clear and ask another"
                  variant="ghost"
                  onPress={() => setResponse(null)}
                  style={styles.clearBtn}
                />
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
                onPress={handleAsk}
                loading={loading}
                disabled={!question.trim()}
                icon={<Send size={18} color="#FFFFFF" />}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: "80%",
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
    padding: 20,
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
    marginTop: 16,
    alignSelf: "flex-start",
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
