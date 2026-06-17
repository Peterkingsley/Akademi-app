import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CalendarDays, Swords, Trophy, Users } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService, Tournament } from "../../services/competition";
import { socketService } from "../../services/socket";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const TournamentDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { tournamentId } = route.params;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTournament = async () => {
    try {
      setLoading(true);
      const data = await competitionService.getTournament(tournamentId);
      setTournament(data);
    } catch (error: any) {
      Alert.alert("Unable to load tournament", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
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
      const message = error?.response?.data?.message || "Please try again.";
      if (message === "Tournament registration is closed" || message === "Late join window has closed for this tournament") {
        await loadTournament();
      }
      Alert.alert("Unable to join", message);
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
    if (!tournament) {
      return {
        canCheckIn: false,
        checkInText: "",
        canJoin: false,
        joinText: "Join Tournament",
      };
    }
    const now = Date.now();
    const registrationCloses = tournament.registration_closes_at
      ? new Date(tournament.registration_closes_at).getTime()
      : null;
    const opens = tournament.check_in_opens_at ? new Date(tournament.check_in_opens_at).getTime() : null;
    const closes = tournament.check_in_closes_at ? new Date(tournament.check_in_closes_at).getTime() : null;
    const lateJoinCutoff = tournament.late_join_cutoff_at
      ? new Date(tournament.late_join_cutoff_at).getTime()
      : null;
    const canCheckIn =
      !!tournament.joined &&
      tournament.entry_status !== "CHECKED_IN" &&
      (!opens || opens <= now) &&
      (!closes || closes >= now);
    const checkInText = !tournament.joined
      ? "Join first to check in"
      : tournament.entry_status === "CHECKED_IN"
        ? "Checked in"
        : opens && opens > now
          ? `Check-in opens ${formatDateTime(tournament.check_in_opens_at!)}`
          : closes && closes < now
            ? "Check-in closed"
            : "Check in now";
    const registrationClosed = !!registrationCloses && registrationCloses < now;
    const lateJoinClosed = !!lateJoinCutoff && lateJoinCutoff < now;
    const canJoin = !tournament.joined && !registrationClosed && !lateJoinClosed;
    const joinText = tournament.joined
      ? "Registered"
      : registrationClosed
        ? "Registration closed"
        : lateJoinClosed
          ? "Join window closed"
          : "Join Tournament";
    return { canCheckIn, checkInText, canJoin, joinText };
  }, [tournament]);

  if (loading || !tournament) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </Screen>
    );
  }

  const audienceLabel =
    tournament.audience_scope === "UNIVERSITY"
      ? tournament.audience_university || "University event"
      : tournament.audience_scope === "FACULTY"
        ? `${tournament.audience_faculty || "Faculty"} across schools`
        : tournament.audience_scope === "DEPARTMENT"
          ? `${tournament.audience_department || "Department"} across schools`
          : "Open to every student on Akademi";

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {tournament.campaign_banner_url ? (
          <Image source={{ uri: tournament.campaign_banner_url }} style={styles.banner} resizeMode="cover" />
        ) : null}

        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{tournament.campaign_preheader || "Live challenge"}</Text>
          <Text style={styles.title}>{tournament.title}</Text>
          <Text style={styles.subtitle}>
            {tournament.description || "Scheduled live competition event."}
          </Text>
        </View>

        <Card style={styles.detailCard}>
          <View style={styles.metaRow}>
            <CalendarDays size={16} color={colors.textMuted} />
            <Text style={styles.metaText}>{formatDateTime(tournament.scheduled_at)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Swords size={16} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {`${tournament.shared_course_code || "Mixed course event"} - ${tournament.question_count} questions`}
            </Text>
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
            <Text style={styles.infoText}>Check-in opens: {formatDateTime(tournament.check_in_opens_at)}</Text>
          ) : null}
          {tournament.check_in_closes_at ? (
            <Text style={styles.infoText}>Check-in closes: {formatDateTime(tournament.check_in_closes_at)}</Text>
          ) : null}
          {tournament.late_join_cutoff_at ? (
            <Text style={styles.infoText}>Late join cutoff: {formatDateTime(tournament.late_join_cutoff_at)}</Text>
          ) : null}
        </Card>

        <Card style={styles.campaignCard}>
          <Text style={styles.campaignEyebrow}>What to expect</Text>
          <Text style={styles.campaignTitle}>{audienceLabel}</Text>
          <Text style={styles.campaignText}>
            {tournament.description ||
              tournament.prize_summary ||
              "Register before the deadline, check in when the event opens, then join the live room once the challenge starts."}
          </Text>
        </Card>

        {tournament.room_id && tournament.status === "LIVE" ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("CompetitionLobby", { roomId: tournament.room_id })}
          >
            <Text style={styles.primaryText}>Open Live Event</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, (!timingState.canJoin || tournament.joined) && styles.joinedButton]}
              onPress={joinTournament}
              disabled={!timingState.canJoin || !!tournament.joined}
            >
              <Text style={[styles.primaryText, (!timingState.canJoin || tournament.joined) && styles.joinedText]}>
                {timingState.joinText}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, !timingState.canCheckIn && styles.disabledSecondary]}
              onPress={checkInTournament}
              disabled={!timingState.canCheckIn}
            >
              <Text style={[styles.secondaryText, !timingState.canCheckIn && styles.disabledSecondaryText]}>
                {timingState.checkInText}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
    paddingBottom: 32,
    gap: 16,
  },
  banner: {
    width: "100%",
    height: 200,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
  },
  heroCopy: {
    gap: 8,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
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
    lineHeight: 20,
  },
  campaignButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  campaignButtonText: {
    color: "#04110A",
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

