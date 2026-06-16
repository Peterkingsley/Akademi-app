import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { CompetitionParticipantStatus, CompetitionQuestion, CompetitionRoom, CompetitionScoreboardEntry, competitionService } from "../../services/competition";
import { MainStackParamList } from "../../navigation/types";
import { socketService } from "../../services/socket";
import { useAuthStore } from "../../store/useAuthStore";

type CompetitionLobbyRoute = RouteProp<MainStackParamList, "CompetitionLobby">;

export const CompetitionLobbyScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<CompetitionLobbyRoute>();
  const { user } = useAuthStore();
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
  const wasDisconnectedRef = useRef(false);

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
        setWinnerUserId(null);
      }
    };

    const handleStarted = (payload: { roomId: string }) => {
      if (!mounted || payload.roomId !== route.params.roomId) return;
      setRoom((current) => current ? { ...current, status: "LIVE" } : current);
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
    };

    const handleScoreUpdate = (payload: { roomId: string; scoreboard: CompetitionScoreboardEntry[] }) => {
      if (!mounted || payload.roomId !== route.params.roomId) return;
      setScoreboard(payload.scoreboard);
    };

    const handleMatchEnded = (payload: { roomId: string; winner_user_id?: string | null; scoreboard: CompetitionScoreboardEntry[] }) => {
      if (!mounted || payload.roomId !== route.params.roomId) return;
      setWinnerUserId(payload.winner_user_id || null);
      setScoreboard(payload.scoreboard);
      setQuestion(null);
      setRoom((current) => current ? { ...current, status: "FINISHED" } : current);
      navigation.replace("CompetitionResult", {
        roomId: route.params.roomId,
        winnerUserId: payload.winner_user_id || null,
        scoreboard: payload.scoreboard,
      });
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

    setup();

    return () => {
      mounted = false;
      socketService.emit("competition:leave-room", { roomId: route.params.roomId });
      socketService.off("competition:room-state", handleRoomState);
      socketService.off("competition:started", handleStarted);
      socketService.off("competition:question", handleQuestion);
      socketService.off("competition:score-update", handleScoreUpdate);
      socketService.off("competition:match-ended", handleMatchEnded);
    };
  }, [route.params.roomId]);

  useEffect(() => {
    if (!question) return;
    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [question?.id]);

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

  const secondsLeft = question ? Math.max(0, Math.ceil((new Date(question.expires_at).getTime() - timerNow) / 1000)) : 0;
  const orderedBoard = scoreboard.length > 0 ? scoreboard : (room?.participants || []).map((participant) => ({
    user_id: participant.user_id,
    name: participant.name,
    score: participant.score,
    correct_answers: participant.correct_answers,
    wrong_answers: participant.wrong_answers,
    hasAnsweredCurrent: false,
  }));

  if (loading || !room) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading lobby...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{room.title}</Text>
        <Text style={styles.subtitle}>Share code <Text style={styles.code}>{room.code}</Text> with your opponent.</Text>
        <Text style={styles.socketState}>{socketConnected ? "Live sync connected" : "Reconnecting live sync..."}</Text>
        {timerRecovered && question ? (
          <Text style={styles.resumeState}>Timer resumed from live server state.</Text>
        ) : null}

        <Card style={styles.metaCard}>
          <Text style={styles.metaText}>Format: {room.format === "SHARED_COURSE" ? "Shared course" : "Dual course"}</Text>
          <Text style={styles.metaText}>Course: {room.shared_course_code || "Host/participant picks"}</Text>
          <Text style={styles.metaText}>Questions: {room.question_count}</Text>
          <Text style={styles.metaText}>Timer: {room.question_timer_sec}s each</Text>
          <Text style={styles.metaText}>Status: {room.status}</Text>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Players</Text>
        </View>
        {room.participants.map((participant) => (
          <Card key={participant.id} style={styles.playerCard}>
            <View style={styles.playerTop}>
              <Text style={styles.playerName}>{participant.name}</Text>
              <Text style={styles.playerStatus}>{participant.status}</Text>
            </View>
            <Text style={styles.playerMeta}>{participant.course_code || room.shared_course_code || "Course pending"}</Text>
          </Card>
        ))}

        {room.status === "WAITING" ? (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={loadRoom} disabled={busy}>
              <Text style={styles.secondaryButtonText}>Refresh lobby</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => updateStatus(localStatus === "READY" ? "JOINED" : "READY")}
              disabled={busy}
            >
              <Text style={styles.primaryButtonText}>
                {busy ? "Updating..." : localStatus === "READY" ? "Cancel ready" : "I'm ready"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : room.status === "LIVE" ? (
          <>
            <Card style={styles.liveCard}>
              <Text style={styles.liveTitle}>
                {question ? `Question ${question.index} of ${question.total}` : "Waiting for next question..."}
              </Text>
              {question ? (
                <>
                  <Text style={styles.liveText}>{question.text}</Text>
                  <Text style={styles.timerBadge}>{secondsLeft}s left</Text>
                  <Text style={styles.timerMeta}>Ends at {new Date(question.expires_at).toLocaleTimeString()}</Text>
                  <View style={styles.optionsList}>
                    {question.options.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[styles.optionButton, selectedAnswer === option && styles.optionButtonSelected]}
                        onPress={() => submitAnswer(option)}
                        disabled={!!selectedAnswer}
                      >
                        <Text style={[styles.optionText, selectedAnswer === option && styles.optionTextSelected]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.liveText}>Syncing the live question stream...</Text>
              )}
            </Card>

            <Card style={styles.scoreCard}>
              <Text style={styles.sectionTitle}>Live Scoreboard</Text>
              {orderedBoard.map((entry, index) => (
                <View key={entry.user_id} style={styles.scoreRow}>
                  <Text style={styles.scoreRank}>#{index + 1}</Text>
                  <View style={styles.scoreTextWrap}>
                    <Text style={styles.scoreName}>{entry.name}</Text>
                    <Text style={styles.scoreMeta}>
                      {entry.correct_answers} correct · {entry.wrong_answers} wrong {entry.hasAnsweredCurrent ? "· answered" : ""}
                    </Text>
                  </View>
                  <Text style={styles.scoreValue}>{entry.score}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : (
          <Card style={styles.liveCard}>
            <Text style={styles.liveTitle}>Match finished</Text>
            <Text style={styles.liveText}>
              {winnerUserId
                ? `${orderedBoard.find((entry) => entry.user_id === winnerUserId)?.name || "Winner"} takes the match.`
                : "This match ended without a recorded winner."}
            </Text>
          </Card>
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
    gap: 16,
    paddingBottom: 32,
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
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  socketState: {
    ...typography.caption,
    color: colors.primary,
  },
  resumeState: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  code: {
    color: colors.primary,
    fontWeight: "700",
  },
  metaCard: {
    gap: 8,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  sectionHeader: {
    marginTop: 6,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  playerCard: {
    gap: 8,
  },
  playerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  playerName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  playerStatus: {
    ...typography.caption,
    color: colors.primary,
  },
  playerMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    ...typography.bodySmall,
    color: "#04110A",
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  liveCard: {
    gap: 8,
    backgroundColor: colors.surfaceElevated,
  },
  liveTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  liveText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  timerBadge: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 4,
  },
  timerMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  optionsList: {
    marginTop: 12,
    gap: 10,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  optionText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  scoreCard: {
    gap: 10,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scoreRank: {
    ...typography.caption,
    color: colors.textMuted,
    width: 24,
  },
  scoreTextWrap: {
    flex: 1,
  },
  scoreName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  scoreMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scoreValue: {
    ...typography.body,
    color: colors.primary,
    fontWeight: "700",
  },
});
