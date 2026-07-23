import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Clock, Globe, HelpCircle, Layers, Lock, Sparkles, Swords, Zap } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { competitionService, CompetitionFormat, CompetitionVisibility } from "../../services/competition";
import { useTheme } from "../../theme/ThemeContext";

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
    try {
      setCreating(true);
      const room = await competitionService.createRoom({
        title: title.trim() || "Speed Battle",
        format,
        visibility,
        shared_course_code: format === "SHARED_COURSE" ? courseCode.trim().toUpperCase() : undefined,
        host_course_code: courseCode.trim().toUpperCase(),
        question_count: Number(questionCount) || 10,
        question_timer_sec: Number(questionTimerSec) || 20,
      });
      navigation.replace("CompetitionLobby", { roomId: room.id });
    } catch (error: any) {
      Alert.alert("Unable to create match", error?.response?.data?.message || "Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const questionPresets = ["5", "10", "15", "20"];
  const timerPresets = ["15", "20", "30", "45"];

  return (
    <Screen scrollable style={[styles.screen, { backgroundColor: colors.background }]} title="Create Match">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
            <Swords size={24} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Create Live Match</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Launch a live academic speed duel with your classmates or open a room to all.
            </Text>
          </View>
        </View>

        <Card style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Input
            label="Match Title"
            placeholder="e.g. EEE 301 Speed Battle"
            value={title}
            onChangeText={setTitle}
          />

          <Input
            label={format === "SHARED_COURSE" ? "Shared Course Code *" : "Your Course Code *"}
            placeholder="e.g. GST 101"
            value={courseCode}
            onChangeText={setCourseCode}
            autoCapitalize="characters"
          />

          {/* Presets for Questions */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <HelpCircle size={14} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Question Count</Text>
            </View>
            <View style={styles.presetRow}>
              {questionPresets.map((preset) => {
                const isActive = questionCount === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    activeOpacity={0.8}
                    style={[
                      styles.presetChip,
                      { backgroundColor: isActive ? colors.primary : colors.surfaceElevated, borderColor: isActive ? colors.primary : colors.border },
                    ]}
                    onPress={() => setQuestionCount(preset)}
                  >
                    <Text style={[styles.presetText, { color: isActive ? "#04110A" : colors.textPrimary }]}>
                      {preset} Qs
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Presets for Timer */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Clock size={14} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Timer per Question</Text>
            </View>
            <View style={styles.presetRow}>
              {timerPresets.map((preset) => {
                const isActive = questionTimerSec === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    activeOpacity={0.8}
                    style={[
                      styles.presetChip,
                      { backgroundColor: isActive ? colors.primary : colors.surfaceElevated, borderColor: isActive ? colors.primary : colors.border },
                    ]}
                    onPress={() => setQuestionTimerSec(preset)}
                  >
                    <Text style={[styles.presetText, { color: isActive ? "#04110A" : colors.textPrimary }]}>
                      {preset}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Format Picker */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Layers size={14} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Match Format</Text>
            </View>
            <View style={styles.segmentRow}>
              {[
                { label: "Shared Course", sub: "Same questions for both", value: "SHARED_COURSE" },
                { label: "Dual Course", sub: "Host & Opponent course mix", value: "DUAL_COURSE" },
              ].map((item) => {
                const isActive = format === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    activeOpacity={0.85}
                    style={[
                      styles.segmentCard,
                      { backgroundColor: isActive ? "rgba(34, 197, 94, 0.12)" : colors.surfaceElevated, borderColor: isActive ? colors.primary : colors.border },
                    ]}
                    onPress={() => setFormat(item.value as CompetitionFormat)}
                  >
                    <Text style={[styles.segmentTitle, { color: isActive ? colors.primary : colors.textPrimary }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.segmentSub, { color: colors.textMuted }]}>{item.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Visibility Picker */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Globe size={14} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Visibility</Text>
            </View>
            <View style={styles.segmentRow}>
              {[
                { label: "Private", icon: Lock, sub: "Code invite only", value: "PRIVATE" },
                { label: "Public", icon: Globe, sub: "Open in public matches", value: "PUBLIC" },
              ].map((item) => {
                const isActive = visibility === item.value;
                const IconComponent = item.icon;
                return (
                  <TouchableOpacity
                    key={item.value}
                    activeOpacity={0.85}
                    style={[
                      styles.segmentCardRow,
                      { backgroundColor: isActive ? "rgba(34, 197, 94, 0.12)" : colors.surfaceElevated, borderColor: isActive ? colors.primary : colors.border },
                    ]}
                    onPress={() => setVisibility(item.value as CompetitionVisibility)}
                  >
                    <IconComponent size={16} color={isActive ? colors.primary : colors.textSecondary} />
                    <View style={styles.segmentTextWrap}>
                      <Text style={[styles.segmentTitle, { color: isActive ? colors.primary : colors.textPrimary }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.segmentSub, { color: colors.textMuted }]}>{item.sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.createButton,
              { backgroundColor: !courseCode.trim() ? colors.surfaceElevated : colors.primary },
            ]}
            onPress={createRoom}
            disabled={creating || !courseCode.trim()}
          >
            <Zap size={18} color={!courseCode.trim() ? colors.textMuted : "#04110A"} />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  formCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 16,
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
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: {
    fontSize: 12,
    fontWeight: "800",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 2,
  },
  segmentCardRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  segmentTextWrap: {
    flex: 1,
    gap: 2,
  },
  segmentTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  segmentSub: {
    fontSize: 11,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
