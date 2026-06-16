import React, { useEffect, useMemo, useState } from "react";
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

  const checkInTournament = async () => {
    try {
      const updated = await competitionService.checkInTournament(tournamentId);
      setTournament(updated);
    } catch (error: any) {
      Alert.alert("Unable to check in", error?.response?.data?.message || "Please try again.");
    }
  };

  const timingState = useMemo(() => {
    if (!tournament) return { canCheckIn: false, checkInText: "", canJoin: false };
    const now = Date.now();
    const opens = tournament.check_in_opens_at ? new Date(tournament.check_in_opens_at).getTime() : null;
    const closes = tournament.check_in_closes_at ? new Date(tournament.check_in_closes_at).getTime() : null;
    const canCheckIn = !!tournament.joined && tournament.entry_status !== "CHECKED_IN" && (!opens || opens <= now) && (!closes || closes >= now);
    const checkInText = !tournament.joined
      ? "Join first to check in"
      : tournament.entry_status === "CHECKED_IN"
        ? "Checked in"
        : opens && opens > now
          ? `Check-in opens ${new Date(opens).toLocaleString()}`
          : closes && closes < now
            ? "Check-in closed"
            : "Check in now";
    const canJoin = !tournament.joined && (!tournament.late_join_cutoff_at || new Date(tournament.late_join_cutoff_at).getTime() >= now);
    return { canCheckIn, checkInText, canJoin };
  }, [tournament]);

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
          {tournament.check_in_opens_at ? (
            <Text style={styles.infoText}>Check-in opens: {new Date(tournament.check_in_opens_at).toLocaleString()}</Text>
          ) : null}
          {tournament.check_in_closes_at ? (
            <Text style={styles.infoText}>Check-in closes: {new Date(tournament.check_in_closes_at).toLocaleString()}</Text>
          ) : null}
          {tournament.late_join_cutoff_at ? (
            <Text style={styles.infoText}>Late join cutoff: {new Date(tournament.late_join_cutoff_at).toLocaleString()}</Text>
          ) : null}
        </Card>

        {tournament.campaign_preheader || tournament.campaign_cta_label ? (
          <Card style={styles.campaignCard}>
            <View style={[styles.campaignAccent, { backgroundColor: tournament.campaign_accent_color || colors.primary }]} />
            <Text style={styles.campaignEyebrow}>{tournament.campaign_preheader || "Tournament campaign"}</Text>
            <Text style={styles.campaignTitle}>{tournament.title}</Text>
            <Text style={styles.campaignText}>{tournament.prize_summary || "Prepare for the live competition event."}</Text>
            <TouchableOpacity style={[styles.campaignButton, { backgroundColor: tournament.campaign_accent_color || colors.primary }]}>
              <Text style={styles.campaignButtonText}>{tournament.campaign_cta_label || "Join the competition"}</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {tournament.room_id && tournament.status === "LIVE" ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("CompetitionLobby", { roomId: tournament.room_id })}>
            <Text style={styles.primaryText}>Open Live Event</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.primaryButton, (!timingState.canJoin || tournament.joined) && styles.joinedButton]} onPress={joinTournament} disabled={!timingState.canJoin || !!tournament.joined}>
              <Text style={[styles.primaryText, (!timingState.canJoin || tournament.joined) && styles.joinedText]}>
                {tournament.joined ? "Registered" : timingState.canJoin ? "Join Tournament" : "Join window closed"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, !timingState.canCheckIn && styles.disabledSecondary]} onPress={checkInTournament} disabled={!timingState.canCheckIn}>
              <Text style={[styles.secondaryText, !timingState.canCheckIn && styles.disabledSecondaryText]}>
                {timingState.checkInText}
              </Text>
            </TouchableOpacity>
          </>
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
  infoText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  campaignCard: {
    gap: 10,
    backgroundColor: colors.surfaceElevated,
  },
  campaignAccent: {
    width: 52,
    height: 4,
    borderRadius: 999,
  },
  campaignEyebrow: {
    ...typography.caption,
    color: colors.textMuted,
  },
  campaignTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  campaignText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  campaignButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  campaignButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  disabledSecondary: {
    opacity: 0.6,
  },
  disabledSecondaryText: {
    color: colors.textSecondary,
  },
});
