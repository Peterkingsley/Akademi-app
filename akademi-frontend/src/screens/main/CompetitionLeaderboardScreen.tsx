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
import {
  Award,
  Crown,
  Flame,
  Medal,
  Percent,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import {
  competitionService,
  CompetitionLeaderboardEntry,
  CompetitionSummary,
} from "../../services/competition";
import { useAuthStore } from "../../store/useAuthStore";
import { useTheme } from "../../theme/ThemeContext";

export const CompetitionLeaderboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuthStore();
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

  const champion = leaderboard[0] || null;

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
        {/* Header Hero */}
        <View style={styles.heroHeader}>
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: "rgba(245, 158, 11, 0.15)", borderColor: "rgba(245, 158, 11, 0.3)" },
            ]}
          >
            <Trophy size={26} color="#F59E0B" />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Academic Leaderboard</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Global student rankings calculated from live speed duels and tournament victories.
            </Text>
          </View>
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

            {/* User Stats Grid */}
            <View style={styles.statsGrid}>
              {stats.map((item) => {
                return (
                  <Card
                    key={item.label}
                    style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.statContent}>
                      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{item.value}</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                    </View>
                  </Card>
                );
              })}
            </View>

            {/* Champion Showcase Card */}
            {champion ? (
              <Card style={[styles.championCard, { backgroundColor: colors.surface, borderColor: "rgba(245, 158, 11, 0.4)" }]}>
                <View style={styles.championBadgeRow}>
                  <View style={styles.crownPill}>
                    <Text style={styles.crownPillText}>#1 GLOBAL CHAMPION</Text>
                  </View>
                </View>

                <View style={styles.championBody}>
                  <View style={styles.championAvatar}>
                    <Text style={styles.championAvatarText}>
                      {champion.name[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.championTextWrap}>
                    <Text style={[styles.championName, { color: colors.textPrimary }]}>{champion.name}</Text>
                    <Text style={[styles.championMeta, { color: colors.textSecondary }]}>
                      {`${champion.wins} Wins • ${champion.winRate}% Win Rate`}
                    </Text>
                  </View>
                  <View style={styles.championScoreWrap}>
                    <Text style={styles.championScoreText}>{champion.totalScore}</Text>
                    <Text style={styles.championScoreSub}>PTS</Text>
                  </View>
                </View>
              </Card>
            ) : null}

            {/* Rankings Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Global Student Rankings</Text>
            </View>

            {leaderboard.length === 0 ? (
              <Card style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Rankings Yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Once live speed battles finish, global rankings will automatically populate here.
                </Text>
              </Card>
            ) : (
              <Card style={[styles.leaderboardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = user?.id === entry.user_id;
                  const isTop3 = index < 3;

                  const rankColor =
                    index === 0
                      ? "#F59E0B"
                      : index === 1
                        ? "#94A3B8"
                        : index === 2
                          ? "#D97706"
                          : colors.textMuted;

                  const rankBg =
                    index === 0
                      ? "rgba(245, 158, 11, 0.15)"
                      : index === 1
                        ? "rgba(148, 163, 184, 0.15)"
                        : index === 2
                          ? "rgba(217, 119, 6, 0.15)"
                          : colors.surfaceElevated;

                  return (
                    <View
                      key={entry.user_id}
                      style={[
                        styles.leaderRow,
                        { borderColor: colors.border },
                        isCurrentUser && {
                          backgroundColor: "rgba(34, 197, 94, 0.12)",
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      {/* Metallic Rank Badge */}
                      <View style={[styles.rankBadge, { backgroundColor: rankBg }]}>
                        <Text style={[styles.rankText, { color: rankColor }]}>#{index + 1}</Text>
                      </View>

                      {/* Avatar */}
                      <View style={[styles.rowAvatar, { backgroundColor: colors.surfaceElevated }]}>
                        <Text style={[styles.rowAvatarText, { color: colors.textPrimary }]}>
                          {entry.name[0].toUpperCase()}
                        </Text>
                      </View>

                      {/* User Info */}
                      <View style={styles.leaderTextWrap}>
                        <View style={styles.nameRow}>
                          <Text style={[styles.leaderName, { color: colors.textPrimary }]}>
                            {entry.name}
                          </Text>
                          {isCurrentUser ? (
                            <View style={[styles.youTag, { backgroundColor: colors.primary }]}>
                              <Text style={styles.youTagText}>YOU</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.leaderMeta, { color: colors.textSecondary }]}>
                          {`${entry.wins} W • ${entry.matchesPlayed} battles • ${entry.winRate}% win rate`}
                        </Text>
                      </View>

                      {/* Score */}
                      <Text
                        style={[
                          styles.leaderScore,
                          { color: isTop3 ? colors.primary : colors.textPrimary },
                        ]}
                      >
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
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    marginBottom: 2,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextWrap: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
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
  championCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 12,
  },
  championBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  crownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  crownPillText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  championBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  championAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  championAvatarText: {
    color: "#04110A",
    fontSize: 18,
    fontWeight: "800",
  },
  championTextWrap: {
    flex: 1,
    gap: 2,
  },
  championName: {
    fontSize: 16,
    fontWeight: "800",
  },
  championMeta: {
    fontSize: 12,
  },
  championScoreWrap: {
    alignItems: "flex-end",
  },
  championScoreText: {
    color: "#F59E0B",
    fontSize: 20,
    fontWeight: "800",
  },
  championScoreSub: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  emptyCard: {
    alignItems: "center",
    padding: 26,
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
  leaderboardCard: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 12,
    fontWeight: "800",
  },
  rowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowAvatarText: {
    fontSize: 12,
    fontWeight: "800",
  },
  leaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: "700",
  },
  youTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youTagText: {
    color: "#04110A",
    fontSize: 9,
    fontWeight: "800",
  },
  leaderMeta: {
    fontSize: 11,
  },
  leaderScore: {
    fontSize: 14,
    fontWeight: "800",
  },
});
