import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarDays, Eye, Trophy, Users } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminTournament } from "../../../services/adminService";

export const AdminTournamentCampaignsScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [loadingText, setLoadingText] = useState("Loading campaigns...");

  const loadTournaments = async () => {
    try {
      setLoadingText("Loading campaigns...");
      const data = await adminService.listTournaments();
      setTournaments(data);
    } catch (error: any) {
      setTournaments([]);
      setLoadingText(error?.response?.data?.message || "Could not load tournament campaigns right now.");
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const publish = async (id: string) => {
    try {
      await adminService.publishTournament(id);
      await loadTournaments();
      Alert.alert("Published", "Tournament campaign is now live for students.");
    } catch (error: any) {
      Alert.alert("Could not publish", error?.response?.data?.message || "Please try again.");
    }
  };

  return (
    <Screen title="Existing Campaigns" scrollable>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.list}>
          {tournaments.length === 0 ? (
            <Card style={{ ...styles.emptyCard, backgroundColor: colors.surface, borderColor: colors.border }}>
              <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>No campaigns yet</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{loadingText}</Text>
            </Card>
          ) : (
            tournaments.map((tournament) => (
              <Card
                key={tournament.id}
                style={{
                  ...styles.itemCard,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <View style={styles.topRow}>
                  <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700", flex: 1 }]}>{tournament.title}</Text>
                  <Text style={[typography.caption, { color: colors.primary }]}>{tournament.status}</Text>
                </View>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {tournament.description || "No admin campaign description added yet."}
                </Text>
                <View style={styles.metaRow}>
                  <CalendarDays size={14} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {new Date(tournament.scheduled_at).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Users size={14} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {tournament.entry_count} total · {tournament.checked_in_count || 0} checked in
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Eye size={14} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {tournament.source_material_ids.length} verified material{tournament.source_material_ids.length === 1 ? "" : "s"} · {tournament.shared_course_code || "Mixed course event"}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Trophy size={14} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {tournament.prize_summary || "No prize summary yet"}
                  </Text>
                </View>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: "800" }]}>
                      {tournament.campaign_type === "MULTI_STAGE" ? "MULTI-STAGE" : "SIMPLE"}
                    </Text>
                  </View>
                  <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[typography.caption, { color: tournament.prediction_enabled ? colors.primary : colors.textMuted, fontWeight: "800" }]}>
                      {tournament.prediction_enabled ? "PREDICTIONS ON" : "PREDICTIONS OFF"}
                    </Text>
                  </View>
                </View>
                {tournament.status === "DRAFT" ? (
                  <TouchableOpacity style={[styles.publishButton, { backgroundColor: colors.primary }]} onPress={() => publish(tournament.id)}>
                    <Text style={styles.publishText}>Publish Tournament</Text>
                  </TouchableOpacity>
                ) : null}
              </Card>
            ))
          )}
        </ScrollView>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  publishButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  publishText: {
    color: "#04110A",
    fontWeight: "700",
    fontSize: 13,
  },
});
