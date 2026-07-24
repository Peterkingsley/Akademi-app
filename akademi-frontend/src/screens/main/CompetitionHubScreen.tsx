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
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Flame,
  ListChecks,
  MoreVertical,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UserPlus,
  Zap,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
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

const formatCalendarDate = (value: string) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Upcoming";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;

  const diffDays = (date.getTime() - now.getTime()) / (1000 * 3600 * 24);
  if (diffDays > 0 && diffDays < 7) {
    const dayName = date.toLocaleDateString([], { weekday: "long" });
    return `${dayName} at ${timeStr}`;
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

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

// Preset Akademi Brand Emerald Green Gradients
const GRADIENT_PALETTES: Array<readonly [string, string, ...string[]]> = [
  ["#15803D", "#22C55E"],
  ["#059669", "#10B981"],
  ["#16A34A", "#047857"],
  ["#047857", "#22C55E"],
];

export const CompetitionHubScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
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

  const liveTournaments = useMemo(
    () => tournaments.filter((t) => t.status === "LIVE" || t.status === "PUBLISHED" || t.status === "COMPLETED"),
    [tournaments],
  );

  // Strictly upcoming future events (not past / not completed)
  const upcomingTournaments = useMemo(
    () =>
      tournaments.filter(
        (t) =>
          t.status !== "LIVE" &&
          t.status !== "COMPLETED" &&
          new Date(t.scheduled_at).getTime() > Date.now(),
      ),
    [tournaments],
  );

  const liveCampaignCount = liveTournaments.filter((t) => t.status === "LIVE").length;

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

            {/* 4-Button Compact Horizontal Toolbar */}
            <View style={styles.compactToolbar}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.compactBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => navigation.navigate("CreateCompetition")}
              >
                <View style={[styles.compactIconWrap, { backgroundColor: "rgba(4, 17, 10, 0.15)" }]}>
                  <Plus size={18} color="#04110A" />
                </View>
                <Text style={[styles.compactBtnText, { color: "#04110A" }]} numberOfLines={1} adjustsFontSizeToFit>
                  New Match
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.compactBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate("CompetitionJoinCode")}
              >
                <View style={[styles.compactIconWrap, { backgroundColor: colors.surfaceElevated }]}>
                  <UserPlus size={18} color={colors.primary} />
                </View>
                <Text style={[styles.compactBtnText, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                  Join Code
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.compactBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate("CompetitionMatches")}
              >
                <View style={[styles.compactIconWrap, { backgroundColor: colors.surfaceElevated }]}>
                  <ListChecks size={18} color={colors.primary} />
                </View>
                <Text style={[styles.compactBtnText, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                  My Matches
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.compactBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate("CompetitionLeaderboard")}
              >
                <View style={[styles.compactIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                  <Trophy size={18} color="#F59E0B" />
                </View>
                <Text style={[styles.compactBtnText, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                  Leaderboard
                </Text>
              </TouchableOpacity>
            </View>

            {/* Happening Now Section (X Spaces Live Cards) */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Happening Now</Text>
                <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Spaces going on right now</Text>
              </View>
            </View>

            {liveTournaments.length > 0 ? (
              <View style={styles.liveCardsList}>
                {liveTournaments.map((tournament, index) => {
                  const isOngoingLive = tournament.status === "LIVE";
                  const gradientColors = GRADIENT_PALETTES[index % GRADIENT_PALETTES.length];
                  return (
                    <TouchableOpacity
                      key={tournament.id}
                      activeOpacity={0.92}
                      onPress={() =>
                        navigation.navigate("TournamentDetail", { tournamentId: tournament.id })
                      }
                    >
                      <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.spacesCard}
                      >
                        {/* Top Bar: LIVE / ENDED Tag */}
                        <View style={styles.spacesTopRow}>
                          <View style={[styles.spacesLivePill, !isOngoingLive && styles.spacesEndedPill]}>
                            {isOngoingLive ? (
                              <Text style={styles.spacesLiveText}>• LIVE</Text>
                            ) : (
                              <Text style={styles.spacesLiveText}>ENDED</Text>
                            )}
                          </View>
                        </View>

                        {/* Title */}
                        <Text style={styles.spacesTitle} numberOfLines={2}>
                          {tournament.title}
                        </Text>

                        {/* Avatars & Listener/Joined Count */}
                        <View style={styles.spacesAudienceRow}>
                          <View style={styles.avatarStack}>
                            <View style={[styles.avatarBubble, { backgroundColor: "#34D399" }]}>
                              <Text style={styles.avatarText}>A</Text>
                            </View>
                            <View style={[styles.avatarBubble, styles.avatarOverlap1, { backgroundColor: "#059669" }]}>
                              <Text style={styles.avatarText}>K</Text>
                            </View>
                            <View style={[styles.avatarBubble, styles.avatarOverlap2, { backgroundColor: "#10B981" }]}>
                              <Text style={styles.avatarText}>D</Text>
                            </View>
                          </View>
                          <Text style={styles.spacesListeningText}>
                            {isOngoingLive
                              ? `${tournament.entry_count ?? 0} listening`
                              : `${tournament.entry_count ?? 0} joined`}
                          </Text>
                        </View>

                        {/* Host Row */}
                        <View style={styles.spacesHostRow}>
                          <View style={styles.hostAvatar}>
                            <Text style={styles.hostAvatarText}>
                              {(tournament.shared_course_code || "A")[0].toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.hostName} numberOfLines={1}>
                            {tournament.shared_course_code || "Akademi Host"}
                          </Text>
                          <View style={styles.hostPill}>
                            <Text style={styles.hostPillText}>Host</Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Card style={[styles.emptySpacesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Radio size={28} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Live Spaces Right Now</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  When live competitive spaces start on campus, they will appear here first!
                </Text>
              </Card>
            )}

            {/* Get these in your calendar Section (Strictly Upcoming Events Only) */}
            <View style={[styles.sectionHeader, { marginTop: 14 }]}>
              <View style={styles.sectionTitleWrap}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Get these in your calendar</Text>
                <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                  People you follow will be tuning in
                </Text>
              </View>
            </View>

            {upcomingTournaments.length > 0 ? (
              <View style={styles.calendarList}>
                {upcomingTournaments.map((tournament) => (
                  <TouchableOpacity
                    key={tournament.id}
                    activeOpacity={0.88}
                    style={styles.calendarItem}
                    onPress={() =>
                      navigation.navigate("TournamentDetail", { tournamentId: tournament.id })
                    }
                  >
                    {/* Squircle Thumbnail / Icon */}
                    {tournament.campaign_banner_url ? (
                      <Image
                        source={{ uri: tournament.campaign_banner_url }}
                        style={styles.squircleThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <LinearGradient
                        colors={["#059669", "#22C55E"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.squircleThumbFallback}
                      >
                        <Swords size={22} color="#FFFFFF" />
                      </LinearGradient>
                    )}

                    {/* Body Content */}
                    <View style={styles.calendarItemBody}>
                      <Text style={[styles.calendarHost, { color: colors.textMuted }]} numberOfLines={1}>
                        {tournament.shared_course_code || "Akademi Host"}
                      </Text>

                      <Text style={[styles.calendarTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                        {tournament.title}
                      </Text>

                      <Text style={[styles.calendarDate, { color: colors.primary }]}>
                        {formatCalendarDate(tournament.scheduled_at)}
                      </Text>

                      <Text style={[styles.calendarGoing, { color: colors.textSecondary }]}>
                        {`${tournament.entry_count ?? 0} going`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Card style={[styles.emptySpacesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <CalendarDays size={28} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Upcoming Events</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Scheduled campus competitions will show here in your calendar!
                </Text>
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
  compactToolbar: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 4,
  },
  compactBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  compactIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  compactBtnText: {
    fontSize: 10.5,
    fontWeight: "800",
    textAlign: "center",
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 4,
  },
  sectionTitleWrap: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  sectionSub: {
    fontSize: 13,
  },
  liveCardsList: {
    gap: 14,
  },
  spacesCard: {
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  spacesTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spacesLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  spacesEndedPill: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  spacesLiveText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  spacesMoreBtn: {
    padding: 2,
  },
  spacesTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 25,
  },
  spacesAudienceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#15803D",
  },
  avatarOverlap1: {
    marginLeft: -8,
  },
  avatarOverlap2: {
    marginLeft: -8,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  spacesListeningText: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: 13,
    fontWeight: "700",
  },
  spacesHostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  hostAvatarText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  hostName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  hostPill: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hostPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  emptySpacesCard: {
    alignItems: "center",
    padding: 28,
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
  calendarList: {
    gap: 16,
    marginTop: 6,
  },
  calendarItem: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  squircleThumb: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  squircleThumbFallback: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarItemBody: {
    flex: 1,
    gap: 4,
  },
  calendarItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calendarHost: {
    fontSize: 12,
    fontWeight: "600",
  },
  calendarItemIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  calendarDate: {
    fontSize: 13,
    fontWeight: "700",
  },
  calendarGoing: {
    fontSize: 12,
    fontWeight: "600",
  },
});
