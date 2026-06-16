import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService, CompetitionLeaderboardEntry, CompetitionRoom, CompetitionSummary, Tournament } from "../../services/competition";

export const CompetitionHubScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<CompetitionSummary | null>(null);
  const [myRooms, setMyRooms] = useState<CompetitionRoom[]>([]);
  const [publicRooms, setPublicRooms] = useState<CompetitionRoom[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [summaryData, mineData, publicData, leaderboardData, tournamentData] = await Promise.all([
        competitionService.getSummary(),
        competitionService.getMyRooms(),
        competitionService.getPublicRooms(),
        competitionService.getLeaderboard(),
        competitionService.getTournaments(),
      ]);

      setSummary(summaryData);
      setMyRooms(mineData);
      setPublicRooms(publicData);
      setLeaderboard(leaderboardData);
      setTournaments(tournamentData);
    } catch (error) {
      console.error("Failed to load competitions", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
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
                    {room.format === "SHARED_COURSE" ? room.shared_course_code || "Shared course" : "Dual course"} · {room.participants.length}/{room.max_participants} players
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
                    Host: {room.host.name} · {room.shared_course_code || "Mixed"}
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
                <Card key={tournament.id} style={styles.roomCard}>
                  <View style={styles.roomTop}>
                    <Text style={styles.roomTitle}>{tournament.title}</Text>
                    <Text style={styles.roomCode}>{tournament.status}</Text>
                  </View>
                  <Text style={styles.roomMeta}>
                    {tournament.shared_course_code || "Multi-course"} · {new Date(tournament.scheduled_at).toLocaleString()}
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
                        {entry.wins} wins · {entry.matchesPlayed} matches · {entry.winRate}% win rate
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
