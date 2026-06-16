import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swords, Trophy, Users, Radio, CalendarDays } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService, CompetitionLeaderboardEntry, CompetitionRoom, CompetitionSummary, Tournament } from "../../services/competition";
import { socketService } from "../../services/socket";

export const CompetitionHubScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<CompetitionSummary | null>(null);
  const [myRooms, setMyRooms] = useState<CompetitionRoom[]>([]);
  const [publicRooms, setPublicRooms] = useState<CompetitionRoom[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinCourseCode, setJoinCourseCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setLoadNotice(null);

      const results = await Promise.allSettled([
        competitionService.getSummary(),
        competitionService.getMyRooms(),
        competitionService.getPublicRooms(),
        competitionService.getLeaderboard(),
        competitionService.getTournaments(),
      ]);

      const [summaryResult, mineResult, publicResult, leaderboardResult, tournamentResult] = results;
      const hasMissingRoute = results.some(
        (result) => result.status === "rejected" && result.reason?.response?.status === 404,
      );

      if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
      else setSummary({
        matchesPlayed: 0,
        wins: 0,
        liveMatches: 0,
        averageScore: 0,
        winRate: 0,
      });

      setMyRooms(mineResult.status === "fulfilled" ? mineResult.value : []);
      setPublicRooms(publicResult.status === "fulfilled" ? publicResult.value : []);
      setLeaderboard(leaderboardResult.status === "fulfilled" ? leaderboardResult.value : []);
      setTournaments(tournamentResult.status === "fulfilled" ? tournamentResult.value : []);

      if (hasMissingRoute) {
        setLoadNotice("Competition routes are not live on this backend yet. Once Render deploys the latest branch, matches and tournaments will appear here.");
      }
    } catch (error: any) {
      setLoadNotice(
        error?.response?.status === 404
          ? "Competition routes are not live on this backend yet. Once Render deploys the latest branch, matches and tournaments will appear here."
          : "We could not refresh competition data right now. Pull to try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleTournamentLive = () => {
      loadData(true);
    };

    const setup = async () => {
      const socket = await socketService.connect();
      socket.on("tournament:live", handleTournamentLive);
    };

    setup().catch((error) => console.error("Tournament socket setup failed", error));

    return () => {
      socketService.off("tournament:live", handleTournamentLive);
    };
  }, []);

  const statCards = [
    { label: "Matches", value: summary?.matchesPlayed ?? 0, icon: Swords },
    { label: "Wins", value: summary?.wins ?? 0, icon: Trophy },
    { label: "Win Rate", value: `${summary?.winRate ?? 0}%`, icon: Radio },
    { label: "Live", value: summary?.liveMatches ?? 0, icon: Users },
  ];

  const joinTournament = async (tournamentId: string) => {
    try {
      const updated = await competitionService.joinTournament(tournamentId);
      setTournaments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error) {
      console.error("Failed to join tournament", error);
    }
  };

  const joinMatchByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert("Enter match code", "Ask the host for the room code and paste it here.");
      return;
    }

    try {
      setJoining(true);
      const room = await competitionService.joinRoom(code, joinCourseCode.trim().toUpperCase() || undefined);
      setJoinCode("");
      setJoinCourseCode("");
      navigation.navigate("CompetitionLobby", { roomId: room.id });
    } catch (error: any) {
      Alert.alert("Could not join match", error?.response?.data?.message || "Check the code and try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Compete Live</Text>
            <Text style={styles.subtitle}>
              Challenge friends, join public battles, and climb the rankings.
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("CreateCompetition")}>
            <Text style={styles.primaryButtonText}>New Match</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <>
            {loadNotice ? (
              <Card style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>Competition update pending</Text>
                <Text style={styles.noticeText}>{loadNotice}</Text>
              </Card>
            ) : null}

            <View style={styles.statsGrid}>
              {statCards.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} style={styles.statCard}>
                    <Icon size={18} color={colors.primary} />
                    <Text style={styles.statValue}>{item.value}</Text>
                    <Text style={styles.statLabel}>{item.label}</Text>
                  </Card>
                );
              })}
            </View>

            <Card style={styles.callout}>
              <Text style={styles.calloutTitle}>Tournament-ready foundation</Text>
              <Text style={styles.calloutText}>
                Private matches work first. Public queues and campus campaigns can build on the same room system.
              </Text>
            </Card>

            <Card style={styles.joinCodeCard}>
              <Text style={styles.calloutTitle}>Have a match code?</Text>
              <Text style={styles.calloutText}>
                Enter the code your friend or campaign host shared to join the live lobby.
              </Text>
              <Input
                label="Room code"
                placeholder="e.g. A7K2Q9"
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="characters"
                style={styles.joinInput}
              />
              <Input
                label="Your course code"
                placeholder="Optional for dual-course matches"
                value={joinCourseCode}
                onChangeText={setJoinCourseCode}
                autoCapitalize="characters"
                style={styles.joinInput}
              />
              <TouchableOpacity
                style={[styles.joinCodeButton, (!joinCode.trim() || joining) && styles.joinCodeButtonDisabled]}
                onPress={joinMatchByCode}
                disabled={!joinCode.trim() || joining}
              >
                <Text style={styles.joinCodeButtonText}>{joining ? "Joining..." : "Join with code"}</Text>
              </TouchableOpacity>
            </Card>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Matches</Text>
            </View>
            {myRooms.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matches yet</Text>
                <Text style={styles.emptyText}>Create a room and share the code with a friend to start your first live battle.</Text>
              </Card>
            ) : (
              myRooms.map((room) => (
                <Card key={room.id} style={styles.roomCard} onPress={() => navigation.navigate("CompetitionLobby", { roomId: room.id })}>
                  <View style={styles.roomTop}>
                    <Text style={styles.roomTitle}>{room.title}</Text>
                    <Text style={styles.roomCode}>{room.code}</Text>
                  </View>
                  <Text style={styles.roomMeta}>
                    {room.format === "SHARED_COURSE" ? room.shared_course_code || "Shared course" : "Dual course"} | {room.participants.length}/{room.max_participants} players
                  </Text>
                  <Text style={styles.roomStatus}>{room.status}</Text>
                </Card>
              ))
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Open Public Matches</Text>
            </View>
            {publicRooms.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No public rooms waiting</Text>
                <Text style={styles.emptyText}>When public competition opens up, available rooms will show here.</Text>
              </Card>
            ) : (
              publicRooms.map((room) => (
                <Card key={room.id} style={styles.roomCard} onPress={() => navigation.navigate("CompetitionLobby", { roomId: room.id })}>
                  <View style={styles.roomTop}>
                    <Text style={styles.roomTitle}>{room.title}</Text>
                    <Text style={styles.roomCode}>{room.code}</Text>
                  </View>
                  <Text style={styles.roomMeta}>
                    Host: {room.host.name} | {room.shared_course_code || "Mixed"}
                  </Text>
                  <Text style={styles.roomStatus}>{room.participants.length}/{room.max_participants} joined</Text>
                </Card>
              ))
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Scheduled Tournaments</Text>
            </View>
            {tournaments.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No tournaments yet</Text>
                <Text style={styles.emptyText}>Published campus and national events will appear here.</Text>
              </Card>
            ) : (
              tournaments.map((tournament) => (
                <Card key={tournament.id} style={styles.roomCard} onPress={() => navigation.navigate("TournamentDetail", { tournamentId: tournament.id })}>
                  <View style={styles.roomTop}>
                    <Text style={styles.roomTitle}>{tournament.title}</Text>
                    <Text style={styles.roomCode}>{tournament.status}</Text>
                  </View>
                  <Text style={styles.roomMeta}>
                    {tournament.shared_course_code || "Multi-course"} | {new Date(tournament.scheduled_at).toLocaleString()}
                  </Text>
                  {tournament.prize_summary ? (
                    <Text style={styles.roomStatus}>{tournament.prize_summary}</Text>
                  ) : null}
                  <View style={styles.tournamentFooter}>
                    <View style={styles.tournamentCount}>
                      <CalendarDays size={14} color={colors.textMuted} />
                      <Text style={styles.tournamentCountText}>{tournament.entry_count} joined</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.joinButton, tournament.joined && styles.joinedButton]}
                      onPress={() => joinTournament(tournament.id)}
                      disabled={!!tournament.joined}
                    >
                      <Text style={[styles.joinButtonText, tournament.joined && styles.joinedButtonText]}>
                        {tournament.joined ? "Joined" : "Join Event"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Leaderboard</Text>
            </View>
            {leaderboard.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No leaderboard yet</Text>
                <Text style={styles.emptyText}>Completed live battles will start shaping the rankings here.</Text>
              </Card>
            ) : (
              <Card style={styles.leaderboardCard}>
                {leaderboard.map((entry, index) => (
                  <View key={entry.user_id} style={styles.leaderRow}>
                    <Text style={styles.leaderRank}>#{index + 1}</Text>
                    <View style={styles.leaderTextWrap}>
                      <Text style={styles.leaderName}>{entry.name}</Text>
                      <Text style={styles.leaderMeta}>
                        {entry.wins} wins | {entry.matchesPlayed} matches | {entry.winRate}% win rate
                      </Text>
                    </View>
                    <Text style={styles.leaderScore}>{entry.totalScore}</Text>
                  </View>
                ))}
              </Card>
            )}
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
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    gap: 16,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    ...typography.bodySmall,
    color: "#04110A",
    fontWeight: "700",
  },
  center: {
    paddingTop: 80,
    alignItems: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "47%",
    gap: 8,
  },
  statValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  callout: {
    backgroundColor: colors.surfaceElevated,
    gap: 8,
  },
  noticeCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    gap: 8,
  },
  noticeTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  noticeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  calloutTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  calloutText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  joinCodeCard: {
    backgroundColor: colors.surfaceElevated,
    gap: 8,
  },
  joinInput: {
    marginBottom: 4,
  },
  joinCodeButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    marginTop: 4,
    paddingVertical: 14,
  },
  joinCodeButtonDisabled: {
    opacity: 0.55,
  },
  joinCodeButtonText: {
    ...typography.bodySmall,
    color: "#04110A",
    fontWeight: "700",
  },
  sectionHeader: {
    marginTop: 8,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  roomCard: {
    gap: 8,
  },
  roomTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  roomTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
    flex: 1,
  },
  roomCode: {
    ...typography.caption,
    color: colors.primary,
  },
  roomMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  roomStatus: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tournamentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  tournamentCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tournamentCountText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  joinButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinedButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinButtonText: {
    ...typography.caption,
    color: "#04110A",
    fontWeight: "700",
  },
  joinedButtonText: {
    color: colors.textSecondary,
  },
  leaderboardCard: {
    gap: 12,
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  leaderRank: {
    ...typography.caption,
    color: colors.textMuted,
    width: 24,
  },
  leaderTextWrap: {
    flex: 1,
  },
  leaderName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  leaderMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  leaderScore: {
    ...typography.body,
    color: colors.primary,
    fontWeight: "700",
  },
});
