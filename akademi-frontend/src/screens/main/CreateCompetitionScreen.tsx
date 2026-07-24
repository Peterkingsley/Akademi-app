import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Check,
  Clock,
  Globe,
  HelpCircle,
  Layers,
  Lock,
  Sparkles,
  Swords,
  Users,
  Zap,
} from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { competitionService, CompetitionFormat, CompetitionVisibility } from "../../services/competition";
import { useTheme } from "../../theme/ThemeContext";

const POPULAR_COURSE_CHIPS = ["GST 101", "EEE 301", "MTH 201", "PHY 101", "CSC 201"];

export const CreateCompetitionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [format, setFormat] = useState<CompetitionFormat>("SHARED_COURSE");
  const [visibility, setVisibility] = useState<CompetitionVisibility>("PRIVATE");
  const [questionCount, setQuestionCount] = useState("10");
  const [questionTimerSec, setQuestionTimerSec] = useState("20");
  const [creating, setCreating] = useState(false);

  const createRoom = async () => {
    const cleanCourseCode = courseCode.trim().toUpperCase();
    if (!cleanCourseCode) {
      Alert.alert("Course Code Required", "Please enter or select a course code for the match questions.");
      return;
    }

    try {
      setCreating(true);
      const room = await competitionService.createRoom({
        title: title.trim() || `${cleanCourseCode} Speed Battle`,
        format,
        visibility,
        shared_course_code: format === "SHARED_COURSE" ? cleanCourseCode : undefined,
        host_course_code: cleanCourseCode,
        question_count: Number(questionCount) || 10,
        question_timer_sec: Number(questionTimerSec) || 20,
      });
      navigation.replace("CompetitionLobby", { roomId: room.id });
    } catch (error: any) {
      Alert.alert(
        "Unable to create match",
        error?.response?.data?.message || "Please try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  const questionPresets = [
    { count: "5", label: "5 Qs", hint: "Sprint" },
    { count: "10", label: "10 Qs", hint: "Standard" },
    { count: "15", label: "15 Qs", hint: "Extended" },
    { count: "20", label: "20 Qs", hint: "Marathon" },
  ];

  const timerPresets = [
    { sec: "10", label: "10s", hint: "Blitz" },
    { sec: "15", label: "15s", hint: "Fast" },
    { sec: "20", label: "20s", hint: "Standard" },
    { sec: "30", label: "30s", hint: "Relaxed" },
  ];

  return (
    <Screen
      scrollable
      style={[styles.screen, { backgroundColor: colors.background }]}
      title="Create Match Room"
    >
      <View style={styles.container}>
        {/* Header Hero Section */}
        <View style={styles.heroHeader}>
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: "rgba(34, 197, 94, 0.15)", borderColor: "rgba(34, 197, 94, 0.3)" },
            ]}
          >
            <Swords size={26} color={colors.primary} />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Create Live Arena</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Set up a live speed battle, pick course questions, and invite classmates with a code.
            </Text>
          </View>
        </View>

        {/* Main Form Card */}
        <Card style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Match Title Input */}
          <Input
            label="Match Title (Optional)"
            placeholder="e.g. EEE 301 Midterm Battle"
            value={title}
            onChangeText={setTitle}
          />

          {/* Course Code Input + Quick Chips */}
          <View style={styles.fieldWrap}>
            <Input
              label={format === "SHARED_COURSE" ? "Shared Course Code *" : "Your Course Code *"}
              placeholder="e.g. GST 101"
              value={courseCode}
              onChangeText={(val) => setCourseCode(val.toUpperCase())}
              autoCapitalize="characters"
            />
            <View style={styles.courseChipRow}>
              <Text style={[styles.chipHintText, { color: colors.textMuted }]}>Quick Select:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {POPULAR_COURSE_CHIPS.map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    activeOpacity={0.8}
                    style={[
                      styles.courseChip,
                      {
                        backgroundColor: courseCode === chip ? colors.primary : colors.surfaceElevated,
                        borderColor: courseCode === chip ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setCourseCode(chip)}
                  >
                    <Text
                      style={[
                        styles.courseChipText,
                        { color: courseCode === chip ? "#04110A" : colors.textSecondary },
                      ]}
                    >
                      {chip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Question Count Presets */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Number of Questions</Text>
            <View style={styles.presetRow}>
              {questionPresets.map((preset) => {
                const isActive = questionCount === preset.count;
                return (
                  <TouchableOpacity
                    key={preset.count}
                    activeOpacity={0.8}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isActive ? colors.primary : colors.surfaceElevated,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setQuestionCount(preset.count)}
                  >
                    <Text style={[styles.presetTitle, { color: isActive ? "#04110A" : colors.textPrimary }]}>
                      {preset.label}
                    </Text>
                    <Text style={[styles.presetSub, { color: isActive ? "#04110A" : colors.textMuted }]}>
                      {preset.hint}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Question Timer Presets */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Timer per Question</Text>
            <View style={styles.presetRow}>
              {timerPresets.map((preset) => {
                const isActive = questionTimerSec === preset.sec;
                return (
                  <TouchableOpacity
                    key={preset.sec}
                    activeOpacity={0.8}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isActive ? colors.primary : colors.surfaceElevated,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setQuestionTimerSec(preset.sec)}
                  >
                    <Text style={[styles.presetTitle, { color: isActive ? "#04110A" : colors.textPrimary }]}>
                      {preset.label}
                    </Text>
                    <Text style={[styles.presetSub, { color: isActive ? "#04110A" : colors.textMuted }]}>
                      {preset.hint}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Match Format Picker */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Match Format</Text>
            <View style={styles.segmentRow}>
              {[
                {
                  label: "Shared Course",
                  sub: "Both players answer from 1 course",
                  value: "SHARED_COURSE",
                },
                {
                  label: "Dual Course",
                  sub: "Host & opponent course mixed",
                  value: "DUAL_COURSE",
                },
              ].map((item) => {
                const isActive = format === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    activeOpacity={0.85}
                    style={[
                      styles.segmentCard,
                      {
                        backgroundColor: isActive ? "rgba(34, 197, 94, 0.12)" : colors.surfaceElevated,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setFormat(item.value as CompetitionFormat)}
                  >
                    <Text style={[styles.segmentTitle, { color: isActive ? colors.primary : colors.textPrimary }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.segmentSub, { color: colors.textSecondary }]}>{item.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Visibility Picker */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Room Visibility</Text>
            <View style={styles.segmentRow}>
              {[
                { label: "Private Code", sub: "Code invite only", value: "PRIVATE" },
                { label: "Public Arena", sub: "Listed in public rooms", value: "PUBLIC" },
              ].map((item) => {
                const isActive = visibility === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    activeOpacity={0.85}
                    style={[
                      styles.segmentCard,
                      {
                        backgroundColor: isActive ? "rgba(34, 197, 94, 0.12)" : colors.surfaceElevated,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setVisibility(item.value as CompetitionVisibility)}
                  >
                    <Text style={[styles.segmentTitle, { color: isActive ? colors.primary : colors.textPrimary }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.segmentSub, { color: colors.textSecondary }]}>{item.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Live Preview Summary Box */}
          <View style={[styles.summaryBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.summaryHeading, { color: colors.textPrimary }]}>Live Match Summary</Text>
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              {`• Course: ${courseCode.trim().toUpperCase() || "Not set"}`}
            </Text>
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              {`• Pace: ${questionCount} Questions • ${questionTimerSec}s per Q`}
            </Text>
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              {`• Mode: ${format === "SHARED_COURSE" ? "Shared Course" : "Dual Course"} • ${visibility === "PRIVATE" ? "Private (Code Only)" : "Public Arena"}`}
            </Text>
          </View>

          {/* Action Create Button */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.createButton,
              { backgroundColor: !courseCode.trim() ? colors.surfaceElevated : colors.primary },
            ]}
            onPress={createRoom}
            disabled={creating || !courseCode.trim()}
          >
            {creating ? (
              <ActivityIndicator color="#04110A" size="small" />
            ) : (
              <Zap size={18} color={!courseCode.trim() ? colors.textMuted : "#04110A"} />
            )}
            <Text
              style={[
                styles.createButtonText,
                { color: !courseCode.trim() ? colors.textMuted : "#04110A" },
              ]}
            >
              {creating ? "Launching Room..." : "Create Match Arena"}
            </Text>
          </TouchableOpacity>
        </Card>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 18,
    gap: 16,
    paddingBottom: 36,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
    marginBottom: 2,
  },
  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextWrap: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  formCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  fieldWrap: {
    gap: 6,
  },
  courseChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  chipHintText: {
    fontSize: 11,
    fontWeight: "700",
  },
  chipScroll: {
    gap: 6,
  },
  courseChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  courseChipText: {
    fontSize: 11,
    fontWeight: "800",
  },
  section: {
    gap: 8,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  presetSub: {
    fontSize: 10,
    fontWeight: "600",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 4,
  },
  segmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  segmentTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  segmentSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  summaryBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    marginTop: 4,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  summaryHeading: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 17,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
