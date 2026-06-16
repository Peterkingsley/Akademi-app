import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService, CompetitionFormat, CompetitionVisibility } from "../../services/competition";

export const CreateCompetitionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
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
        title: title.trim() || "Live Competition",
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

  return (
    <Screen scrollable style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Create Live Match</Text>
        <Text style={styles.subtitle}>
          Start with friend battles first. Shared-course mode is the fairest launch format.
        </Text>

        <Card style={styles.formCard}>
          <Input
            label="Match title"
            placeholder="EEE 301 speed battle"
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label={format === "SHARED_COURSE" ? "Shared course code" : "Your course code"}
            placeholder="GST 101"
            value={courseCode}
            onChangeText={setCourseCode}
            autoCapitalize="characters"
          />
          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Input
                label="Questions"
                placeholder="10"
                value={questionCount}
                onChangeText={setQuestionCount}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inlineField}>
              <Input
                label="Seconds per question"
                placeholder="20"
                value={questionTimerSec}
                onChangeText={setQuestionTimerSec}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Format</Text>
            <View style={styles.segmentRow}>
              {[
                { label: "Shared", value: "SHARED_COURSE" },
                { label: "Dual", value: "DUAL_COURSE" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.segmentButton, format === item.value && styles.segmentButtonActive]}
                  onPress={() => setFormat(item.value as CompetitionFormat)}
                >
                  <Text style={[styles.segmentText, format === item.value && styles.segmentTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Visibility</Text>
            <View style={styles.segmentRow}>
              {[
                { label: "Private", value: "PRIVATE" },
                { label: "Public", value: "PUBLIC" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.segmentButton, visibility === item.value && styles.segmentButtonActive]}
                  onPress={() => setVisibility(item.value as CompetitionVisibility)}
                >
                  <Text style={[styles.segmentText, visibility === item.value && styles.segmentTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.createButton} onPress={createRoom} disabled={creating || !courseCode.trim()}>
            <Text style={styles.createButtonText}>{creating ? "Creating..." : "Create match"}</Text>
          </TouchableOpacity>
        </Card>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  formCard: {
    gap: 16,
  },
  inlineRow: {
    flexDirection: "row",
    gap: 12,
  },
  inlineField: {
    flex: 1,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#04110A",
  },
  createButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  createButtonText: {
    ...typography.body,
    color: "#04110A",
    fontWeight: "700",
  },
});
