import React, { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService, CompetitionLeaderboardEntry, CompetitionSummary } from "../../services/competition";

export const CompetitionLeaderboardScreen: React.FC = () => {
  const [summary, setSummary] = useState<CompetitionSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [summaryData, leaderboardData] = await Promise.all([
        competitionService.getSummary(),
        competitionService.getLeaderboard(),
      ]);

      setSummary(summaryData);
      setLeaderboard(leaderboardData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = [
    { label: "Matches", value: summary?.matchesPlayed ?? 0 },
    { label: "Wins", value: summary?.wins ?? 0 },
    { label: "Win Rate", value: `${summary?.winRate ?? 0}%` },
    { label: "Live", value: summary?.liveMatches ?? 0 },
  ];

  return (
    <Screen title="Leaderboard" scrollable>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              {stats.map((item) => (
                <Card key={item.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </Card>
              ))}
            </View>

            {leaderboard.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No leaderboard yet</Text>
                <Text style={styles.emptyText}>
                  Once more live matches finish, your ranking and the wider competition table will show here.
                </Text>
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
  container: {
    padding: 20,
    gap: 16,
  },
  center: {
    paddingTop: 80,
    alignItems: "center",
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
