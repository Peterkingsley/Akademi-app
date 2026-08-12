import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Award, CheckCircle2, ChevronRight, Home, Medal, RotateCcw, Swords, Target, Trophy } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { useAuthStore } from "../../store/useAuthStore";
import { competitionService } from "../../services/competition";
import { useTheme } from "../../theme/ThemeContext";

type ScoreEntry = {
  user_id: string;
  name: string;
  score: number;
  correct_answers: number;
  wrong_answers: number;
  hasAnsweredCurrent: boolean;
};

export const CompetitionResultScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();
  const { colors, typeScale, radius, controlSize, contentWidth } = useTheme();
  const user = useAuthStore((state) => state.user);
  const { roomId, winnerUserId, scoreboard = [] } = route.params || {};
  const [rematching, setRematching] = useState(false);
  const isWide = width >= 600;

  const standings = useMemo(
    () => [...(scoreboard as ScoreEntry[])].sort((a, b) => b.score - a.score || b.correct_answers - a.correct_answers),
    [scoreboard],
  );
  const winner = standings.find((entry) => entry.user_id === winnerUserId) || standings[0] || null;
  const currentStudent = standings.find((entry) => entry.user_id === user?.id) || null;
  const currentRank = currentStudent ? standings.findIndex((entry) => entry.user_id === currentStudent.user_id) + 1 : null;
  const studentWon = Boolean(currentStudent && winner && currentStudent.user_id === winner.user_id);
  const attempts = (currentStudent?.correct_answers || 0) + (currentStudent?.wrong_answers || 0);
  const accuracy = attempts ? Math.round(((currentStudent?.correct_answers || 0) / attempts) * 100) : 0;
  const initial = winner?.name?.trim()?.charAt(0)?.toUpperCase() || "?";

  const metricData = [
    { label: "Points", value: currentStudent?.score ?? 0, icon: Award, tone: colors.brand.foreground },
    { label: "Correct", value: currentStudent?.correct_answers ?? 0, icon: CheckCircle2, tone: colors.status.success.icon },
    { label: "Accuracy", value: `${accuracy}%`, icon: Target, tone: colors.status.info.icon },
  ];

  const handleRematch = async () => {
    if (!roomId || rematching) return;
    try {
      setRematching(true);
      const previousRoom = await competitionService.getRoom(roomId);
      const currentParticipant = previousRoom.participants.find((participant) => participant.user_id === user?.id);
      const rematch = await competitionService.createRoom({
        title: previousRoom.title,
        visibility: previousRoom.visibility,
        format: previousRoom.format,
        shared_course_code: previousRoom.shared_course_code || undefined,
        host_course_code: currentParticipant?.course_code || previousRoom.shared_course_code || undefined,
        question_count: previousRoom.question_count,
        question_timer_sec: previousRoom.question_timer_sec,
        max_participants: previousRoom.max_participants,
      });
      navigation.replace("CompetitionLobby", { roomId: rematch.id });
    } catch (error: any) {
      Alert.alert("Unable to start rematch", error?.response?.data?.message || "Please try again.");
      setRematching(false);
    }
  };

  return (
    <Screen style={[styles.screen, { backgroundColor: colors.bg.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: contentWidth.readingMax, paddingHorizontal: isWide ? 24 : 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={[styles.completeBadge, { backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border }]}>
            <CheckCircle2 size={16} color={colors.status.success.icon} />
            <Text style={[typeScale.label, { color: colors.status.success.fg }]}>Match complete</Text>
          </View>
        </View>

        <View style={styles.hero} accessibilityRole="summary">
          <View style={[styles.trophyHalo, { backgroundColor: colors.status.warning.bg, borderColor: colors.status.warning.border }]}>
            <Trophy size={38} color={colors.status.warning.icon} />
          </View>
          <Text style={[typeScale.h1, styles.heroTitle, { color: colors.fg.primary }]}>We have a champion</Text>
          <Text style={[typeScale.secondary, styles.heroCopy, { color: colors.fg.secondary }]}>
            {studentWon
              ? "Outstanding work — you finished at the top of the leaderboard."
              : winner
                ? `${winner.name} finished with the strongest performance.`
                : "The final results are ready."}
          </Text>
        </View>

        <Card
          elevated
          style={[
            styles.championCard,
            { borderColor: colors.status.warning.border, borderRadius: radius.xl },
          ]}
        >
          <View style={[styles.championAccent, { backgroundColor: colors.status.warning.icon }]} />
          <View style={[styles.avatar, { backgroundColor: colors.status.warning.bg, borderColor: colors.status.warning.border }]}>
            <Text style={[typeScale.h1, { color: colors.status.warning.fg }]}>{initial}</Text>
          </View>
          <View style={styles.championIdentity}>
            <View style={styles.championLabelRow}>
              <Medal size={16} color={colors.status.warning.icon} />
              <Text style={[typeScale.label, { color: colors.status.warning.fg }]}>Champion</Text>
            </View>
            <Text style={[typeScale.h2, styles.championName, { color: colors.fg.primary }]}>{winner?.name || "No winner recorded"}</Text>
            <Text style={[typeScale.secondary, { color: colors.fg.secondary }]}>Final score</Text>
          </View>
          <View style={styles.championScoreWrap}>
            <Text style={[styles.championScore, { color: colors.brand.foreground }]}>{winner?.score ?? 0}</Text>
            <Text style={[typeScale.caption, { color: colors.fg.muted }]}>POINTS</Text>
          </View>
        </Card>

        {currentStudent ? (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={[typeScale.h3, { color: colors.fg.primary }]}>Your performance</Text>
                <Text style={[typeScale.secondary, { color: colors.fg.secondary }]}>You placed #{currentRank} of {standings.length}</Text>
              </View>
            </View>
            <View style={[styles.metricsGrid, !isWide && styles.metricsGridCompact]}>
              {metricData.map(({ label, value, icon: Icon, tone }) => (
                <View key={label} style={[styles.metric, { backgroundColor: colors.bg.surface, borderColor: colors.borderRoles.subtle, borderRadius: radius.md }]}>
                  <Icon size={20} color={tone} />
                  <Text style={[typeScale.h3, { color: colors.fg.primary }]}>{value}</Text>
                  <Text style={[typeScale.caption, { color: colors.fg.muted }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.boardHeading}>
            <View style={styles.boardTitleRow}>
              <Swords size={20} color={colors.brand.foreground} />
              <Text style={[typeScale.h3, { color: colors.fg.primary }]}>Final standings</Text>
            </View>
            <Text style={[typeScale.caption, { color: colors.fg.muted }]}>{standings.length} players</Text>
          </View>

          <Card noPadding style={[styles.boardCard, { borderRadius: radius.lg }]}>
            {standings.map((entry, index) => {
              const isWinner = entry.user_id === winner?.user_id;
              const isCurrentUser = entry.user_id === user?.id;
              return (
                <View
                  key={entry.user_id}
                  style={[
                    styles.scoreRow,
                    { borderBottomColor: colors.borderRoles.subtle },
                    isWinner && { backgroundColor: colors.status.warning.bg },
                  ]}
                  accessibilityLabel={`${index + 1}. ${entry.name}, ${entry.score} points`}
                >
                  <View style={[styles.rank, { backgroundColor: isWinner ? colors.status.warning.border : colors.bg.surfaceRaised }]}>
                    {isWinner ? <Trophy size={16} color={colors.status.warning.fg} /> : <Text style={[typeScale.label, { color: colors.fg.secondary }]}>{index + 1}</Text>}
                  </View>
                  <View style={styles.playerDetails}>
                    <View style={styles.playerNameRow}>
                      <Text style={[typeScale.bodyStrong, { color: colors.fg.primary }]}>{entry.name}</Text>
                      {isCurrentUser ? (
                        <View style={[styles.youBadge, { backgroundColor: colors.brand.subtle, borderColor: colors.brand.border }]}>
                          <Text style={[typeScale.caption, { color: colors.brand.foreground }]}>You</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.resultBreakdown}>
                      <Text style={[typeScale.caption, { color: colors.status.success.fg }]}>{entry.correct_answers} correct</Text>
                      <Text style={[typeScale.caption, { color: colors.fg.muted }]}>•</Text>
                      <Text style={[typeScale.caption, { color: colors.status.error.fg }]}>{entry.wrong_answers} wrong</Text>
                    </View>
                  </View>
                  <View style={styles.scoreValueWrap}>
                    <Text style={[typeScale.title, { color: isWinner ? colors.status.warning.fg : colors.fg.primary }]}>{entry.score}</Text>
                    <Text style={[typeScale.caption, { color: colors.fg.muted }]}>pts</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a rematch with the same settings"
            accessibilityState={{ busy: rematching, disabled: rematching }}
            disabled={rematching}
            onPress={handleRematch}
            style={({ pressed }) => [
              styles.primaryButton,
              { minHeight: controlSize.buttonMinHeight, backgroundColor: pressed ? colors.brand.fillPressed : colors.brand.fill, borderRadius: radius.md },
            ]}
          >
            {rematching ? <ActivityIndicator color={colors.brand.onFill} /> : <RotateCcw size={20} color={colors.brand.onFill} />}
            <Text style={[typeScale.bodyStrong, { color: colors.brand.onFill }]}>{rematching ? "Creating rematch..." : "Rematch"}</Text>
            {!rematching ? <ChevronRight size={20} color={colors.brand.onFill} /> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a match with different settings"
            onPress={() => navigation.replace("CreateCompetition")}
            style={({ pressed }) => [
              styles.secondaryButton,
              { minHeight: controlSize.buttonMinHeight, borderColor: colors.borderRoles.default, backgroundColor: pressed ? colors.bg.surfaceRaised : colors.bg.surface, borderRadius: radius.md },
            ]}
          >
            <Swords size={20} color={colors.fg.secondary} />
            <Text style={[typeScale.bodyStrong, { color: colors.fg.primary }]}>New match settings</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to compete hub"
            onPress={() => navigation.navigate("CompetitionHub")}
            style={({ pressed }) => [styles.hubButton, { minHeight: controlSize.minTouch, opacity: pressed ? 0.7 : 1 }]}
          >
            <Home size={18} color={colors.fg.secondary} />
            <Text style={[typeScale.label, { color: colors.fg.secondary }]}>Back to Compete</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", alignSelf: "center", paddingTop: 16, paddingBottom: 48, gap: 24 },
  topBar: { alignItems: "center" },
  completeBadge: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  hero: { alignItems: "center", gap: 8 },
  trophyHalo: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  heroTitle: { textAlign: "center" },
  heroCopy: { textAlign: "center", maxWidth: 480 },
  championCard: { minHeight: 148, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, overflow: "hidden" },
  championAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  championIdentity: { flex: 1, gap: 2 },
  championLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  championName: { marginTop: 2 },
  championScoreWrap: { alignItems: "flex-end" },
  championScore: { fontSize: 32, lineHeight: 38, fontWeight: "800" },
  section: { gap: 12 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  metricsGrid: { flexDirection: "row", gap: 12 },
  metricsGridCompact: { gap: 8 },
  metric: { flex: 1, minHeight: 112, padding: 12, borderWidth: 1, justifyContent: "center", alignItems: "center", gap: 4 },
  boardHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  boardCard: { overflow: "hidden" },
  scoreRow: { minHeight: 76, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  playerDetails: { flex: 1, gap: 3 },
  playerNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  youBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  resultBreakdown: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  scoreValueWrap: { alignItems: "flex-end" },
  actions: { gap: 12 },
  primaryButton: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  secondaryButton: { paddingHorizontal: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  hubButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
