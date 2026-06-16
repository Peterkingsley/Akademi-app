import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CalendarDays, Radio, Swords, Trophy, Users } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import {
  competitionService,
  CompetitionLeaderboardEntry,
  CompetitionRoom,
  CompetitionSummary,
  Tournament,
} from "../../services/competition";
import { socketService } from "../../services/socket";

const formatEventDate = (value: string) =>
  new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const campaignAudienceLabel = (tournament: Tournament) => {
  if (tournament.audience_scope === "UNIVERSITY") {
    return tournament.audience_university || "University event";
  }
  if (tournament.audience_scope === "FACULTY") {
    return `${tournament.audience_faculty || "Faculty"} across schools`;
  }
  if (tournament.audience_scope === "DEPARTMENT") {
    return `${tournament.audience_department || "Department"} across schools`;
  }
  return "Open to everyone on Akademi";
};

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

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummary({
          matchesPlayed: 0,
          wins: 0,
          liveMatches: 0,
          averageScore: 0,
          winRate: 0,
        });
      }

      setMyRooms(mineResult.status === "fulfilled" ? mineResult.value : []);
      setPublicRooms(publicResult.status === "fulfilled" ? publicResult.value : []);
      setLeaderboard(leaderboardResult.status === "fulfilled" ? leaderboardResult.value : []);
      setTournaments(tournamentResult.status === "fulfilled" ? tournamentResult.value : []);

      if (hasMissingRoute) {
        setLoadNotice(
          "Competition routes are not live on this backend yet. Once Render deploys the latest branch, matches and tournaments will appear here.",
        );
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

  const stats = [
    { label: "Matches", value: summary?.matchesPlayed ?? 0, icon: Swords },
    { label: "Wins", value: summary?.wins ?? 0, icon: Trophy },
    { label: "Win Rate", value: `${summary?.winRate ?? 0}%`, icon: Radio },
    { label: "Live", value: summary?.liveMatches ?? 0, icon: Users },
  ];

  const featuredTournament = tournaments[0] || null;
  const remainingTournaments = tournaments.slice(1);

  const joinTournament = async (tournamentId: string) => {
    try {
      const updated = await competitionService.joinTournament(tournamentId);
      setTournaments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error: any) {
      Alert.alert("Unable to join event", error?.response?.data?.message || "Please try again.");
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

  const liveCampaignCount = useMemo(
    () => tournaments.filter((tournament) => tournament.status === "LIVE" || tournament.status === "PUBLISHED").length,
    [tournaments],
  );

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Compete Live</Text>
          <Text style={styles.subtitle}>
            Join live campaigns, register for challenges, or host your own match room.
          </Text>
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

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live Campaigns</Text>
              <Text style={styles.sectionHint}>{liveCampaignCount} active or scheduled event{liveCampaignCount === 1 ? "" : "s"}</Text>
            </View>

            {featuredTournament ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate("TournamentDetail", { tournamentId: featuredTournament.id })}
              >
                <Card style={styles.heroCampaignCard}>
                  {featuredTournament.campaign_banner_url ? (
                    <Image source={{ uri: featuredTournament.campaign_banner_url }} style={styles.heroBanner} resizeMode="cover" />
                  ) : (
                    <View style={styles.heroFallbackBanner}>
                      <Text style={styles.heroFallbackText}>
                        {featuredTournament.campaign_preheader || "Featured challenge"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.heroBody}>
                    <Text style={styles.heroEyebrow}>
                      {featuredTournament.campaign_preheader || campaignAudienceLabel(featuredTournament)}
                    </Text>
                    <Text style={styles.heroTitle}>{featuredTournament.title}</Text>
                    <Text style={styles.heroDescription} numberOfLines={3}>
                      {featuredTournament.description || "Join this live Akademi challenge and compete in real time."}
                    </Text>

                    <View style={styles.heroMetaWrap}>
                      <View style={styles.heroMetaRow}>
                        <CalendarDays size={14} color={colors.textMuted} />
                        <Text style={styles.heroMetaText}>{formatEventDate(featuredTournament.scheduled_at)}</Text>
                      </View>
                      <Text style={styles.heroMetaText}>{featuredTournament.shared_course_code || "Multi-course event"}</Text>
                      {featuredTournament.prize_summary ? (
                        <Text style={styles.heroPrize}>{featuredTournament.prize_summary}</Text>
                      ) : null}
                    </View>

                    <View style={styles.heroActions}>
                      <TouchableOpacity
                        style={[styles.heroPrimaryButton, featuredTournament.joined && styles.heroSecondaryButton]}
                        onPress={() =>
                          featuredTournament.joined
                            ? navigation.navigate("TournamentDetail", { tournamentId: featuredTournament.id })
                            : joinTournament(featuredTournament.id)
                        }
                      >
                        <Text
                          style={[
                            styles.heroPrimaryButtonText,
                            featuredTournament.joined && styles.heroSecondaryButtonText,
                          ]}
                        >
                          {featuredTournament.joined
                            ? "View Event"
                            : featuredTournament.campaign_cta_label || "Register now"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.heroGhostButton}
                        onPress={() => navigation.navigate("TournamentDetail", { tournamentId: featuredTournament.id })}
                      >
                        <Text style={styles.heroGhostButtonText}>See details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No live campaigns yet</Text>
                <Text style={styles.emptyText}>Published university, faculty, department, and national challenges will show here first.</Text>
              </Card>
            )}

            {remainingTournaments.length > 0 ? (
              <View style={styles.tournamentList}>
                {remainingTournaments.map((tournament) => (
                  <Card
                    key={tournament.id}
                    style={styles.campaignListCard}
                    onPress={() => navigation.navigate("TournamentDetail", { tournamentId: tournament.id })}
                  >
                    {tournament.campaign_banner_url ? (
                      <Image source={{ uri: tournament.campaign_banner_url }} style={styles.campaignThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.campaignThumbFallback} />
                    )}
                    <View style={styles.campaignListBody}>
                      <View style={styles.campaignListTop}>
                        <Text style={styles.campaignListTitle} numberOfLines={2}>{tournament.title}</Text>
                        <Text style={styles.campaignStatus}>{tournament.status}</Text>
                      </View>
                      <Text style={styles.campaignListMeta}>
                        {tournament.shared_course_code || "Multi-course"} · {formatEventDate(tournament.scheduled_at)}
                      </Text>
                      <Text style={styles.campaignListAudience} numberOfLines={1}>
                        {campaignAudienceLabel(tournament)}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick actions</Text>
            </View>

            <View style={styles.statsGrid}>
              {stats.map((item) => {
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

            <View style={styles.quickActionRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("CreateCompetition")}>
                <Text style={styles.primaryButtonText}>New Match</Text>
              </TouchableOpacity>
            </View>

            <Card style={styles.joinCodeCard}>
              <Text style={styles.calloutTitle}>Have a match code?</Text>
              <Text style={styles.calloutText}>
                Join a private room or host-shared campaign code instantly.
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
    gap: 8,
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
  center: {
    paddingTop: 80,
    alignItems: "center",
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
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  heroCampaignCard: {
    overflow: "hidden",
    padding: 0,
    backgroundColor: colors.surface,
  },
  heroBanner: {
    width: "100%",
    height: 180,
    backgroundColor: colors.surfaceElevated,
  },
  heroFallbackBanner: {
    height: 140,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  heroFallbackText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroBody: {
    padding: 18,
    gap: 10,
  },
  heroEyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  heroDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  heroMetaWrap: {
    gap: 6,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroMetaText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  heroPrize: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  heroPrimaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  heroPrimaryButtonText: {
    ...typography.bodySmall,
    color: "#04110A",
    fontWeight: "700",
  },
  heroGhostButton: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGhostButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  heroSecondaryButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroSecondaryButtonText: {
    color: colors.textPrimary,
  },
  tournamentList: {
    gap: 12,
  },
  campaignListCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  campaignThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  campaignThumbFallback: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  campaignListBody: {
    flex: 1,
    gap: 6,
  },
  campaignListTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  campaignListTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
    flex: 1,
  },
  campaignStatus: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  campaignListMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  campaignListAudience: {
    ...typography.caption,
    color: colors.textMuted,
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
  quickActionRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
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
  joinCodeCard: {
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
