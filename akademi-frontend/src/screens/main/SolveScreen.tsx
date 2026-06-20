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
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  FileText,
  Mic,
  Sparkles,
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

const EXAMPLE_PROMPTS = [
  "Solve x² + 5x + 6 = 0",
  "Explain photosynthesis",
  "Write a 500-word essay on inflation",
  "Summarize this research paper",
];

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

  const handleFilePress = () => {
    Alert.alert("PDF / File", "Document solve upload is the next step on this screen.");
  };

  const handleVoicePress = () => {
    Alert.alert("Voice solve", "Voice question input is coming next on this solve flow.");
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
            <View style={styles.promptHintRow}>
              <Sparkles size={15} color={colors.textMuted} />
              <Text style={styles.promptHint}>Ask anything. We’re here to help!</Text>
            </View>
            <Text style={styles.counter}>{questionLength} / {MAX_QUESTION_LENGTH}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.toolCard} activeOpacity={0.86} onPress={handlePhotoPress}>
            <View style={[styles.toolIconWrap, styles.greenToolIcon]}>
              <Camera size={20} color={colors.primary} />
            </View>
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>Photo</Text>
              <Text style={styles.toolSubtitle}>Snap or upload</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolCard} activeOpacity={0.86} onPress={handleFilePress}>
            <View style={[styles.toolIconWrap, styles.purpleToolIcon]}>
              <FileText size={20} color="#8B5CF6" />
            </View>
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>PDF / File</Text>
              <Text style={styles.toolSubtitle}>Upload document</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolCard} activeOpacity={0.86} onPress={handleVoicePress}>
            <View style={[styles.toolIconWrap, styles.blueToolIcon]}>
              <Mic size={20} color="#6366F1" />
            </View>
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>Voice</Text>
              <Text style={styles.toolSubtitle}>Speak your question</Text>
            </View>
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

        <View style={styles.answerSection}>
          <Text style={styles.sectionHeading}>Answer style</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[styles.segment, answerMode === "DIRECT" && styles.segmentActive]}
              activeOpacity={0.86}
              onPress={() => setAnswerMode("DIRECT")}
            >
              <View style={styles.segmentHeader}>
                <Zap size={20} color={answerMode === "DIRECT" ? colors.primary : "#7EA6FF"} />
                <Text style={[styles.segmentTitle, answerMode === "DIRECT" && styles.segmentTitleActive]}>
                  Quick Solve
                </Text>
              </View>
              <Text style={styles.segmentText}>Fast answer with key steps</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segment, answerMode === "STUDY" && styles.segmentActive]}
              activeOpacity={0.86}
              onPress={() => setAnswerMode("STUDY")}
            >
              <View style={styles.segmentHeader}>
                <BookOpen size={20} color={answerMode === "STUDY" ? colors.primary : "#7EA6FF"} />
                <Text style={[styles.segmentTitle, answerMode === "STUDY" && styles.segmentTitleActive]}>
                  Learn Step-by-Step
                </Text>
              </View>
              <Text style={styles.segmentText}>Detailed explanation & why</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.examplesSection}>
          <View style={styles.examplesHeader}>
            <Sparkles size={15} color={colors.primary} />
            <Text style={styles.examplesTitle}>Try these examples</Text>
          </View>
          <View style={styles.examplesWrap}>
            {EXAMPLE_PROMPTS.map((example) => (
              <TouchableOpacity
                key={example}
                style={styles.exampleChip}
                activeOpacity={0.82}
                onPress={() => setQuestion(example)}
              >
                <Text style={styles.exampleText}>{example}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.solveNowButton, loading && styles.solveNowButtonDisabled]}
          activeOpacity={0.88}
          onPress={handleSolve}
          disabled={loading}
        >
          <View style={styles.solveNowCopy}>
            <View style={styles.solveNowTitleRow}>
              <Sparkles size={18} color={colors.background} />
              <Text style={styles.solveNowTitle}>{loading ? "Working..." : "Solve Now"}</Text>
            </View>
            <Text style={styles.solveNowSubtitle}>Get your answer instantly</Text>
          </View>
          <View style={styles.solveNowArrow}>
            <ArrowRight size={20} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </ScrollView>
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
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 18,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
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
    promptCard: {
      backgroundColor: colors.surface,
      borderColor: "rgba(34,197,94,0.7)",
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 14,
      minHeight: 154,
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
      justifyContent: "space-between",
      paddingBottom: 10,
      paddingTop: 2,
    },
    promptHintRow: {
      alignItems: "center",
      flexDirection: "row",
      flex: 1,
    },
    promptHint: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      marginLeft: 8,
    },
    counter: {
      ...typography.bodySmall,
      color: colors.textMuted,
      fontSize: 12,
      marginLeft: 12,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 14,
    },
    toolCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      minHeight: 76,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    toolIconWrap: {
      alignItems: "center",
      borderRadius: 16,
      height: 30,
      justifyContent: "center",
      marginBottom: 8,
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
    toolCopy: {
      flex: 1,
    },
    toolTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 13,
      marginBottom: 2,
    },
    toolSubtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 15,
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
      marginBottom: 12,
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
    answerSection: {
      marginBottom: 12,
    },
    sectionHeading: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 14,
      marginBottom: 8,
    },
    segmentedControl: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      overflow: "hidden",
      padding: 3,
    },
    segment: {
      borderRadius: 15,
      flex: 1,
      minHeight: 72,
      paddingHorizontal: 12,
      paddingVertical: 10,
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
      marginBottom: 6,
    },
    segmentTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 13,
    },
    segmentTitleActive: {
      color: colors.primary,
    },
    segmentText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
    },
    examplesSection: {
      marginBottom: 14,
    },
    examplesHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginBottom: 8,
    },
    examplesTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 14,
    },
    examplesWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    exampleChip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      maxWidth: "48%",
      minHeight: 46,
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    exampleText: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 16,
    },
    solveNowButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 2,
      minHeight: 68,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    solveNowButtonDisabled: {
      opacity: 0.65,
    },
    solveNowCopy: {
      flex: 1,
    },
    solveNowTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginBottom: 2,
    },
    solveNowTitle: {
      ...typography.h2,
      color: colors.background,
      fontSize: 18,
    },
    solveNowSubtitle: {
      ...typography.body,
      color: "rgba(10,10,10,0.72)",
      fontSize: 12,
    },
    solveNowArrow: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.2)",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      marginLeft: 12,
      width: 40,
    },
  });
