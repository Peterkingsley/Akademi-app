import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Dimensions,
} from "react-native";
import { X, ChevronDown, Lightbulb } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { useNavigation } from "@react-navigation/native";
import api from "../../services/api";

type InputMode = "Type" | "Photo" | "Voice";
type AnswerMode = "DIRECT" | "STUDY";

const CAUSES = ["Assignment", "Personal Project", "Exam Practice", "General Interest"];
const TYPES = ["Math/Calculations", "Theoretical", "Programming", "Case Study"];

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const NAV_BAR_HEIGHT = 80;

export const SolveScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [inputMode, setInputMode] = useState<InputMode>("Type");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("DIRECT");
  const [question, setQuestion] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [course, setCourse] = useState("EEE 301");
  const [selectedCause, setSelectedCause] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [bottomSheetIndex, setBottomSheetIndex] = useState(2);

  const handleSolve = async () => {
    if (!question.trim() || !selectedCause || !selectedType) return;

    setLoading(true);
    try {
      const { data: session } = await api.post("/sessions", {
        session_type: "ASSIGNMENT",
        reply_mode: answerMode,
        course_code: course,
        metadata: {
          cause: selectedCause,
          type: selectedType,
        },
      });

      await api.post(`/sessions/${session.id}/messages`, {
        content: question,
      });

      navigation.navigate("AIProcessing", {
        type: "assignment",
        sessionId: session.id,
        reply_mode: answerMode,
      });
    } catch (error) {
      console.error("Failed to start session:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderTypeContent = () => (
    <View style={styles.tabContent}>
      <View style={styles.textAreaContainer}>
        <TextInput
          style={[styles.textArea, typography.body]}
          placeholder="Type or paste your assignment question here..."
          placeholderTextColor={colors.textMuted}
          multiline
          value={question}
          onChangeText={setQuestion}
          textAlignVertical="top"
        />
      </View>
      <View style={styles.hintRow}>
        <Lightbulb size={16} color={colors.textMuted} />
        <Text style={[styles.hintText, typography.caption]}>
          Be specific — include the full question for best results
        </Text>
      </View>
    </View>
  );

  const renderChipSelector = (
    label: string,
    options: string[],
    selected: string | null,
    onSelect: (val: string) => void
  ) => (
    <View style={styles.selectionSection}>
      <Text style={[styles.sectionLabel, typography.mono]}>{label.toUpperCase()}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.chip, selected === opt && styles.activeChip]}
          >
            <Text
              style={[
                styles.chipText,
                typography.caption,
                { color: selected === opt ? "#FFFFFF" : colors.textSecondary },
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Screen style={styles.screen}>
      <BottomSheet
        snapPoints={["25%", "50%", SCREEN_HEIGHT - NAV_BAR_HEIGHT]}
        index={bottomSheetIndex}
        onClose={() => navigation.navigate("Home")}
      >
        <View style={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Solve Assignment</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Home")}>
            <X size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Course Selector */}
        <View style={styles.courseSelector}>
          <Text style={[styles.label, typography.caption]}>Solving for:</Text>
          <TouchableOpacity style={styles.coursePill}>
            <View style={styles.dot} />
            <Text style={[styles.courseText, typography.bodySmall]}>{course}</Text>
            <ChevronDown size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {renderChipSelector("Select Cause", CAUSES, selectedCause, setSelectedCause)}
        {renderChipSelector("Select Type", TYPES, selectedType, setSelectedType)}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {(["Type", "Photo", "Voice"] as InputMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.tabPill, inputMode === mode && styles.activeTabPill]}
              onPress={() => {
                if (mode === "Photo") {
                  navigation.navigate("Camera");
                } else {
                  setInputMode(mode);
                }
              }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  typography.bodySmall,
                  { color: inputMode === mode ? colors.textPrimary : colors.textSecondary },
                ]}
              >
                {mode}
              </Text>
              {inputMode === mode && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {inputMode === "Type" && renderTypeContent()}

        {/* Context Toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={[styles.toggleTitle, typography.body, { fontWeight: "700" }]}>
              Include my course context
            </Text>
            <Text style={[styles.toggleSubtext, typography.caption]}>
              Uses previous lectures & notes for the answer
            </Text>
          </View>
          <Switch
            value={includeContext}
            onValueChange={setIncludeContext}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Answer Mode */}
        <View style={styles.answerModeSection}>
          <Text style={[styles.sectionLabel, typography.mono]}>HOW DO YOU WANT THE ANSWER?</Text>
          <View style={styles.modePills}>
            <TouchableOpacity
              style={[styles.modePill, answerMode === "DIRECT" && styles.activeModePill]}
              onPress={() => setAnswerMode("DIRECT")}
            >
              <Text
                style={[
                  styles.modeLabel,
                  typography.bodySmall,
                  { color: answerMode === "DIRECT" ? colors.textPrimary : colors.textSecondary },
                ]}
              >
                ⚡ Direct Answer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modePill, answerMode === "STUDY" && styles.activeModePill]}
              onPress={() => setAnswerMode("STUDY")}
            >
              <Text
                style={[
                  styles.modeLabel,
                  typography.bodySmall,
                  { color: answerMode === "STUDY" ? colors.textPrimary : colors.textSecondary },
                ]}
              >
                📖 Study Mode
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Solve Button */}
        <Button
          label="Solve →"
          onPress={handleSolve}
          loading={loading}
          disabled={!question.trim() || !selectedCause || !selectedType}
          style={styles.solveButton}
        </View>
        />
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 20,
  },
  screen: {
    backgroundColor: "transparent",
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  courseSelector: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  label: {
    color: colors.textSecondary,
    marginRight: 12,
  },
  coursePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  courseText: {
    color: colors.textPrimary,
    marginRight: 8,
  },
  selectionSection: {
    marginBottom: 24,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 9,
  },
  tabsContainer: {
    flexDirection: "row",
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginRight: 24,
    position: "relative",
  },
  activeTabPill: {},
  tabLabel: {
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
  },
  tabContent: {
    marginBottom: 24,
  },
  textAreaContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    minHeight: 120,
    padding: 16,
    marginBottom: 8,
  },
  textArea: {
    color: colors.textPrimary,
    minHeight: 100,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hintText: {
    color: colors.textMuted,
    marginLeft: 8,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  toggleTitle: {
    color: colors.textPrimary,
  },
  toggleSubtext: {
    color: colors.textMuted,
    marginTop: 2,
  },
  answerModeSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 8.25,
    marginBottom: 8,
  },
  modePills: {
    flexDirection: "row",
    gap: 12,
  },
  modePill: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeModePill: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeLabel: {
    fontWeight: "600",
  },
  solveButton: {
    marginTop: 8,
    marginBottom: 16,
  },
});