import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Award, CheckCircle2, Home, RotateCcw, Swords, Trophy, XCircle } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { useTheme } from "../../theme/ThemeContext";

export const CompetitionResultScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { roomId, winnerUserId, scoreboard } = route.params;

  const winner = useMemo(
    () => scoreboard.find((entry: any) => entry.user_id === winnerUserId) || scoreboard[0],
    [scoreboard, winnerUserId],
  );

  return (
    <Screen style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Victory Hero Header */}
        <View style={styles.hero}>
          <View style={[styles.heroIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.15)", borderColor: "#F59E0B" }]}>
            <Trophy size={36} color="#F59E0B" />
          </View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Match Concluded</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {winner ? `${winner.name} claims victory in this live battle!` : "The match has ended."}
          </Text>
        </View>

        {/* Winner Showcase Card */}
        <Card style={[styles.winnerCard, { backgroundColor: colors.surface, borderColor: "#F59E0B" }]}>
          <View style={styles.winnerBadgeRow}>
            <View style={[styles.winnerBadge, { backgroundColor: "#F59E0B" }]}>
              <Award size={14} color="#04110A" />
              <Text style={styles.winnerBadgeText}>CHAMPION</Text>
            </View>
          </View>
          <Text style={[styles.winnerName, { color: colors.textPrimary }]}>{winner?.name || "No Winner Recorded"}</Text>
          <Text style={[styles.winnerScore, { color: colors.primary }]}>{winner?.score ?? 0} PTS</Text>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceElevated }]}>
              <CheckCircle2 size={16} color={colors.primary} />
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{winner?.correct_answers ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Correct</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceElevated }]}>
              <XCircle size={16} color="#EF4444" />
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{winner?.wrong_answers ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wrong</Text>
            </View>
          </View>
        </Card>

        {/* Final Scoreboard Table */}
        <Card style={[styles.boardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.boardHeader}>
            <Swords size={18} color={colors.primary} />
            <Text style={[styles.boardTitle, { color: colors.textPrimary }]}>Final Scoreboard</Text>
          </View>

          {scoreboard.map((entry: any, index: number) => {
            const isFirst = index === 0;
            const rankColor = isFirst ? "#F59E0B" : index === 1 ? "#94A3B8" : "#B45309";
            return (
              <View key={entry.user_id} style={[styles.scoreRow, { borderColor: colors.border }]}>
                <View style={[styles.rankBadge, { backgroundColor: isFirst ? "rgba(245, 158, 11, 0.15)" : colors.surfaceElevated }]}>
                  <Text style={[styles.rankText, { color: rankColor }]}>#{index + 1}</Text>
                </View>
                <View style={styles.scoreTextWrap}>
                  <Text style={[styles.scoreName, { color: colors.textPrimary }]}>{entry.name}</Text>
                  <Text style={[styles.scoreMeta, { color: colors.textSecondary }]}>
                    {entry.correct_answers} correct • {entry.wrong_answers} wrong
                  </Text>
                </View>
                <Text style={[styles.scoreValue, { color: isFirst ? colors.primary : colors.textPrimary }]}>
                  {entry.score} pts
                </Text>
              </View>
            );
          })}
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.replace("CompetitionLobby", { roomId })}
          >
            <RotateCcw size={16} color={colors.textPrimary} />
            <Text style={[styles.secondaryText, { color: colors.textPrimary }]}>Replay Lobby</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("CompetitionHub")}
          >
            <Home size={16} color="#04110A" />
            <Text style={styles.primaryText}>Compete Hub</Text>
          </TouchableOpacity>
        </View>
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
    gap: 16,
    paddingBottom: 36,
  },
  hero: {
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  winnerCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 8,
  },
  winnerBadgeRow: {
    marginBottom: 2,
  },
  winnerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  winnerBadgeText: {
    color: "#04110A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  winnerName: {
    fontSize: 20,
    fontWeight: "800",
  },
  winnerScore: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statNum: {
    fontSize: 14,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
  },
  boardCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  boardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  boardTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 12,
    fontWeight: "800",
  },
  scoreTextWrap: {
    flex: 1,
    gap: 2,
  },
  scoreName: {
    fontSize: 14,
    fontWeight: "700",
  },
  scoreMeta: {
    fontSize: 11,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#04110A",
  },
});
