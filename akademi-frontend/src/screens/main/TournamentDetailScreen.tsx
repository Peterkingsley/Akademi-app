import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CalendarDays, Eye, Heart, Lock, Share2, Swords, Trophy, Users } from "lucide-react-native";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService, Tournament, TournamentArena } from "../../services/competition";
import { socketService } from "../../services/socket";
import { useAuthStore } from "../../store/useAuthStore";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const BUBBLE_CHART_WIDTH = 320;
const BUBBLE_CHART_HEIGHT = 360;

type LeaderboardEntry = NonNullable<TournamentArena["leaderboard"]>[number];

export const TournamentDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { tournamentId } = route.params;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [arena, setArena] = useState<TournamentArena | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveCheerCount, setLiveCheerCount] = useState(0);
  const [spectatorViewMode, setSpectatorViewMode] = useState<"BUBBLE" | "LIST">("BUBBLE");
  const cheerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRadiusRefs = useRef<Record<string, Animated.Value>>({});
  const bubblePulseRefs = useRef<Record<string, Animated.Value>>({});
  const currentUserId = useAuthStore((state) => state.user?.id);
  const rankedLeaderboard = useMemo(
    () =>
      [...(arena?.leaderboard || [])].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((b.correct_answers || 0) !== (a.correct_answers || 0)) {
          return (b.correct_answers || 0) - (a.correct_answers || 0);
        }
        return (b.love_count || 0) - (a.love_count || 0);
      }),
    [arena?.leaderboard],
  );
  const scoreStats = useMemo(() => {
    const scores = rankedLeaderboard.map((entry) => entry.score);
    const highest = Math.max(...scores, 1);
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    return { highest, average };
  }, [rankedLeaderboard]);
  const bubbleEntries = useMemo(() => {
    const minRadius = 34;
    const maxRadius = 72;
    let cursorX = maxRadius + 8;
    let cursorY = maxRadius + 12;
    let rowHeight = 0;

    return rankedLeaderboard.slice(0, 18).map((entry) => {
      const scoreRatio = scoreStats.highest ? Math.max(entry.score / scoreStats.highest, 0.18) : 0.18;
      const radius = minRadius + (maxRadius - minRadius) * scoreRatio;
      if (cursorX + radius > BUBBLE_CHART_WIDTH - 8) {
        cursorX = radius + 8;
        cursorY += rowHeight + 16;
        rowHeight = 0;
      }
      const bubble = {
        ...entry,
        radius,
        cx: cursorX,
        cy: Math.min(cursorY, BUBBLE_CHART_HEIGHT - radius - 12),
        color: entry.score >= scoreStats.average ? "#304000" : "#EF4444",
        firstName: entry.display_name.split(" ")[0] || "Player",
      };
      cursorX += radius * 2 + 14;
      rowHeight = Math.max(rowHeight, radius * 2);
      return bubble;
    });
  }, [rankedLeaderboard, scoreStats.average, scoreStats.highest]);

  const loadTournament = async () => {
    try {
      setLoading(true);
      const [data, arenaData] = await Promise.all([
        competitionService.getTournament(tournamentId),
        competitionService.getTournamentArena(tournamentId).catch(() => null),
      ]);
      setTournament(data);
      if (arenaData) {
        setArena(arenaData);
        setTournament(arenaData.tournament);
      }
    } catch (error: any) {
      Alert.alert("Unable to load tournament", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournament();
  }, [tournamentId]);

  const pulseBubble = (userId?: string | null) => {
    if (!userId) return;
    if (!bubblePulseRefs.current[userId]) {
      bubblePulseRefs.current[userId] = new Animated.Value(1);
    }
    const pulse = bubblePulseRefs.current[userId];
    pulse.setValue(1);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.18, duration: 160, useNativeDriver: false }),
      Animated.spring(pulse, { toValue: 1, friction: 3, tension: 70, useNativeDriver: false }),
    ]).start();
  };

  useEffect(() => {
    bubbleEntries.forEach((entry) => {
      if (!bubbleRadiusRefs.current[entry.user_id]) {
        bubbleRadiusRefs.current[entry.user_id] = new Animated.Value(entry.radius);
      }
      if (!bubblePulseRefs.current[entry.user_id]) {
        bubblePulseRefs.current[entry.user_id] = new Animated.Value(1);
      }
      Animated.timing(bubbleRadiusRefs.current[entry.user_id], {
        toValue: entry.radius,
        duration: 360,
        useNativeDriver: false,
      }).start();
    });
  }, [bubbleEntries]);

  useEffect(() => {
    const handleTournamentLive = (payload: { tournamentId: string; roomId: string }) => {
      if (payload.tournamentId !== tournamentId) return;
      loadTournament();
      Alert.alert("Tournament is live", "Your event room is ready. Jump in now.", [
        { text: "Later", style: "cancel" },
        { text: "Open", onPress: () => navigation.navigate("CompetitionLobby", { roomId: payload.roomId }) },
      ]);
    };
    const handleTournamentCheer = (payload: { tournamentId: string; stageId?: string | null; spectatorUserId?: string }) => {
      if (payload.tournamentId !== tournamentId) return;
      setLiveCheerCount((count) => count + 1);
      pulseBubble(currentUserId);
      if (cheerTimeoutRef.current) clearTimeout(cheerTimeoutRef.current);
      cheerTimeoutRef.current = setTimeout(() => setLiveCheerCount(0), 4500);
      setTournament((current) =>
        current
          ? {
              ...current,
              cheer_count: (current.cheer_count || 0) + 1,
            }
          : current,
      );
      setArena((current) =>
        current
          ? {
              ...current,
              stats: {
                ...current.stats,
                total_loves: (current.stats.total_loves || 0) + 1,
              },
              leaderboard: current.leaderboard
                .map((entry) =>
                  entry.user_id === currentUserId
                    ? { ...entry, love_count: entry.love_count + 1 }
                    : entry,
                )
                .sort((a, b) => {
                  if (b.score !== a.score) return b.score - a.score;
                  if ((b.correct_answers || 0) !== (a.correct_answers || 0)) {
                    return (b.correct_answers || 0) - (a.correct_answers || 0);
                  }
                  return (b.love_count || 0) - (a.love_count || 0);
                }),
            }
          : current,
      );
    };
    const handleArenaRefresh = (payload: { tournamentId?: string; roomId?: string }) => {
      if (payload.tournamentId && payload.tournamentId !== tournamentId) return;
      if (!payload.tournamentId && payload.roomId && payload.roomId !== tournament?.room_id) return;
      loadTournament();
    };

    const setup = async () => {
      const socket = await socketService.connect();
      socket.on("tournament:live", handleTournamentLive);
      socket.on("tournament:cheer", handleTournamentCheer);
      socket.on("tournament:arena-update", handleArenaRefresh);
      socket.on("competition:score-update", handleArenaRefresh);
    };

    setup().catch((error) => console.error("Tournament live listener failed", error));

    return () => {
      socketService.off("tournament:live", handleTournamentLive);
      socketService.off("tournament:cheer", handleTournamentCheer);
      socketService.off("tournament:arena-update", handleArenaRefresh);
      socketService.off("competition:score-update", handleArenaRefresh);
      if (cheerTimeoutRef.current) clearTimeout(cheerTimeoutRef.current);
    };
  }, [currentUserId, navigation, tournament?.room_id, tournamentId]);

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

  const registerInterest = async (interestType: "PARTICIPANT" | "SPECTATOR") => {
    try {
      const updated = await competitionService.registerTournamentInterest(tournamentId, interestType);
      setTournament(updated);
      const arenaData = await competitionService.getTournamentArena(tournamentId);
      setArena(arenaData);
    } catch (error: any) {
      Alert.alert("Unable to follow campaign", error?.response?.data?.message || "Please try again.");
    }
  };

  const cheerParticipant = async (participantUserId: string) => {
    try {
      const updated = await competitionService.sendTournamentCheer(
        tournamentId,
        participantUserId,
        arena?.current_stage?.id,
      );
      setArena(updated);
      setTournament(updated.tournament);
      pulseBubble(participantUserId);
    } catch (error: any) {
      Alert.alert("Unable to cheer", error?.response?.data?.message || "Please try again.");
    }
  };

  const predictParticipant = async (participantUserId: string) => {
    try {
      const updated = await competitionService.submitTournamentPrediction(
        tournamentId,
        participantUserId,
        arena?.current_stage?.id,
      );
      setArena(updated);
      setTournament(updated.tournament);
    } catch (error: any) {
      Alert.alert("Unable to predict", error?.response?.data?.message || "Please try again.");
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
  const isParticipant = !!tournament.joined && tournament.entry_status !== "ELIMINATED";
  const isSpectator = !isParticipant;
  const predictedEntry = tournament.predicted_user_id
    ? rankedLeaderboard.find((entry) => entry.user_id === tournament.predicted_user_id)
    : null;
  const openParticipantActions = (entry: LeaderboardEntry) => {
    const actions: Array<{ text: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }> = [];
    if (tournament.prediction_enabled && !tournament.predicted_user_id) {
      actions.push({ text: `Predict ${entry.display_name}`, onPress: () => predictParticipant(entry.user_id) });
    }
    if (tournament.prediction_enabled && tournament.predicted_user_id === entry.user_id) {
      actions.push({ text: "Prediction locked", style: "cancel" });
    }
    actions.push({ text: `Cheer ${entry.display_name}`, onPress: () => cheerParticipant(entry.user_id) });
    actions.push({ text: "Cancel", style: "cancel" });
    Alert.alert(entry.display_name, `${entry.score} pts - ${entry.love_count} cheers`, actions);
  };

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

        {liveCheerCount > 0 ? (
          <Card style={styles.liveCheerCard}>
            <View style={styles.liveCheerIcon}>
              <Heart size={18} color={colors.primary} fill={colors.primary} />
            </View>
            <View style={styles.liveCheerCopy}>
              <Text style={styles.liveCheerTitle}>
                {liveCheerCount === 1 ? "Someone is cheering you" : `${liveCheerCount} fresh cheers just came in`}
              </Text>
              <Text style={styles.liveCheerText}>Your supporters are watching this campaign live.</Text>
            </View>
          </Card>
        ) : null}

        {tournament.campaign_type === "MULTI_STAGE" || (tournament.stages?.length || 0) > 0 ? (
          <Card style={styles.arenaCard}>
            <View style={styles.arenaHeader}>
              <View>
                <Text style={styles.campaignEyebrow}>Campaign arena</Text>
                <Text style={styles.campaignTitle}>
                  {arena?.current_stage ? arena.current_stage.name : "Stage tracker"}
                </Text>
              </View>
              <Text style={styles.statusPill}>{tournament.campaign_type === "MULTI_STAGE" ? "Multi-stage" : tournament.status}</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Users size={15} color={colors.primary} />
                <Text style={styles.statValue}>{arena?.stats.participants ?? tournament.entry_count}</Text>
                <Text style={styles.statLabel}>Players</Text>
              </View>
              <View style={styles.statBox}>
                <Eye size={15} color={colors.primary} />
                <Text style={styles.statValue}>{arena?.stats.spectators ?? 0}</Text>
                <Text style={styles.statLabel}>Spectators</Text>
              </View>
              <View style={styles.statBox}>
                <Heart size={15} color={colors.primary} />
                <Text style={styles.statValue}>{arena?.stats.total_loves ?? tournament.cheer_count ?? 0}</Text>
                <Text style={styles.statLabel}>Cheers</Text>
              </View>
            </View>

            <View style={styles.stageList}>
              {(arena?.stage_tracker || tournament.stages || []).map((stage) => (
                <View key={stage.id} style={styles.stageRow}>
                  <View style={[styles.stageDot, stage.status === "LIVE" && styles.stageDotLive]} />
                  <View style={styles.stageContent}>
                    <Text style={styles.stageTitle}>{stage.name}</Text>
                    <Text style={styles.stageMeta}>
                      {`${formatDateTime(stage.starts_at)} • ${stage.duration_minutes}m • Top ${stage.qualification_count || 1} qualify`}
                    </Text>
                  </View>
                  <Text style={styles.stageStatus}>{stage.status}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <View style={styles.interestRow}>
          <TouchableOpacity
            style={styles.interestButton}
            onPress={() => registerInterest("PARTICIPANT")}
          >
            <Users size={16} color={colors.primary} />
            <Text style={styles.interestText}>Compete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.interestButton}
            onPress={() => registerInterest("SPECTATOR")}
          >
            <Eye size={16} color={colors.primary} />
            <Text style={styles.interestText}>Watch</Text>
          </TouchableOpacity>
          {tournament.share_token ? (
            <View style={styles.interestButton}>
              <Share2 size={16} color={colors.primary} />
              <Text style={styles.interestText} numberOfLines={1}>Share ready</Text>
            </View>
          ) : null}
        </View>

        {rankedLeaderboard.length ? (
          <Card style={styles.leaderboardCard}>
            <Text style={styles.campaignEyebrow}>Live spectator leaderboard</Text>
            <Text style={styles.campaignText}>
              {isSpectator
                ? "Bubble size follows score. Green bubbles are above average, red bubbles are below average."
                : "Ranked by score, with live support shown beside each contestant."}
            </Text>
            {tournament.prediction_enabled && tournament.predicted_user_id ? (
              <View style={styles.predictionLockedBanner}>
                <Lock size={14} color={colors.primary} />
                <Text style={styles.predictionLockedText}>
                  Prediction locked: {predictedEntry?.display_name || "your selected contestant"}
                </Text>
              </View>
            ) : null}
            {isSpectator ? (
              <View style={styles.viewToggleRow}>
                <TouchableOpacity
                  style={[styles.viewToggleButton, spectatorViewMode === "BUBBLE" && styles.viewToggleButtonActive]}
                  onPress={() => setSpectatorViewMode("BUBBLE")}
                >
                  <Text style={[styles.viewToggleText, spectatorViewMode === "BUBBLE" && styles.viewToggleTextActive]}>
                    Bubble View
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewToggleButton, spectatorViewMode === "LIST" && styles.viewToggleButtonActive]}
                  onPress={() => setSpectatorViewMode("LIST")}
                >
                  <Text style={[styles.viewToggleText, spectatorViewMode === "LIST" && styles.viewToggleTextActive]}>
                    List View
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {isSpectator && spectatorViewMode === "BUBBLE" ? (
              <View style={styles.bubbleChartWrap}>
                <Svg width="100%" height={BUBBLE_CHART_HEIGHT} viewBox={`0 0 ${BUBBLE_CHART_WIDTH} ${BUBBLE_CHART_HEIGHT}`}>
                  {bubbleEntries.map((entry) => {
                    const animatedRadius = bubbleRadiusRefs.current[entry.user_id] || new Animated.Value(entry.radius);
                    const pulse = bubblePulseRefs.current[entry.user_id] || new Animated.Value(1);
                    const displayRadius = Animated.multiply(animatedRadius, pulse);
                    return (
                      <G key={entry.user_id} onPress={() => openParticipantActions(entry)}>
                        <AnimatedCircle
                          cx={entry.cx}
                          cy={entry.cy}
                          r={displayRadius as any}
                          fill={entry.color}
                          fillOpacity={0.2}
                          stroke={entry.color}
                          strokeWidth={2}
                        />
                        <SvgText
                          x={entry.cx}
                          y={entry.cy - 6}
                          fill="#FFFFFF"
                          fontSize={entry.radius > 56 ? 13 : 11}
                          fontWeight="700"
                          textAnchor="middle"
                        >
                          {entry.firstName}
                        </SvgText>
                        <SvgText
                          x={entry.cx}
                          y={entry.cy + 12}
                          fill="#FFFFFF"
                          fontSize={entry.radius > 56 ? 15 : 12}
                          fontWeight="800"
                          textAnchor="middle"
                        >
                          {entry.score}
                        </SvgText>
                        <Circle cx={entry.cx + entry.radius * 0.62} cy={entry.cy - entry.radius * 0.56} r={15} fill={colors.surface} stroke={entry.color} strokeWidth={1.5} />
                        <SvgText x={entry.cx + entry.radius * 0.62} y={entry.cy - entry.radius * 0.56 + 4} fill={colors.primary} fontSize={10} fontWeight="800" textAnchor="middle">
                          {`♥ ${entry.love_count}`}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </View>
            ) : null}
            {(!isSpectator || spectatorViewMode === "LIST") && rankedLeaderboard.slice(0, 12).map((entry, index) => (
              <View key={entry.user_id} style={styles.leaderRow}>
                <Text style={styles.leaderRank}>{entry.rank || index + 1}</Text>
                <View style={styles.leaderInfo}>
                  <Text style={styles.leaderName}>{entry.display_name}</Text>
                  <Text style={styles.leaderMeta}>
                    {`${entry.score} pts • ${entry.correct_answers} correct • ${entry.love_count} cheers`}
                  </Text>
                </View>
                <View style={styles.leaderActions}>
                  {tournament.prediction_enabled && !tournament.predicted_user_id ? (
                    <TouchableOpacity style={styles.iconButton} onPress={() => predictParticipant(entry.user_id)}>
                      <Trophy size={14} color={colors.primary} />
                    </TouchableOpacity>
                  ) : tournament.prediction_enabled && tournament.predicted_user_id === entry.user_id ? (
                    <View style={styles.lockedPickPill}>
                      <Lock size={12} color={colors.primary} />
                      <Text style={styles.lockedPickText}>Picked</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity style={styles.iconButton} onPress={() => cheerParticipant(entry.user_id)}>
                    <Heart size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

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
  liveCheerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderColor: colors.primary,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  liveCheerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 197, 94, 0.16)",
  },
  liveCheerCopy: {
    flex: 1,
    gap: 3,
  },
  liveCheerTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  liveCheerText: {
    ...typography.caption,
    color: colors.textSecondary,
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
  arenaCard: {
    gap: 14,
  },
  arenaHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  statusPill: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statBox: {
    flex: 1,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  statValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  stageList: {
    gap: 10,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  stageDotLive: {
    backgroundColor: colors.primary,
  },
  stageContent: {
    flex: 1,
    gap: 2,
  },
  stageTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  stageMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  stageStatus: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  interestRow: {
    flexDirection: "row",
    gap: 10,
  },
  interestButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
  },
  interestText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  leaderboardCard: {
    gap: 12,
  },
  viewToggleRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 4,
    backgroundColor: colors.surfaceElevated,
  },
  viewToggleButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggleButtonActive: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
  },
  viewToggleText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "800",
  },
  viewToggleTextActive: {
    color: colors.primary,
  },
  bubbleChartWrap: {
    height: BUBBLE_CHART_HEIGHT,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  leaderRank: {
    width: 24,
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "800",
  },
  leaderInfo: {
    flex: 1,
    gap: 3,
  },
  leaderName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  leaderMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  leaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  predictionLockedBanner: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceElevated,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  predictionLockedText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    flex: 1,
  },
  lockedPickPill: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  lockedPickText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800",
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
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


