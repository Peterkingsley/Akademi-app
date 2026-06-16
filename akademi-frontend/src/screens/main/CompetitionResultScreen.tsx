import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Trophy, RotateCcw, Home } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export const CompetitionResultScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { roomId, winnerUserId, scoreboard } = route.params;

  const winner = useMemo(
    () => scoreboard.find((entry: any) => entry.user_id === winnerUserId) || scoreboard[0],
    [scoreboard, winnerUserId],
  );

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Trophy size={28} color="#04110A" />
          </View>
          <Text style={styles.heroTitle}>Match Complete</Text>
          <Text style={styles.heroSubtitle}>
            {winner ? `${winner.name} wins this live battle.` : "The match has ended."}
          </Text>
        </View>

        <Card style={styles.winnerCard}>
          <Text style={styles.winnerLabel}>Winner</Text>
          <Text style={styles.winnerName}>{winner?.name || "No winner"}</Text>
          <Text style={styles.winnerMeta}>
            {winner ? `${winner.score} pts · ${winner.correct_answers} correct · ${winner.wrong_answers} wrong` : "Result unavailable"}
          </Text>
        </Card>

        <Card style={styles.boardCard}>
          <Text style={styles.boardTitle}>Final Scoreboard</Text>
          {scoreboard.map((entry: any, index: number) => (
            <View key={entry.user_id} style={styles.scoreRow}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <View style={styles.scoreTextWrap}>
                <Text style={styles.scoreName}>{entry.name}</Text>
                <Text style={styles.scoreMeta}>
                  {entry.correct_answers} correct · {entry.wrong_answers} wrong
                </Text>
              </View>
              <Text style={styles.scoreValue}>{entry.score}</Text>
            </View>
          ))}
        </Card>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.replace("CompetitionLobby", { roomId })}
          >
            <RotateCcw size={16} color={colors.textPrimary} />
            <Text style={styles.secondaryText}>Replay Lobby</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("CompetitionHub")}
          >
            <Home size={16} color="#04110A" />
            <Text style={styles.primaryText}>Leaderboard</Text>
          </TouchableOpacity>
        </View>
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
  hero: {
    alignItems: "center",
    gap: 10,
    paddingTop: 16,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  winnerCard: {
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceElevated,
  },
  winnerLabel: {
    ...typography.caption,
    color: colors.primary,
  },
  winnerName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  winnerMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  boardCard: {
    gap: 12,
  },
  boardTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rank: {
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
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
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
    backgroundColor: colors.primary,
  },
  primaryText: {
    ...typography.bodySmall,
    color: "#04110A",
    fontWeight: "700",
  },
});
