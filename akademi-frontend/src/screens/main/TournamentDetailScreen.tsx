import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CalendarDays, Swords, Trophy, Users } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService, Tournament } from "../../services/competition";
import { socketService } from "../../services/socket";

export const TournamentDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { tournamentId } = route.params;
  const [tournament, setTournament] = useState<Tournament | null>(null);

  const loadTournament = async () => {
    try {
      const data = await competitionService.getTournament(tournamentId);
      setTournament(data);
    } catch (error: any) {
      Alert.alert("Unable to load tournament", error?.response?.data?.message || "Please try again.");
    }
  };

  useEffect(() => {
    loadTournament();
  }, [tournamentId]);

  useEffect(() => {
    const handleTournamentLive = (payload: { tournamentId: string; roomId: string }) => {
      if (payload.tournamentId !== tournamentId) return;
      loadTournament();
      Alert.alert("Tournament is live", "Your event room is ready. Jump in now.", [
        { text: "Later", style: "cancel" },
        { text: "Open", onPress: () => navigation.navigate("CompetitionLobby", { roomId: payload.roomId }) },
      ]);
    };

    const setup = async () => {
      const socket = await socketService.connect();
      socket.on("tournament:live", handleTournamentLive);
    };

    setup().catch((error) => console.error("Tournament live listener failed", error));

    return () => {
      socketService.off("tournament:live", handleTournamentLive);
    };
  }, [navigation, tournamentId]);

  const joinTournament = async () => {
    try {
      const updated = await competitionService.joinTournament(tournamentId);
      setTournament(updated);
    } catch (error: any) {
      Alert.alert("Unable to join", error?.response?.data?.message || "Please try again.");
    }
  };

  if (!tournament) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading tournament...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>{tournament.title}</Text>
        <Text style={styles.subtitle}>{tournament.description || "Scheduled live competition event."}</Text>

        <Card style={styles.detailCard}>
          <View style={styles.metaRow}>
            <CalendarDays size={16} color={colors.textMuted} />
            <Text style={styles.metaText}>{new Date(tournament.scheduled_at).toLocaleString()}</Text>
          </View>
          <View style={styles.metaRow}>
            <Swords size={16} color={colors.textMuted} />
            <Text style={styles.metaText}>{tournament.shared_course_code || "Mixed course event"} | {tournament.question_count} questions</Text>
          </View>
          <View style={styles.metaRow}>
            <Users size={16} color={colors.textMuted} />
            <Text style={styles.metaText}>{tournament.entry_count} registered</Text>
          </View>
          {tournament.prize_summary ? (
            <View style={styles.metaRow}>
              <Trophy size={16} color={colors.textMuted} />
              <Text style={styles.metaText}>{tournament.prize_summary}</Text>
            </View>
          ) : null}
        </Card>

        {tournament.room_id && tournament.status === "LIVE" ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("CompetitionLobby", { roomId: tournament.room_id })}>
            <Text style={styles.primaryText}>Open Live Event</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.primaryButton, tournament.joined && styles.joinedButton]} onPress={joinTournament} disabled={!!tournament.joined}>
            <Text style={[styles.primaryText, tournament.joined && styles.joinedText]}>
              {tournament.joined ? "Registered" : "Join Tournament"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
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
  },
  detailCard: {
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: {
    ...typography.body,
    color: "#04110A",
    fontWeight: "700",
  },
  joinedButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinedText: {
    color: colors.textSecondary,
  },
});
