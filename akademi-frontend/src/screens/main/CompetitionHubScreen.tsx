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
import {
  CalendarDays,
  ChevronRight,
  Flame,
  ListChecks,
  Plus,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UserPlus,
  Zap,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { competitionService, Tournament } from "../../services/competition";
import { socketService } from "../../services/socket";
import { useTheme } from "../../theme/ThemeContext";

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
    return { canJoin: false, label: "Open Event", status: "JOINED" };
  }

  if (registrationCloses && registrationCloses < now) {
    return { canJoin: false, label: "Registration Closed", status: "CLOSED" };
  }

  if (lateJoinCutoff && lateJoinCutoff < now) {
    return { canJoin: false, label: "Join Window Closed", status: "CLOSED" };
  }

  return {
    canJoin: true,
    label: tournament.campaign_cta_label || "Register Now",
    status: "OPEN",
  };
};

export const CompetitionHubScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, typography, isDark } = useTheme();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setLoadNotice(null);

    const tournamentResult = await competitionService
      .getTournaments()
      .then((value) => ({ ok: true as const, value }))
      .catch((error: any) => ({ ok: false as const, error }));

    if (tournamentResult.ok) {
      setTournaments(tournamentResult.value);
      setLoadNotice(null);
    } else {
      setTournaments([]);
      const status = tournamentResult.error?.response?.status;
      const message = tournamentResult.error?.response?.data?.message;

      setLoadNotice(
        status === 404
          ? "Competition campaigns are not live on this backend yet. You can still create a new match or join with a code below."
          : message === "Failed to fetch tournaments"
            ? "Live campaigns could not load right now, but match creation and code join are still available below."
            : "Live campaigns could not refresh right now. You can still create a new match or join with a code below.",
      );
    }

    try {
      const socket = await socketService.connect();
      socket.off("tournament:live");
      socket.on("tournament:live", () => loadData(true));
    } catch (error) {
      console.error("Tournament socket setup failed", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      socketService.off("tournament:live");
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
    <Screen style={[styles.screen, { backgroundColor: colors.background }]}>
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
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={[styles.badgePill, { backgroundColor: "rgba(34, 197, 94, 0.12)", borderColor: colors.primary }]}>
              <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {liveCampaignCount} Live Arena{liveCampaignCount === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Swords size={12} color={colors.textSecondary} />
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>Speed Battles</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Compete Live</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Join official university campaigns, launch 1v1 speed battles, or climb the academic leaderboards.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <>
            {loadNotice ? (
              <Card style={[styles.noticeCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Notice</Text>
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>{loadNotice}</Text>
              </Card>
            ) : null}

            {/* Main Action Grid */}
            <View style={styles.actionGrid}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.actionCardPrimary, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate("CreateCompetition")}
              >
                <View style={styles.actionCardIconWrapPrimary}>
                  <Plus size={22} color="#04110A" />
                </View>
                <View style={styles.actionCardBody}>
                  <Text style={styles.actionCardTitlePrimary}>New Match</Text>
                  <Text style={styles.actionCardSubPrimary}>Create private room or duel code</Text>
                </View>
                <Zap size={18} color="#04110A" opacity={0.7} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.88}
                style={[
                  styles.actionCardSecondary,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => navigation.navigate("CompetitionJoinCode")}
              >
                <View style={[styles.actionCardIconWrapSecondary, { backgroundColor: colors.surfaceElevated }]}>
                  <UserPlus size={20} color={colors.primary} />
                </View>
                <View style={styles.actionCardBody}>
                  <Text style={[styles.actionCardTitleSecondary, { color: colors.textPrimary }]}>Join Code</Text>
                  <Text style={[styles.actionCardSubSecondary, { color: colors.textSecondary }]}>Enter match code</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Quick Utilities Row */}
            <View style={styles.utilityGrid}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.utilityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate("CompetitionMatches")}
              >
                <View style={[styles.utilityIcon, { backgroundColor: "rgba(34, 197, 94, 0.1)" }]}>
                  <ListChecks size={18} color={colors.primary} />
                </View>
                <View style={styles.utilityTextWrap}>
                  <Text style={[styles.utilityTitle, { color: colors.textPrimary }]}>My Matches</Text>
                  <Text style={[styles.utilitySub, { color: colors.textSecondary }]}>History & active rooms</Text>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.utilityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate("CompetitionLeaderboard")}
              >
                <View style={[styles.utilityIcon, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                  <Trophy size={18} color="#F59E0B" />
                </View>
                <View style={styles.utilityTextWrap}>
                  <Text style={[styles.utilityTitle, { color: colors.textPrimary }]}>Leaderboard</Text>
                  <Text style={[styles.utilitySub, { color: colors.textSecondary }]}>Global rankings & wins</Text>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Flame size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Featured Campaigns</Text>
              </View>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                {liveCampaignCount} active event{liveCampaignCount === 1 ? "" : "s"}
              </Text>
            </View>

            {/* Featured Hero Campaign Card */}
            {featuredTournament ? (
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() =>
                  navigation.navigate("TournamentDetail", { tournamentId: featuredTournament.id })
                }
              >
                <Card style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {featuredTournament.campaign_banner_url ? (
                    <View style={styles.heroBannerWrap}>
                      <Image
                        source={{ uri: featuredTournament.campaign_banner_url }}
                        style={styles.heroBanner}
                        resizeMode="cover"
                      />
                      <View style={styles.heroBannerOverlay} />
                      <View style={styles.heroFloatingTag}>
                        <Sparkles size={12} color="#04110A" />
                        <Text style={styles.heroFloatingTagText}>
                          {featuredTournament.campaign_preheader || "FEATURED CHALLENGE"}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.heroFallbackBanner, { backgroundColor: colors.surfaceElevated }]}>
                      <View style={styles.heroFloatingTag}>
                        <Sparkles size={12} color="#04110A" />
                        <Text style={styles.heroFloatingTagText}>
                          {featuredTournament.campaign_preheader || "FEATURED CHALLENGE"}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.heroBody}>
                    <Text style={[styles.heroAudience, { color: colors.primary }]}>
                      {campaignAudienceLabel(featuredTournament)}
                    </Text>
                    <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                      {featuredTournament.title}
                    </Text>
                    <Text style={[styles.heroDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                      {featuredTournament.description ||
                        "Join this live Akademi challenge and compete in real time."}
                    </Text>

                    <View style={styles.heroMetaRow}>
                      <View style={styles.heroMetaItem}>
                        <CalendarDays size={13} color={colors.textMuted} />
                        <Text style={[styles.heroMetaText, { color: colors.textSecondary }]}>
                          {formatEventDate(featuredTournament.scheduled_at)}
                        </Text>
                      </View>
                      {featuredTournament.shared_course_code ? (
                        <View style={[styles.courseTag, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                          <Text style={[styles.courseTagText, { color: colors.primary }]}>
                            {featuredTournament.shared_course_code}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {featuredTournament.prize_summary ? (
                      <View style={[styles.prizeCard, { backgroundColor: "rgba(245, 158, 11, 0.1)", borderColor: "rgba(245, 158, 11, 0.3)" }]}>
                        <Trophy size={14} color="#F59E0B" />
                        <Text style={styles.prizeText} numberOfLines={1}>
                          {featuredTournament.prize_summary}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.heroActions}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                          styles.heroPrimaryButton,
                          { backgroundColor: colors.primary },
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
                            !featuredJoinState?.canJoin && { color: colors.textPrimary },
                          ]}
                        >
                          {featuredJoinState?.label || "Register"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[styles.heroGhostButton, { borderColor: colors.border }]}
                        onPress={() =>
                          navigation.navigate("TournamentDetail", {
                            tournamentId: featuredTournament.id,
                          })
                        }
                      >
                        <Text style={[styles.heroGhostButtonText, { color: colors.textPrimary }]}>See Arena</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ) : (
              <Card style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ShieldCheck size={32} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Live Campaigns Yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Published university, faculty, department, and national challenges will show here. You can launch your own match above anytime!
                </Text>
              </Card>
            )}

            {/* Remaining Tournaments List */}
            {remainingTournaments.length > 0 ? (
              <View style={styles.tournamentList}>
                <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Upcoming Events</Text>
                {remainingTournaments.map((tournament) => (
                  <Card
                    key={tournament.id}
                    style={[styles.campaignItemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                      <View style={[styles.campaignThumbFallback, { backgroundColor: colors.surfaceElevated }]}>
                        <Swords size={20} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.campaignItemBody}>
                      <View style={styles.campaignItemTop}>
                        <Text style={[styles.campaignItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {tournament.title}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: "rgba(34, 197, 94, 0.12)" }]}>
                          <Text style={[styles.statusBadgeText, { color: colors.primary }]}>{tournament.status}</Text>
                        </View>
                      </View>
                      <Text style={[styles.campaignItemMeta, { color: colors.textSecondary }]}>
                        {`${tournament.shared_course_code || "Multi-course"} • ${formatEventDate(tournament.scheduled_at)}`}
                      </Text>
                      <Text style={[styles.campaignItemAudience, { color: colors.textMuted }]} numberOfLines={1}>
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
  },
  content: {
    padding: 18,
    paddingBottom: 36,
    gap: 16,
  },
  header: {
    gap: 6,
    marginBottom: 4,
  },
  headerTop: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 4,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  center: {
    paddingTop: 60,
    alignItems: "center",
  },
  noticeCard: {
    gap: 6,
    borderWidth: 1,
    padding: 14,
    borderRadius: 14,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 12,
  },
  actionCardPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },
  actionCardIconWrapPrimary: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCardBody: {
    flex: 1,
    gap: 2,
  },
  actionCardTitlePrimary: {
    fontSize: 15,
    fontWeight: "800",
    color: "#04110A",
  },
  actionCardSubPrimary: {
    fontSize: 11,
    fontWeight: "600",
    color: "#04110A",
    opacity: 0.8,
  },
  actionCardSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  actionCardIconWrapSecondary: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCardTitleSecondary: {
    fontSize: 15,
    fontWeight: "800",
  },
  actionCardSubSecondary: {
    fontSize: 11,
  },
  utilityGrid: {
    flexDirection: "row",
    gap: 10,
  },
  utilityCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  utilityIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityTextWrap: {
    flex: 1,
    gap: 2,
  },
  utilityTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  utilitySub: {
    fontSize: 11,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: "600",
  },
  heroCard: {
    overflow: "hidden",
    padding: 0,
    borderRadius: 18,
    borderWidth: 1,
  },
  heroBannerWrap: {
    position: "relative",
    width: "100%",
    height: 160,
  },
  heroBanner: {
    width: "100%",
    height: "100%",
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  heroFallbackBanner: {
    height: 110,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  heroFloatingTag: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22C55E",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroFloatingTagText: {
    color: "#04110A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heroBody: {
    padding: 16,
    gap: 10,
  },
  heroAudience: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
  },
  heroDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  heroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroMetaText: {
    fontSize: 12,
  },
  courseTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  courseTagText: {
    fontSize: 11,
    fontWeight: "800",
  },
  prizeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  prizeText: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  heroPrimaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  heroPrimaryButtonText: {
    color: "#04110A",
    fontWeight: "800",
    fontSize: 13,
  },
  heroSecondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3F3F46",
  },
  heroGhostButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGhostButtonText: {
    fontWeight: "700",
    fontSize: 13,
  },
  emptyCard: {
    alignItems: "center",
    padding: 24,
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  tournamentList: {
    gap: 10,
  },
  campaignItemCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  campaignThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  campaignThumbFallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  campaignItemBody: {
    flex: 1,
    gap: 4,
  },
  campaignItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  campaignItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  campaignItemMeta: {
    fontSize: 12,
  },
  campaignItemAudience: {
    fontSize: 11,
  },
});
