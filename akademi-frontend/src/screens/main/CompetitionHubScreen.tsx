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
import { CalendarDays, ChevronRight, ListChecks, Plus, Trophy, UserPlus } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService, Tournament } from "../../services/competition";
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

const getTournamentJoinState = (tournament: Tournament) => {
  const now = Date.now();
  const registrationCloses = tournament.registration_closes_at
    ? new Date(tournament.registration_closes_at).getTime()
    : null;
  const lateJoinCutoff = tournament.late_join_cutoff_at
    ? new Date(tournament.late_join_cutoff_at).getTime()
    : null;

  if (tournament.joined) {
    return { canJoin: false, label: "View Event" };
  }

  if (registrationCloses && registrationCloses < now) {
    return { canJoin: false, label: "Registration closed" };
  }

  if (lateJoinCutoff && lateJoinCutoff < now) {
    return { canJoin: false, label: "Join window closed" };
  }

  return {
    canJoin: true,
    label: tournament.campaign_cta_label || "Register now",
  };
};

export const CompetitionHubScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setLoadNotice(null);

      const results = await Promise.allSettled([competitionService.getTournaments()]);
      const [tournamentResult] = results;
      const hasMissingRoute = results.some(
        (result) => result.status === "rejected" && result.reason?.response?.status === 404,
      );

      setTournaments(tournamentResult.status === "fulfilled" ? tournamentResult.value : []);

      if (hasMissingRoute) {
        setLoadNotice(
          "Competition routes are not live on this backend yet. Once Render deploys the latest branch, campaigns and match rooms will appear here.",
        );
      }
    } catch (error: any) {
      setLoadNotice(
        error?.response?.status === 404
          ? "Competition routes are not live on this backend yet. Once Render deploys the latest branch, campaigns and match rooms will appear here."
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

  const featuredTournament = tournaments[0] || null;
  const remainingTournaments = tournaments.slice(1);

  const joinTournament = async (tournamentId: string) => {
    try {
      const updated = await competitionService.joinTournament(tournamentId);
      setTournaments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || "Please try again.";
      if (
        message === "Tournament registration is closed" ||
        message === "Late join window has closed for this tournament"
      ) {
        loadData(true);
      }
      Alert.alert("Unable to join event", message);
    }
  };

  const liveCampaignCount = useMemo(
    () =>
      tournaments.filter(
        (tournament) => tournament.status === "LIVE" || tournament.status === "PUBLISHED",
      ).length,
    [tournaments],
  );
  const featuredJoinState = featuredTournament ? getTournamentJoinState(featuredTournament) : null;

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Compete Live</Text>
          <Text style={styles.subtitle}>
            Live campaigns come first here. Your own rooms, code invites, and rankings now sit
            behind dedicated action buttons.
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
              <Text style={styles.sectionHint}>
                {liveCampaignCount} active or scheduled event
                {liveCampaignCount === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={() => navigation.navigate("CreateCompetition")}
              >
                <Plus size={18} color="#04110A" />
                <Text style={styles.primaryActionButtonText}>New Match</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => navigation.navigate("CompetitionJoinCode")}
              >
                <UserPlus size={18} color={colors.primary} />
                <Text style={styles.secondaryActionButtonText}>Join with code</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.utilityRow}>
              <Card
                style={styles.utilityCard}
                onPress={() => navigation.navigate("CompetitionMatches")}
              >
                <View style={styles.utilityIconWrap}>
                  <ListChecks size={18} color={colors.primary} />
                </View>
                <View style={styles.utilityContent}>
                  <Text style={styles.utilityTitle}>My matches</Text>
                  <Text style={styles.utilityText}>
                    Open your created rooms, joined rooms, and public room list on a separate page.
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Card>

              <Card
                style={styles.utilityCard}
                onPress={() => navigation.navigate("CompetitionLeaderboard")}
              >
                <View style={styles.utilityIconWrap}>
                  <Trophy size={18} color={colors.primary} />
                </View>
                <View style={styles.utilityContent}>
                  <Text style={styles.utilityTitle}>Leaderboard</Text>
                  <Text style={styles.utilityText}>
                    Check your match totals, win rate, and overall ranking without crowding this
                    campaign page.
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Card>
            </View>

            {featuredTournament ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate("TournamentDetail", { tournamentId: featuredTournament.id })
                }
              >
                <Card style={styles.heroCampaignCard}>
                  {featuredTournament.campaign_banner_url ? (
                    <Image
                      source={{ uri: featuredTournament.campaign_banner_url }}
                      style={styles.heroBanner}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.heroFallbackBanner}>
                      <Text style={styles.heroFallbackText}>
                        {featuredTournament.campaign_preheader || "Featured challenge"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.heroBody}>
                    <Text style={styles.heroEyebrow}>
                      {featuredTournament.campaign_preheader ||
                        campaignAudienceLabel(featuredTournament)}
                    </Text>
                    <Text style={styles.heroTitle}>{featuredTournament.title}</Text>
                    <Text style={styles.heroDescription} numberOfLines={3}>
                      {featuredTournament.description ||
                        "Join this live Akademi challenge and compete in real time."}
                    </Text>

                    <View style={styles.heroMetaWrap}>
                      <View style={styles.heroMetaRow}>
                        <CalendarDays size={14} color={colors.textMuted} />
                        <Text style={styles.heroMetaText}>
                          {formatEventDate(featuredTournament.scheduled_at)}
                        </Text>
                      </View>
                      <Text style={styles.heroMetaText}>
                        {featuredTournament.shared_course_code || "Multi-course event"}
                      </Text>
                      {featuredTournament.prize_summary ? (
                        <Text style={styles.heroPrize}>{featuredTournament.prize_summary}</Text>
                      ) : null}
                    </View>

                    <View style={styles.heroActions}>
                      <TouchableOpacity
                        style={[
                          styles.heroPrimaryButton,
                          !featuredJoinState?.canJoin && styles.heroSecondaryButton,
                        ]}
                        onPress={() =>
                          featuredTournament.joined || !featuredJoinState?.canJoin
                            ? navigation.navigate("TournamentDetail", {
                                tournamentId: featuredTournament.id,
                              })
                            : joinTournament(featuredTournament.id)
                        }
                      >
                        <Text
                          style={[
                            styles.heroPrimaryButtonText,
                            !featuredJoinState?.canJoin && styles.heroSecondaryButtonText,
                          ]}
                        >
                          {featuredJoinState?.label || "Register now"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.heroGhostButton}
                        onPress={() =>
                          navigation.navigate("TournamentDetail", {
                            tournamentId: featuredTournament.id,
                          })
                        }
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
                <Text style={styles.emptyText}>
                  Published university, faculty, department, and national challenges will show
                  here first.
                </Text>
              </Card>
            )}

            {remainingTournaments.length > 0 ? (
              <View style={styles.tournamentList}>
                {remainingTournaments.map((tournament) => (
                  <Card
                    key={tournament.id}
                    style={styles.campaignListCard}
                    onPress={() =>
                      navigation.navigate("TournamentDetail", { tournamentId: tournament.id })
                    }
                  >
                    {tournament.campaign_banner_url ? (
                      <Image
                        source={{ uri: tournament.campaign_banner_url }}
                        style={styles.campaignThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.campaignThumbFallback} />
                    )}
                    <View style={styles.campaignListBody}>
                      <View style={styles.campaignListTop}>
                        <Text style={styles.campaignListTitle} numberOfLines={2}>
                          {tournament.title}
                        </Text>
                        <Text style={styles.campaignStatus}>{tournament.status}</Text>
                      </View>
                      <Text style={styles.campaignListMeta}>
                        {tournament.shared_course_code || "Multi-course"} ·{" "}
                        {formatEventDate(tournament.scheduled_at)}
                      </Text>
                      <Text style={styles.campaignListAudience} numberOfLines={1}>
                        {campaignAudienceLabel(tournament)}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}
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
  actionGrid: {
    flexDirection: "row",
    gap: 12,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryActionButtonText: {
    ...typography.bodySmall,
    color: "#04110A",
    fontWeight: "700",
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 15,
  },
  secondaryActionButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  utilityRow: {
    gap: 12,
  },
  utilityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  utilityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityContent: {
    flex: 1,
    gap: 4,
  },
  utilityTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  utilityText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
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
});
