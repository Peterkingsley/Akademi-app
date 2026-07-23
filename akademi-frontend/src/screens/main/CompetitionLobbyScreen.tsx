import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Check, CheckCircle2, Clock, Copy, RefreshCw, Shield, Swords, Users, Zap } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { RichMathText } from "../../components/ui/RichMathText";
import {
  CompetitionParticipantStatus,
  CompetitionQuestion,
  CompetitionRoom,
  CompetitionScoreboardEntry,
  competitionService,
} from "../../services/competition";
import { MainStackParamList } from "../../navigation/types";
import { socketService } from "../../services/socket";
import { useAuthStore } from "../../store/useAuthStore";
import { useTheme } from "../../theme/ThemeContext";

type CompetitionLobbyRoute = RouteProp<MainStackParamList, "CompetitionLobby">;

export const CompetitionLobbyScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<CompetitionLobbyRoute>();
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();

  const [room, setRoom] = useState<CompetitionRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [question, setQuestion] = useState<CompetitionQuestion | null>(null);
  const [scoreboard, setScoreboard] = useState<CompetitionScoreboardEntry[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [winnerUserId, setWinnerUserId] = useState<string | null>(null);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [timerRecovered, setTimerRecovered] = useState(false);
  const [resultRevealAt, setResultRevealAt] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const wasDisconnectedRef = useRef(false);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerAnim = useRef(new Animated.Value(1)).current;

  const localStatus = useMemo(() => {
    if (!room) return null;
    return room.participants.find((participant) => participant.user_id === user?.id)?.status ?? null;
  }, [room, user?.id]);

  const loadRoom = async () => {
    try {
      const data = await competitionService.getRoom(route.params.roomId);
      setRoom(data);
    } catch (error: any) {
      Alert.alert("Unable to open match", error?.response?.data?.message || "Please try again.");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoom();
  }, [route.params.roomId]);

  useEffect(() => {
    let mounted = true;

    const handleRoomState = (payload: { room: CompetitionRoom }) => {
      if (!mounted) return;
      setRoom(payload.room);
      setLoading(false);
      if (payload.room.status !== "LIVE") {
        setQuestion(null);
      }
      if (payload.room.status !== "FINISHED") {
        setWinnerUserId(null);
        setResultRevealAt(null);
      }
    };

    const handleStarted = (payload: { roomId: string }) => {
      if (!mounted || payload.roomId !== route.params.roomId) return;
      setRoom((current) => (current ? { ...current, status: "LIVE" } : current));
      setResultRevealAt(null);
    };

    const handleQuestion = (payload: { roomId: string; question: CompetitionQuestion }) => {
      if (!mounted || payload.roomId !== route.params.roomId) return;
      if (wasDisconnectedRef.current) {
        setTimerRecovered(true);
        wasDisconnectedRef.current = false;
      }
      setQuestion(payload.question);
      setSelectedAnswer(null);
      setTimerNow(Date.now());
      timerAnim.setValue(1);
    };

    const handleScoreUpdate = (payload: { roomId: string; scoreboard: CompetitionScoreboardEntry[] }) => {
      if (!mounted || payload.roomId !== route.params.roomId) return;
      setScoreboard(payload.scoreboard);
    };

    const handleMatchEnded = (payload: {
      roomId: string;
      winner_user_id?: string | null;
      scoreboard: CompetitionScoreboardEntry[];
    }) => {
      if (!mounted || payload.roomId !== route.params.roomId) return;
      const revealAt = Date.now() + 20000;
      setWinnerUserId(payload.winner_user_id || null);
      setScoreboard(payload.scoreboard);
      setQuestion(null);
      setSelectedAnswer(null);
      setResultRevealAt(revealAt);
      setRoom((current) => (current ? { ...current, status: "FINISHED" } : current));
      revealTimeoutRef.current = setTimeout(() => {
        navigation.replace("CompetitionResult", {
          roomId: route.params.roomId,
          winnerUserId: payload.winner_user_id || null,
          scoreboard: payload.scoreboard,
        });
      }, 20000);
    };

    const setup = async () => {
      const socket = await socketService.connect();
      if (!mounted) return;
      setSocketConnected(!!socket.connected);
      socket.on("connect", () => {
        setSocketConnected(true);
        if (wasDisconnectedRef.current) {
          socket.emit("competition:join-room", { roomId: route.params.roomId });
        }
      });
      socket.on("disconnect", () => {
        setSocketConnected(false);
        wasDisconnectedRef.current = true;
      });
      socket.on("competition:room-state", handleRoomState);
      socket.on("competition:started", handleStarted);
      socket.on("competition:question", handleQuestion);
      socket.on("competition:score-update", handleScoreUpdate);
      socket.on("competition:match-ended", handleMatchEnded);
      socket.emit("competition:join-room", { roomId: route.params.roomId });
    };

    setup().catch((error) => {
      console.error("Competition lobby setup failed", error);
    });

    return () => {
      mounted = false;
      socketService.emit("competition:leave-room", { roomId: route.params.roomId });
      socketService.off("competition:room-state", handleRoomState);
      socketService.off("competition:started", handleStarted);
      socketService.off("competition:question", handleQuestion);
      socketService.off("competition:score-update", handleScoreUpdate);
      socketService.off("competition:match-ended", handleMatchEnded);
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, [navigation, route.params.roomId]);

  useEffect(() => {
    if (!question && !resultRevealAt) return;
    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [question?.id, resultRevealAt]);

  const copyCode = async () => {
    if (!room?.code) return;
    await Clipboard.setStringAsync(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const updateStatus = async (status: CompetitionParticipantStatus) => {
    try {
      setBusy(true);
      socketService.emit(status === "READY" ? "competition:ready" : "competition:unready", {
        roomId: route.params.roomId,
      });
    } catch (error: any) {
      Alert.alert("Status update failed", error?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    socketService.emit("competition:submit-answer", {
      roomId: route.params.roomId,
      answer,
    });
  };

  const secondsLeft = question
    ? Math.max(0, Math.ceil((new Date(question.expires_at).getTime() - timerNow) / 1000))
    : 0;
  const totalSec = room?.question_timer_sec || 20;
  const timerRatio = Math.min(Math.max(secondsLeft / totalSec, 0), 1);
  const revealSecondsLeft = resultRevealAt
    ? Math.max(0, Math.ceil((resultRevealAt - timerNow) / 1000))
    : 0;
  const answerLocked = !!selectedAnswer || secondsLeft <= 0;

  const orderedBoard =
    scoreboard.length > 0
      ? scoreboard
      : (room?.participants || []).map((participant) => ({
          user_id: participant.user_id,
          name: participant.name,
          score: participant.score,
          correct_answers: participant.correct_answers,
          wrong_answers: participant.wrong_answers,
          hasAnsweredCurrent: false,
        }));

  if (loading || !room) {
    return (
      <Screen style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <RefreshCw size={28} color={colors.primary} style={styles.spinIcon} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Entering Battle Arena...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Arena Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={[styles.syncBadge, { backgroundColor: socketConnected ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)", borderColor: socketConnected ? colors.primary : colors.error }]}>
              <View style={[styles.syncDot, { backgroundColor: socketConnected ? colors.primary : colors.error }]} />
              <Text style={[styles.syncText, { color: socketConnected ? colors.primary : colors.error }]}>
                {socketConnected ? "Live Sync Active" : "Reconnecting..."}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.codeBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={copyCode}
            >
              <Text style={[styles.codeLabel, { color: colors.textMuted }]}>CODE:</Text>
              <Text style={[styles.codeValue, { color: colors.primary }]}>{room.code}</Text>
              {copiedCode ? <Check size={14} color={colors.primary} /> : <Copy size={14} color={colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>{room.title}</Text>
          {timerRecovered && question ? (
            <Text style={[styles.resumeNotice, { color: colors.primary }]}>Timer resumed from live server state</Text>
          ) : null}
        </View>

        {/* Room Info Summary */}
        <Card style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Swords size={14} color={colors.primary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                Format: {room.format === "SHARED_COURSE" ? "Shared Course" : "Dual Course"}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={14} color={colors.primary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {room.question_timer_sec}s / question
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              Course: <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{room.shared_course_code || "Host/Participant Course"}</Text>
            </Text>
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              Total: <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{room.question_count} Qs</Text>
            </Text>
          </View>
        </Card>

        {/* Status Phase Switcher */}
        {room.status === "WAITING" ? (
          <>
            <View style={styles.sectionHeader}>
              <Users size={16} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Combatants ({room.participants.length}/{room.max_participants})</Text>
            </View>

            {room.participants.map((participant) => {
              const isReady = participant.status === "READY";
              const isMe = participant.user_id === user?.id;
              return (
                <Card
                  key={participant.id}
                  style={[
                    styles.playerCard,
                    { backgroundColor: colors.surface, borderColor: isReady ? colors.primary : colors.border },
                  ]}
                >
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerAvatarText}>
                      {participant.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <View style={styles.playerNameRow}>
                      <Text style={[styles.playerName, { color: colors.textPrimary }]}>{participant.name}</Text>
                      {isMe ? <View style={[styles.meChip, { backgroundColor: colors.surfaceElevated }]}><Text style={styles.meChipText}>YOU</Text></View> : null}
                    </View>
                    <Text style={[styles.playerMeta, { color: colors.textSecondary }]}>
                      {participant.course_code || room.shared_course_code || "Course pending"}
                    </Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: isReady ? "rgba(34, 197, 94, 0.15)" : "rgba(245, 158, 11, 0.15)" }]}>
                    <Text style={[styles.statusChipText, { color: isReady ? colors.primary : "#F59E0B" }]}>
                      {isReady ? "READY" : "WAITING"}
                    </Text>
                  </View>
                </Card>
              );
            })}

            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={loadRoom}
                disabled={busy}
              >
                <RefreshCw size={16} color={colors.textPrimary} />
                <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Refresh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.88}
                style={[
                  styles.primaryButton,
                  { backgroundColor: localStatus === "READY" ? colors.surfaceElevated : colors.primary, borderWidth: localStatus === "READY" ? 1 : 0, borderColor: colors.border },
                ]}
                onPress={() => updateStatus(localStatus === "READY" ? "JOINED" : "READY")}
                disabled={busy}
              >
                <Zap size={16} color={localStatus === "READY" ? colors.textPrimary : "#04110A"} />
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: localStatus === "READY" ? colors.textPrimary : "#04110A" },
                  ]}
                >
                  {busy ? "Updating..." : localStatus === "READY" ? "Cancel Ready" : "I'm Ready!"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : room.status === "LIVE" ? (
          <>
            {/* Question Card */}
            <Card style={[styles.liveCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Question Progress Bar */}
              <View style={[styles.timerTrack, { backgroundColor: colors.surfaceElevated }]}>
                <View
                  style={[
                    styles.timerBar,
                    {
                      width: `${timerRatio * 100}%`,
                      backgroundColor: timerRatio < 0.25 ? "#EF4444" : timerRatio < 0.5 ? "#F59E0B" : colors.primary,
                    },
                  ]}
                />
              </View>

              <View style={styles.liveTop}>
                <Text style={[styles.questionCounter, { color: colors.primary }]}>
                  {question ? `QUESTION ${question.index} OF ${question.total}` : "PREPARING QUESTION..."}
                </Text>
                <View style={[styles.timerPill, { backgroundColor: secondsLeft <= 5 ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)" }]}>
                  <Clock size={12} color={secondsLeft <= 5 ? "#EF4444" : colors.primary} />
                  <Text style={[styles.timerPillText, { color: secondsLeft <= 5 ? "#EF4444" : colors.primary }]}>
                    {secondsLeft}s
                  </Text>
                </View>
              </View>

              {question ? (
                <>
                  <View style={styles.questionBox}>
                    <RichMathText
                      content={question.text}
                      textColor={colors.textPrimary}
                      fontSize={15}
                      lineHeight={1.5}
                    />
                  </View>

                  <View style={styles.optionsList}>
                    {question.options.map((option, idx) => {
                      const isSelected = selectedAnswer === option;
                      const optionLabel = String.fromCharCode(65 + idx);
                      return (
                        <TouchableOpacity
                          key={option}
                          activeOpacity={0.85}
                          style={[
                            styles.optionButton,
                            { backgroundColor: isSelected ? "rgba(34, 197, 94, 0.12)" : colors.surfaceElevated, borderColor: isSelected ? colors.primary : colors.border },
                          ]}
                          onPress={() => submitAnswer(option)}
                          disabled={answerLocked}
                        >
                          <View style={[styles.optionBadge, { backgroundColor: isSelected ? colors.primary : colors.surface, borderColor: isSelected ? colors.primary : colors.border }]}>
                            <Text style={[styles.optionBadgeText, { color: isSelected ? "#04110A" : colors.textSecondary }]}>
                              {optionLabel}
                            </Text>
                          </View>
                          <View style={styles.optionContent}>
                            <RichMathText
                              content={option}
                              textColor={isSelected ? colors.primary : colors.textPrimary}
                              fontSize={14}
                              lineHeight={1.4}
                            />
                          </View>
                          {isSelected ? <CheckCircle2 size={18} color={colors.primary} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : (
                <View style={styles.syncingBox}>
                  <RefreshCw size={24} color={colors.primary} style={styles.spinIcon} />
                  <Text style={[styles.syncingText, { color: colors.textSecondary }]}>Syncing live question stream...</Text>
                </View>
              )}
            </Card>

            {/* Live Score Board Status */}
            <Card style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.scoreHeader}>
                <Shield size={16} color={colors.primary} />
                <Text style={[styles.scoreTitle, { color: colors.textPrimary }]}>Live Opponent Tracker</Text>
              </View>
              {orderedBoard.map((entry, index) => (
                <View key={entry.user_id} style={[styles.scoreRow, { borderColor: colors.border }]}>
                  <Text style={[styles.scoreRank, { color: colors.textMuted }]}>#{index + 1}</Text>
                  <View style={styles.scoreTextWrap}>
                    <Text style={[styles.scoreName, { color: colors.textPrimary }]}>{entry.name}</Text>
                    <Text style={[styles.scoreMeta, { color: entry.hasAnsweredCurrent ? colors.primary : colors.textMuted }]}>
                      {entry.hasAnsweredCurrent ? "✓ Answered this question" : "••• Thinking..."}
                    </Text>
                  </View>
                  <View style={[styles.liveStatusPill, { backgroundColor: entry.hasAnsweredCurrent ? "rgba(34, 197, 94, 0.12)" : colors.surfaceElevated }]}>
                    <Text style={[styles.liveStatusText, { color: entry.hasAnsweredCurrent ? colors.primary : colors.textMuted }]}>
                      {entry.hasAnsweredCurrent ? "SUBMITTED" : "IN PROGRESS"}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : (
          /* Match Finished Phase */
          <Card style={[styles.finishedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Swords size={36} color={colors.primary} />
            <Text style={[styles.finishedTitle, { color: colors.textPrimary }]}>Match Concluded!</Text>
            <Text style={[styles.finishedText, { color: colors.textSecondary }]}>
              {winnerUserId
                ? `${orderedBoard.find((entry) => entry.user_id === winnerUserId)?.name || "Winner"} takes the battle.`
                : "Match completed."}
            </Text>
            <View style={[styles.revealBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Clock size={16} color={colors.primary} />
              <Text style={[styles.revealText, { color: colors.primary }]}>
                Preparing final results in {revealSecondsLeft || 20}s...
              </Text>
            </View>
          </Card>
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
    gap: 14,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  spinIcon: {
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "700",
  },
  header: {
    gap: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncText: {
    fontSize: 11,
    fontWeight: "700",
  },
  codeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  codeValue: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  resumeNotice: {
    fontSize: 12,
    fontWeight: "600",
  },
  metaCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerAvatarText: {
    color: "#22C55E",
    fontSize: 14,
    fontWeight: "800",
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "700",
  },
  meChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  meChipText: {
    color: "#22C55E",
    fontSize: 9,
    fontWeight: "800",
  },
  playerMeta: {
    fontSize: 12,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  liveCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  timerTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
  },
  timerBar: {
    height: "100%",
    borderRadius: 2,
  },
  liveTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  questionCounter: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timerPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  questionBox: {
    paddingVertical: 6,
  },
  optionsList: {
    gap: 10,
    marginTop: 4,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  optionContent: {
    flex: 1,
  },
  syncingBox: {
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  syncingText: {
    fontSize: 13,
  },
  scoreCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  scoreHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  scoreRank: {
    fontSize: 12,
    fontWeight: "700",
    width: 20,
  },
  scoreTextWrap: {
    flex: 1,
    gap: 2,
  },
  scoreName: {
    fontSize: 13,
    fontWeight: "700",
  },
  scoreMeta: {
    fontSize: 11,
    fontWeight: "600",
  },
  liveStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveStatusText: {
    fontSize: 9,
    fontWeight: "800",
  },
  finishedCard: {
    alignItems: "center",
    padding: 28,
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  finishedTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  finishedText: {
    fontSize: 14,
    textAlign: "center",
  },
  revealBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 6,
  },
  revealText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
