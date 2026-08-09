import React, { useMemo, useState, useCallback } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import {
  BookOpen,
  Camera,
  ChevronDown,
  FileText,
  Mic,
  X,
  Zap,
  ArrowUp,
  Info,
} from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import api from "../../services/api";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { useVoiceComposer } from "../../hooks/useVoiceComposer";
import { appendTranscript } from "../../services/voice";
import { AnimatedPressable } from "../../components/ui/AnimatedPressable";

type AnswerMode = "DIRECT" | "STUDY";
type DetectedQuestion = { index: number; text: string };

const MAX_QUESTION_LENGTH = 6000;

export const SolveScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { photoUri, selectedCourseCode } = route.params || {};

  const [answerMode, setAnswerMode] = useState<AnswerMode>("DIRECT");
  const [question, setQuestion] = useState("");
  const [course, setCourse] = useState("Select Course");
  const [loading, setLoading] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [detectedQuestions, setDetectedQuestions] = useState<DetectedQuestion[] | null>(null);

  const hasQuestion = question.trim().length > 0;
  const courseCode = course === "Select Course" ? null : course;

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  React.useEffect(() => {
    if (photoUri) {
      setQuestion((prev) => prev || "Photo selected. Add the question details or any extra instruction here.");
    }
  }, [photoUri]);

  React.useEffect(() => {
    if (typeof selectedCourseCode === "string" && selectedCourseCode.trim()) {
      setCourse(selectedCourseCode.trim().toUpperCase());
    } else if (selectedCourseCode === null) {
      setCourse("Select Course");
    }
  }, [selectedCourseCode]);

  const {
    isRecording,
    isTranscribing: audioLoading,
    toggleRecording: handleVoicePress,
  } = useVoiceComposer({
    onTranscript: (transcript) => {
      setDetectedQuestions(null);
      setQuestion((prev) => appendTranscript(prev, transcript, true));
    },
    recordingName: "solve-voice.m4a",
    permissionMessage: "Allow microphone access so Akademi can capture your spoken question.",
    startErrorTitle: "Could not start recording",
    stopErrorTitle: "Voice solve failed",
  });

  const mergeIntoQuestion = (incomingText: string) => {
    const trimmed = incomingText.trim();
    if (!trimmed) return;

    setQuestion((prev) => {
      const existing = prev.trim();
      return existing ? `${existing}\n\n${trimmed}` : trimmed;
    });
  };

  const handleSolve = async () => {
    if (!hasQuestion) {
      Alert.alert("Enter your prompt", "Type or paste the assignment question or prompt before solving.");
      return;
    }

    setLoading(true);
    try {
      if (detectedQuestions && detectedQuestions.length > 1) {
        const { data: session } = await api.post("/sessions", {
          session_type: "ASSIGNMENT",
          reply_mode: answerMode,
          course_code: courseCode,
          metadata: { questions: detectedQuestions },
        });

        navigation.navigate("MultiQuestionSolve", {
          sessionId: session.id,
          questions: detectedQuestions,
        });
        return;
      }

      const { data: session } = await api.post("/sessions", {
        session_type: "ASSIGNMENT",
        reply_mode: answerMode,
        course_code: courseCode,
      });

      await api.post(
        `/sessions/${session.id}/messages`,
        { content: question.trim() },
        { timeout: 90000 }
      );

      navigation.navigate("AIProcessing", {
        type: "assignment",
        sessionId: session.id,
        reply_mode: answerMode,
        courseCode,
      });
    } catch (error: any) {
      Alert.alert(
        "Could not start solving",
        error?.response?.status === 503
          ? "Akademi is busy right now. Please wait a moment and tap Solve Now again."
          : error?.response?.data?.message || "Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoPress = () => navigation.navigate("Camera");

  const handleFilePress = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "text/markdown",
          "application/json",
          "text/csv",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setDocumentLoading(true);

      const formData = new FormData();
      formData.append("document", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);

      const { data } = await api.post("/sessions/ingest/document", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 90000,
      });

      const questions: DetectedQuestion[] = Array.isArray(data?.questions) ? data.questions : [];
      setDetectedQuestions(questions.length > 1 ? questions : null);
      mergeIntoQuestion(data?.extractedText || "");
    } catch (error: any) {
      Alert.alert(
        "Could not read file",
        error?.response?.data?.message || "Please try another PDF, DOCX, TXT, MD, JSON, or CSV file."
      );
    } finally {
      setDocumentLoading(false);
    }
  };

  return (
    <Screen hideHeader style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Solve it and learn it</Text>
          <AnimatedPressable
            onPress={() => navigation.navigate("Home")}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close Solve"
          >
            <X size={22} color={colors.textPrimary} />
          </AnimatedPressable>
        </View>

        <View style={styles.courseSelectorRow}>
          <Text style={styles.courseSelectorLabel}>Course context</Text>
          <AnimatedPressable
            style={[styles.coursePill, courseCode && styles.pillActive]}
            onPress={() => navigation.navigate("SolveCoursePicker", { selectedCourseCode: courseCode })}
            accessibilityRole="button"
            accessibilityLabel={courseCode ? `Course context: ${courseCode}` : "Select course context"}
            accessibilityHint="Opens your course list"
          >
            <Text style={[styles.pillText, courseCode && styles.pillTextActive]} numberOfLines={1}>
              {courseCode || "Select course"}
            </Text>
            <ChevronDown size={14} color={courseCode ? colors.primary : colors.textSecondary} />
          </AnimatedPressable>
        </View>

        <View style={styles.mainWorkspace} />

        <View style={[styles.omniboxContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {detectedQuestions && detectedQuestions.length > 1 && (
            <View style={styles.multiQuestionBanner}>
              <Info size={14} color={colors.primary} />
              <Text style={styles.multiQuestionText}>
                {detectedQuestions.length} questions detected. Solved one at a time.
              </Text>
            </View>
          )}

          <View style={styles.omnibox}>
            <TextInput
              style={styles.omniboxInput}
              placeholder={isRecording ? "Listening..." : "Paste or type your assignment question..."}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_QUESTION_LENGTH}
              value={question}
              onChangeText={(text) => {
                setDetectedQuestions(null);
                setQuestion(text);
              }}
              textAlignVertical="top"
              accessibilityLabel="Assignment question"
            />

            <View style={styles.omniboxToolbar}>
              <View style={styles.omniboxTools}>
                <AnimatedPressable
                  onPress={handlePhotoPress}
                  style={styles.toolIconWrap}
                  disabled={documentLoading || audioLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Take a photo of a question"
                  accessibilityState={{ disabled: documentLoading || audioLoading }}
                >
                  <Camera size={20} color={colors.textSecondary} />
                </AnimatedPressable>

                <AnimatedPressable
                  onPress={handleFilePress}
                  style={styles.toolIconWrap}
                  disabled={documentLoading || audioLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Attach a question document"
                  accessibilityState={{ disabled: documentLoading || audioLoading, busy: documentLoading }}
                >
                  {documentLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <FileText size={20} color={colors.textSecondary} />
                  )}
                </AnimatedPressable>

                <AnimatedPressable
                  onPress={handleVoicePress}
                  style={[styles.toolIconWrap, isRecording && styles.toolIconRecording]}
                  disabled={documentLoading || audioLoading}
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? "Stop recording question" : "Record question by voice"}
                  accessibilityState={{ disabled: documentLoading || audioLoading, busy: audioLoading }}
                >
                  {audioLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Mic size={20} color={isRecording ? "#EF4444" : colors.textSecondary} />
                  )}
                </AnimatedPressable>

                <AnimatedPressable
                  style={[styles.pill, answerMode === "STUDY" && styles.pillActive]}
                  onPress={() => setAnswerMode(answerMode === "DIRECT" ? "STUDY" : "DIRECT")}
                  accessibilityRole="button"
                  accessibilityLabel={`Answer mode: ${answerMode === "DIRECT" ? "Quick Solve" : "Step-by-Step"}`}
                  accessibilityHint="Switch answer mode"
                >
                  {answerMode === "DIRECT" ? (
                    <Zap size={14} color={colors.textSecondary} />
                  ) : (
                    <BookOpen size={14} color={colors.primary} />
                  )}
                  <Text style={[styles.pillText, answerMode === "STUDY" && styles.pillTextActive]}>
                    {answerMode === "DIRECT" ? "Quick Solve" : "Step-by-Step"}
                  </Text>
                </AnimatedPressable>

              </View>

              <AnimatedPressable
                style={[styles.solveButton, (!hasQuestion || loading) && styles.solveButtonDisabled]}
                onPress={handleSolve}
                disabled={!hasQuestion || loading}
                accessibilityRole="button"
                accessibilityLabel="Solve question"
                accessibilityState={{ disabled: !hasQuestion || loading, busy: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <ArrowUp size={20} color={colors.background} />
                )}
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

    </Screen>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    mainWorkspace: {
      flex: 1,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
    },
    headerEyebrow: {
      ...typography.label,
      color: colors.primary,
      letterSpacing: 0,
      marginBottom: 3,
    },
    headerTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      fontSize: 20,
    },
    closeButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    pillContainer: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    pill: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: "row",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginLeft: 4,
    },
    pillActive: {
      borderColor: "rgba(34,197,94,0.4)",
      backgroundColor: "rgba(34,197,94,0.1)",
    },
    coursePill: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: "row",
      gap: 4,
      maxWidth: 180,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    courseSelectorRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    courseSelectorLabel: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
    },
    pillText: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      fontSize: 12,
    },
    pillTextActive: {
      color: colors.primary,
    },
    omniboxContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    multiQuestionBanner: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: "rgba(34,197,94,0.12)",
      borderColor: "rgba(34,197,94,0.3)",
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    multiQuestionText: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "500",
    },
    omnibox: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      overflow: "hidden",
    },
    omniboxInput: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 24,
      maxHeight: 140,
      minHeight: 80,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    omniboxToolbar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 10,
      paddingHorizontal: 10,
      paddingTop: 4,
    },
    omniboxTools: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      flex: 1,
    },
    toolIconWrap: {
      alignItems: "center",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    toolIconRecording: {
      backgroundColor: "rgba(239,68,68,0.1)",
    },
    solveButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    solveButtonDisabled: {
      opacity: 0.5,
    },
  });
