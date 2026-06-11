import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  FileQuestion,
  Lightbulb,
  MessageSquareText,
  X,
  Zap,
} from "lucide-react-native";

import { CoursePickerModal } from "../../components/ui/CoursePickerModal";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

type AnswerMode = "DIRECT" | "STUDY";

const CAUSES = ["Assignment", "Personal Project", "Exam Practice", "General Interest"];
const TYPES = ["Calculation", "Theory", "Programming", "Case Study"];

export const SolveScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { photoUri } = route.params || {};
  const { user } = useAuthStore();
  const userCourses = (user as any)?.courses || [];

  const [answerMode, setAnswerMode] = useState<AnswerMode>("DIRECT");
  const [question, setQuestion] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [course, setCourse] = useState(userCourses[0] || "Select Course");
  const [selectedCause, setSelectedCause] = useState("Assignment");
  const [selectedType, setSelectedType] = useState("Theory");
  const [loading, setLoading] = useState(false);
  const [isCoursePickerVisible, setIsCoursePickerVisible] = useState(false);
  const hasQuestion = question.trim().length > 0;
  const hasCourse = course !== "Select Course";
  const courseCode = hasCourse ? course : null;

  useEffect(() => {
    if (photoUri) {
      setQuestion((prev) => prev || "Photo selected. Add any extra instruction before solving.");
    }
  }, [photoUri]);

  const handleSolve = async () => {
    if (!hasQuestion) {
      Alert.alert("Enter the question", "Type or paste the assignment question, then tap Solve assignment again.");
      return;
    }

    if (!selectedCause || !selectedType) {
      Alert.alert("Add the missing details", "Choose why you are solving this and the question type.");
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await api.post("/sessions", {
        session_type: "ASSIGNMENT",
        reply_mode: answerMode,
        course_code: courseCode,
        metadata: {
          cause: selectedCause,
          type: selectedType,
          includeContext,
        },
      });

      await api.post(`/sessions/${session.id}/messages`, {
        content: question.trim(),
      });

      navigation.navigate("AIProcessing", {
        type: "assignment",
        sessionId: session.id,
        reply_mode: answerMode,
        courseCode,
      });
    } catch (error: any) {
      Alert.alert(
        "Could not start solving",
        error?.response?.data?.message || "Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const renderChipSelector = (
    label: string,
    options: string[],
    selected: string,
    onSelect: (val: string) => void
  ) => (
    <View style={styles.selectionSection}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = selected === option;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onSelect(option)}
              style={[styles.chip, active && styles.activeChip]}
              activeOpacity={0.8}
            >
              {active && <Check size={13} color={colors.background} />}
              <Text style={[styles.chipText, active && styles.activeChipText]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen hideHeader style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>Assignment Solver</Text>
          <Text style={styles.headerTitle}>Ask Akademi to solve it</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Home")} style={styles.closeButton}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.coursePanel}>
          <View style={styles.courseIcon}>
            <BookOpen size={20} color={colors.primary} />
          </View>
          <View style={styles.courseCopy}>
            <Text style={styles.panelLabel}>Solving for</Text>
            <Text style={styles.courseText} numberOfLines={1}>
              {hasCourse ? course : "General question"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.changeButton}
            onPress={() => setIsCoursePickerVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.changeText}>Change</Text>
            <ChevronDown size={15} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeGrid}>
          <TouchableOpacity activeOpacity={0.86} style={styles.primaryModeCard}>
            <MessageSquareText size={22} color={colors.primary} />
            <Text style={styles.modeTitle}>Type question</Text>
            <Text style={styles.modeText}>Best for pasted questions, theory, calculations, and code.</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.modeCard}
            onPress={() => navigation.navigate("Camera")}
          >
            <Camera size={22} color="#38BDF8" />
            <Text style={styles.modeTitle}>Use photo</Text>
            <Text style={styles.modeText}>Snap a question when typing is too slow.</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <FileQuestion size={18} color={colors.primary} />
            <Text style={styles.questionLabel}>Question</Text>
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Type or paste the full assignment question here..."
            placeholderTextColor={colors.textMuted}
            multiline
            value={question}
            onChangeText={setQuestion}
            textAlignVertical="top"
          />
          <View style={styles.hintRow}>
            <Lightbulb size={15} color={colors.textMuted} />
            <Text style={styles.hintText}>Include all values, instructions, and lecturer constraints.</Text>
          </View>
        </View>

        {renderChipSelector("Why are you solving this?", CAUSES, selectedCause, setSelectedCause)}
        {renderChipSelector("Question type", TYPES, selectedType, setSelectedType)}

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Use my course context</Text>
            <Text style={styles.toggleSubtext}>
              {hasCourse
                ? "Akademi can consider your selected course while answering."
                : "Optional. Select a course only when the question needs course context."}
            </Text>
          </View>
          <Switch
            value={includeContext}
            onValueChange={setIncludeContext}
            disabled={!hasCourse}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.answerModeSection}>
          <Text style={styles.sectionLabel}>Answer style</Text>
          <View style={styles.answerCards}>
            <TouchableOpacity
              style={[styles.answerCard, answerMode === "DIRECT" && styles.activeAnswerCard]}
              onPress={() => setAnswerMode("DIRECT")}
              activeOpacity={0.85}
            >
              <Zap size={18} color={answerMode === "DIRECT" ? colors.background : colors.primary} />
              <Text style={[styles.answerTitle, answerMode === "DIRECT" && styles.activeAnswerText]}>
                Direct answer
              </Text>
              <Text style={[styles.answerText, answerMode === "DIRECT" && styles.activeAnswerSubtext]}>
                Fast result with key steps.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.answerCard, answerMode === "STUDY" && styles.activeAnswerCard]}
              onPress={() => setAnswerMode("STUDY")}
              activeOpacity={0.85}
            >
              <BookOpen size={18} color={answerMode === "STUDY" ? colors.background : colors.primary} />
              <Text style={[styles.answerTitle, answerMode === "STUDY" && styles.activeAnswerText]}>
                Teach me
              </Text>
              <Text style={[styles.answerText, answerMode === "STUDY" && styles.activeAnswerSubtext]}>
                Slower explanation for learning.
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Button
          label="Solve assignment"
          onPress={handleSolve}
          loading={loading}
          disabled={loading}
          style={styles.solveButton}
        />
      </ScrollView>

      <CoursePickerModal
        visible={isCoursePickerVisible}
        onClose={() => setIsCoursePickerVisible(false)}
        onSelect={setCourse}
        selectedCourse={course}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
    paddingHorizontal: 18,
    paddingTop: 0,
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
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 36,
  },
  coursePanel: {
    alignItems: "center",
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 14,
    padding: 14,
  },
  courseIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  courseCopy: {
    flex: 1,
    minWidth: 0,
  },
  panelLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 3,
  },
  courseText: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14,
  },
  changeButton: {
    alignItems: "center",
    flexDirection: "row",
    paddingLeft: 10,
  },
  changeText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    marginRight: 4,
  },
  modeGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  primaryModeCard: {
    backgroundColor: colors.surface,
    borderColor: "rgba(34,197,94,0.28)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  modeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  modeTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 10,
  },
  modeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 14,
  },
  questionHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 10,
  },
  questionLabel: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14,
    marginLeft: 8,
  },
  textArea: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 124,
    padding: 0,
  },
  hintRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 10,
  },
  hintText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    marginLeft: 7,
  },
  selectionSection: {
    marginBottom: 18,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 0,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  activeChipText: {
    color: colors.background,
    marginLeft: 5,
  },
  toggleRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    padding: 14,
  },
  toggleCopy: {
    flex: 1,
    marginRight: 14,
  },
  toggleTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 4,
  },
  toggleSubtext: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  answerModeSection: {
    marginBottom: 18,
  },
  answerCards: {
    flexDirection: "row",
    gap: 10,
  },
  answerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 13,
  },
  activeAnswerCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  answerTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 13,
    marginTop: 8,
  },
  activeAnswerText: {
    color: colors.background,
  },
  answerText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  activeAnswerSubtext: {
    color: "rgba(11,11,11,0.72)",
  },
  solveButton: {
    borderRadius: 8,
    marginTop: 4,
  },
});
