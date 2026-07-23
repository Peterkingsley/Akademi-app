import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Award, Flame, Percent, ShieldCheck, Swords, Trophy, Zap } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import {
  competitionService,
  CompetitionLeaderboardEntry,
  CompetitionSummary,
} from "../../services/competition";
import { useTheme } from "../../theme/ThemeContext";

export const CompetitionLeaderboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const [summary, setSummary] = useState<CompetitionSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setLoadNotice(null);

      const [summaryData, leaderboardData] = await Promise.all([
        competitionService.getSummary(),
        competitionService.getLeaderboard(),
      ]);

      setSummary(summaryData);
      setLeaderboard(leaderboardData);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "We could not load the competition rankings right now.";
      if (isRefresh) {
        Alert.alert("Unable to refresh leaderboard", message);
      } else {
        setLoadNotice(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = [
    { label: "Matches Played", value: summary?.matchesPlayed ?? 0, icon: Swords, color: colors.primary },
    { label: "Total Wins", value: summary?.wins ?? 0, icon: Trophy, color: "#F59E0B" },
    { label: "Win Rate", value: `${summary?.winRate ?? 0}%`, icon: Percent, color: "#A855F7" },
    { label: "Live Battles", value: summary?.liveMatches ?? 0, icon: Zap, color: "#3B82F6" },
  ];

  return (
    <Screen style={[styles.screen, { backgroundColor: colors.background }]} title="Leaderboard" scrollable>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <>
            {loadNotice ? (
              <Card style={[styles.noticeCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Leaderboard Notice</Text>
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>{loadNotice}</Text>
              </Card>
            ) : null}

            {/* User Stats Grid */}
            <View style={styles.statsGrid}>
              {stats.map((item) => {
                const IconComp = item.icon;
                return (
                  <Card
                    key={item.label}
                    style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(255, 255, 255, 0.05)" }]}>
                      <IconComp size={16} color={item.color} />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{item.value}</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                    </View>
                  </Card>
                );
              })}
            </View>

            {/* Rankings Section */}
            <View style={styles.sectionHeader}>
              <Award size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Global Student Rankings</Text>
            </View>

            {leaderboard.length === 0 ? (
              <Card style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ShieldCheck size={32} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Rankings Yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Once more live speed battles finish, rankings will automatically populate here.
                </Text>
              </Card>
            ) : (
              <Card style={[styles.leaderboardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {leaderboard.map((entry, index) => {
                  const isTop3 = index < 3;
                  const rankColor = index === 0 ? "#F59E0B" : index === 1 ? "#94A3B8" : index === 2 ? "#B45309" : colors.textMuted;
                  return (
                    <View
                      key={entry.user_id}
                      style={[
                        styles.leaderRow,
                        { borderColor: colors.border },
                        isTop3 && { backgroundColor: "rgba(255, 255, 255, 0.02)" },
                      ]}
                    >
                      <View style={[styles.rankBadge, { backgroundColor: isTop3 ? "rgba(245, 158, 11, 0.12)" : colors.surfaceElevated }]}>
                        <Text style={[styles.rankText, { color: rankColor }]}>#{index + 1}</Text>
                      </View>
                      <View style={styles.leaderTextWrap}>
                        <Text style={[styles.leaderName, { color: colors.textPrimary }]}>{entry.name}</Text>
                        <Text style={[styles.leaderMeta, { color: colors.textSecondary }]}>
                          {`${entry.wins} W • ${entry.matchesPlayed} battles • ${entry.winRate}% win rate`}
                        </Text>
                      </View>
                      <Text style={[styles.leaderScore, { color: isTop3 ? colors.primary : colors.textPrimary }]}>
                        {entry.totalScore} pts
                      </Text>
                    </View>
                  );
                })}
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
  container: {
    padding: 18,
    gap: 14,
    paddingBottom: 36,
  },
  center: {
    paddingTop: 80,
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
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statContent: {
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10,
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
  emptyCard: {
    alignItems: "center",
    padding: 24,
    gap: 10,
    borderRadius: 16,
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
  leaderboardCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
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
  leaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: "700",
  },
  leaderMeta: {
    fontSize: 11,
  },
  leaderScore: {
    fontSize: 14,
    fontWeight: "800",
  },
});
