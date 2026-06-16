import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { CalendarDays, Plus, Radio, Trophy } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminTournament } from "../../../services/adminService";

export const AdminTournamentsScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [prize, setPrize] = useState("");
  const [saving, setSaving] = useState(false);

  const formCardStyle: ViewStyle = {
    ...styles.formCard,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  };

  const loadTournaments = async () => {
    try {
      const data = await adminService.listTournaments();
      setTournaments(data);
    } catch (error) {
      console.error("Failed to load tournaments", error);
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const createTournament = async () => {
    try {
      setSaving(true);
      await adminService.createTournament({
        title,
        shared_course_code: courseCode,
        scheduled_at: scheduledAt,
        prize_summary: prize,
      });
      setTitle("");
      setCourseCode("");
      setScheduledAt("");
      setPrize("");
      await loadTournaments();
    } catch (error: any) {
      Alert.alert("Unable to create tournament", error?.response?.data?.message || "Please check the form.");
    } finally {
      setSaving(false);
    }
  };

  const publishTournament = async (id: string) => {
    try {
      await adminService.publishTournament(id);
      await loadTournaments();
    } catch (error: any) {
      Alert.alert("Unable to publish", error?.response?.data?.message || "Please try again.");
    }
  };

  return (
    <Screen title="Tournaments" scrollable>
      <View style={styles.container}>
        <Card style={formCardStyle}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Create Tournament</Text>
          <Input label="Title" placeholder="National GST 101 Challenge" value={title} onChangeText={setTitle} />
          <Input label="Course Code" placeholder="GST 101" value={courseCode} onChangeText={setCourseCode} autoCapitalize="characters" />
          <Input label="Scheduled At (ISO)" placeholder="2026-06-30T14:00:00.000Z" value={scheduledAt} onChangeText={setScheduledAt} />
          <Input label="Prize Summary" placeholder="N50,000 scholarship prize" value={prize} onChangeText={setPrize} />
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={createTournament} disabled={saving}>
            <Plus size={16} color="#04110A" />
            <Text style={styles.primaryButtonText}>{saving ? "Creating..." : "Create Tournament"}</Text>
          </TouchableOpacity>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Existing Tournaments</Text>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {tournaments.map((tournament) => (
            <Card
              key={tournament.id}
              style={{
                ...styles.itemCard,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View style={styles.itemTop}>
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>{tournament.title}</Text>
                <Text style={[typography.caption, { color: colors.primary }]}>{tournament.status}</Text>
              </View>
              <View style={styles.metaRow}>
                <CalendarDays size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{new Date(tournament.scheduled_at).toLocaleString()}</Text>
              </View>
              <View style={styles.metaRow}>
                <Trophy size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{tournament.prize_summary || "No prize summary yet"}</Text>
              </View>
              <View style={styles.metaRow}>
                <Radio size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{tournament.entry_count} registered</Text>
              </View>
              {tournament.status === "DRAFT" ? (
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => publishTournament(tournament.id)}>
                  <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "700" }]}>Publish Tournament</Text>
                </TouchableOpacity>
              ) : null}
            </Card>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#04110A",
    fontWeight: "700",
    fontSize: 13,
  },
  sectionHeader: {
    marginTop: 8,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
});
