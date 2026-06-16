import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CalendarDays, Radio, Trophy, Users } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminCompetitionRoom } from "../../../services/adminService";

export const AdminTournamentRoomsScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const [rooms, setRooms] = useState<AdminCompetitionRoom[]>([]);
  const [emptyMessage, setEmptyMessage] = useState("Loading live room history...");

  const loadRooms = async () => {
    try {
      setEmptyMessage("Loading live room history...");
      const data = await adminService.listCompetitionRooms();
      setRooms(data);
    } catch (error: any) {
      setRooms([]);
      setEmptyMessage(error?.response?.data?.message || "Could not load room history right now.");
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  return (
    <Screen title="Past Matches & Rooms" scrollable>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.list}>
          {rooms.length === 0 ? (
            <Card style={{ ...styles.emptyCard, backgroundColor: colors.surface, borderColor: colors.border }}>
              <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>No room history yet</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{emptyMessage}</Text>
            </Card>
          ) : (
            rooms.map((room) => (
              <Card
                key={room.id}
                style={{
                  ...styles.itemCard,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <View style={styles.topRow}>
                  <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700", flex: 1 }]}>{room.title}</Text>
                  <Text style={[typography.caption, { color: colors.primary }]}>{room.status}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Radio size={14} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Code {room.code} · {room.visibility} · {room.tournament ? "Tournament-backed" : "Student-created"}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Users size={14} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Host {room.host.name} · {room.participant_count} participants · {room.ready_count} ready
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Trophy size={14} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Winner: {room.winner_name || "No winner recorded yet"}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <CalendarDays size={14} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Created {new Date(room.created_at).toLocaleString()}
                    {room.ended_at ? ` · Ended ${new Date(room.ended_at).toLocaleString()}` : ""}
                  </Text>
                </View>
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
});
