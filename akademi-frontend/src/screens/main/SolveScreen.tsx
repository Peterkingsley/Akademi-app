import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import {
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  FileText,
  Mic,
  X,
  Zap,
} from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

type AnswerMode = "DIRECT" | "STUDY";

const MAX_QUESTION_LENGTH = 6000;

export const SolveScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { photoUri } = route.params || {};
  const { user } = useAuthStore();
  const userCourses = (user as any)?.courses || [];

  const [answerMode, setAnswerMode] = useState<AnswerMode>("DIRECT");
  const [question, setQuestion] = useState("");
  const [course, setCourse] = useState("Select Course");
  const [loading, setLoading] = useState(false);
  const [isCoursePickerVisible, setIsCoursePickerVisible] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const hasQuestion = question.trim().length > 0;
  const hasCourse = course !== "Select Course";
  const courseCode = hasCourse ? course : null;
  const questionLength = question.length;

  const courseOptions = [
    "Select Course",
    ...Array.from(
      new Set<string>(
        userCourses.filter(
          (item: unknown): item is string => typeof item === "string" && item.trim().length > 0
        )
      )
    ),
  ];

  useEffect(() => {
    if (photoUri) {
      setQuestion((prev) => prev || "Photo selected. Add the question details or any extra instruction here.");
    }
  }, [photoUri]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

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
      const { data: session } = await api.post("/sessions", {
        session_type: "ASSIGNMENT",
        reply_mode: answerMode,
        course_code: courseCode,
      });

      await api.post(
        `/sessions/${session.id}/messages`,
        {
          content: question.trim(),
        },
        {
          timeout: 90000,
        }
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

  const handlePhotoPress = () => {
    navigation.navigate("Camera");
  };

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

  const handleVoicePress = async () => {
    if (audioLoading) return;

    if (recording) {
      setAudioLoading(true);
      try {
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        const uri = recording.getURI();
        setRecording(null);

        if (!uri) {
          throw new Error("Recording could not be saved.");
        }

        const formData = new FormData();
        formData.append("audio", {
          uri,
          name: "solve-voice.m4a",
          type: "audio/mp4",
        } as any);

        const { data } = await api.post("/sessions/ingest/audio", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 90000,
        });

        mergeIntoQuestion(data?.transcript || "");
      } catch (error: any) {
        Alert.alert(
          "Voice solve failed",
          error?.response?.data?.message || error?.message || "Please try again or type the question instead."
        );
      } finally {
        setAudioLoading(false);
      }
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone needed", "Allow microphone access so Akademi can capture your spoken question.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync({
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });
      await nextRecording.startAsync();
      setRecording(nextRecording);
    } catch (error: any) {
      Alert.alert(
        "Could not start recording",
        error?.message || "Please check microphone access and try again."
      );
    }
  };

  return (
    <Screen hideHeader style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>Assignment Help</Text>
            <Text style={styles.headerTitle}>Solve it and learn it</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("Home")} style={styles.closeButton}>
            <X size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.courseStrip}>
          <View style={styles.courseInfo}>
            <Text style={styles.sectionLabel}>Course context</Text>
            <Text style={styles.courseValue}>{hasCourse ? course : "General question"}</Text>
          </View>
          <TouchableOpacity
            style={styles.changeButton}
            activeOpacity={0.84}
            onPress={() => setIsCoursePickerVisible((visible) => !visible)}
          >
            <Text style={styles.changeText}>Change</Text>
            <ChevronDown size={15} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {isCoursePickerVisible && (
          <View style={styles.inlineCoursePicker}>
            <View style={styles.inlineCourseGrid}>
              {courseOptions.map((item) => {
                const selected = item === course;
                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.82}
                    style={[styles.inlineCourseChip, selected && styles.inlineCourseChipActive]}
                    onPress={() => {
                      setCourse(item);
                      setIsCoursePickerVisible(false);
                    }}
                  >
                    {selected && <Check size={13} color={colors.background} />}
                    <Text style={[styles.inlineCourseText, selected && styles.inlineCourseTextActive]}>
                      {item === "Select Course" ? "No course context" : item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.promptCard}>
          <View style={styles.promptGlow} />
          <TextInput
            style={styles.textArea}
            placeholder="Paste your assignment question here..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_QUESTION_LENGTH}
            value={question}
            onChangeText={setQuestion}
            textAlignVertical="top"
          />

          <View style={styles.promptFooter}>
            <Text style={styles.counter}>{questionLength} / {MAX_QUESTION_LENGTH}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.toolCard} activeOpacity={0.86} onPress={handlePhotoPress}>
            <View style={[styles.toolIconWrap, styles.greenToolIcon]}>
              <Camera size={18} color={colors.primary} />
            </View>
            <Text style={styles.toolTitle}>Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolCard} activeOpacity={0.86} onPress={handleFilePress}>
            <View style={[styles.toolIconWrap, styles.purpleToolIcon]}>
              <FileText size={18} color="#8B5CF6" />
            </View>
            <Text style={styles.toolTitle}>{documentLoading ? "Reading..." : "PDF / File"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolCard} activeOpacity={0.86} onPress={handleVoicePress}>
            <View style={[styles.toolIconWrap, styles.blueToolIcon]}>
              <Mic size={18} color="#6366F1" />
            </View>
            <Text style={styles.toolTitle}>
              {audioLoading ? "Transcribing..." : recording ? "Stop" : "Voice"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.answerSection}>
          <Text style={styles.sectionHeading}>Answer style</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[styles.segment, answerMode === "DIRECT" && styles.segmentActive]}
              activeOpacity={0.86}
              onPress={() => setAnswerMode("DIRECT")}
            >
              <View style={styles.segmentHeader}>
                <Zap size={18} color={answerMode === "DIRECT" ? colors.primary : "#7EA6FF"} />
                <Text style={[styles.segmentTitle, answerMode === "DIRECT" && styles.segmentTitleActive]}>
                  Quick Solve
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segment, answerMode === "STUDY" && styles.segmentActive]}
              activeOpacity={0.86}
              onPress={() => setAnswerMode("STUDY")}
            >
              <View style={styles.segmentHeader}>
                <BookOpen size={18} color={answerMode === "STUDY" ? colors.primary : "#7EA6FF"} />
                <Text style={[styles.segmentTitle, answerMode === "STUDY" && styles.segmentTitleActive]}>
                  Learn Step-by-Step
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomCtaWrap}>
        <TouchableOpacity
          style={[styles.solveNowButton, loading && styles.solveNowButtonDisabled]}
          activeOpacity={0.88}
          onPress={handleSolve}
          disabled={loading}
        >
          <Text style={styles.solveNowTitle}>{loading ? "Working..." : "Solve Now"}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 110,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
      paddingTop: 2,
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
    courseStrip: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    courseInfo: {
      flex: 1,
      minWidth: 0,
    },
    sectionLabel: {
      ...typography.label,
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
      marginBottom: 2,
      textTransform: "none",
    },
    courseValue: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 14,
    },
    changeButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    changeText: {
      ...typography.bodySmall,
      color: colors.primary,
      fontSize: 11,
      fontWeight: "700",
    },
    inlineCoursePicker: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 10,
      padding: 10,
    },
    inlineCourseGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    inlineCourseChip: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    inlineCourseChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    inlineCourseText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    inlineCourseTextActive: {
      color: colors.background,
      marginLeft: 5,
    },
    promptCard: {
      backgroundColor: colors.surface,
      borderColor: "rgba(34,197,94,0.7)",
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 12,
      minHeight: 150,
      overflow: "hidden",
      paddingHorizontal: 14,
      paddingTop: 14,
      position: "relative",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
    },
    promptGlow: {
      backgroundColor: "rgba(34,197,94,0.16)",
      height: 24,
      left: 14,
      position: "absolute",
      top: 14,
      width: 3,
    },
    textArea: {
      ...typography.body,
      color: colors.textPrimary,
      flex: 1,
      fontSize: 16,
      lineHeight: 24,
      minHeight: 92,
      paddingBottom: 10,
      paddingLeft: 12,
      paddingRight: 0,
      paddingTop: 0,
    },
    promptFooter: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingBottom: 8,
      paddingTop: 0,
    },
    counter: {
      ...typography.bodySmall,
      color: colors.textMuted,
      fontSize: 12,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    toolCard: {
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      minHeight: 60,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    toolIconWrap: {
      alignItems: "center",
      borderRadius: 16,
      height: 30,
      justifyContent: "center",
      marginBottom: 6,
      width: 30,
    },
    greenToolIcon: {
      backgroundColor: "rgba(34,197,94,0.12)",
    },
    purpleToolIcon: {
      backgroundColor: "rgba(139,92,246,0.12)",
    },
    blueToolIcon: {
      backgroundColor: "rgba(99,102,241,0.12)",
    },
    toolTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 12,
    },
    answerSection: {
      marginBottom: 10,
    },
    sectionHeading: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 14,
      marginBottom: 6,
    },
    segmentedControl: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      overflow: "hidden",
      padding: 3,
    },
    segment: {
      borderRadius: 11,
      flex: 1,
      minHeight: 40,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    segmentActive: {
      backgroundColor: "rgba(34,197,94,0.1)",
      borderColor: "rgba(34,197,94,0.4)",
      borderWidth: 1,
    },
    segmentHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    segmentTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 13,
    },
    segmentTitleActive: {
      color: colors.primary,
    },
    solveNowButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 18,
      justifyContent: "center",
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    solveNowButtonDisabled: {
      opacity: 0.65,
    },
    solveNowTitle: {
      ...typography.h2,
      color: colors.background,
      fontSize: 18,
    },
    bottomCtaWrap: {
      backgroundColor: colors.background,
      borderTopColor: "rgba(255,255,255,0.06)",
      borderTopWidth: 1,
      bottom: 0,
      left: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
      position: "absolute",
      right: 0,
    },
  });
