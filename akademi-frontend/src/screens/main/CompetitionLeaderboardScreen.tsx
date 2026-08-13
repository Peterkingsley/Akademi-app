import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronLeft, Medal, Search, Trophy, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Avatar } from "../../components/ui/Avatar";
import { competitionService, CompetitionLeaderboardEntry } from "../../services/competition";
import { useAuthStore } from "../../store/useAuthStore";
import { useTheme } from "../../theme/ThemeContext";

const periods = ["Weekly", "Monthly", "All time"] as const;
type Period = typeof periods[number];

export const CompetitionLeaderboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, typeScale, radius, controlSize, contentWidth } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("Weekly");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [loadNotice, setLoadNotice] = useState<string | null>(null);

  const loadData = async (isRefresh = false, targetPeriod: Period = period) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setLoadNotice(null);
      const apiPeriod = targetPeriod === "Weekly" ? "weekly" : targetPeriod === "Monthly" ? "monthly" : "all-time";
      setLeaderboard(await competitionService.getLeaderboard(apiPeriod));
    } catch (error: any) {
      const message = error?.response?.data?.message || "We could not load the rankings right now.";
      isRefresh ? Alert.alert("Unable to refresh", message) : setLoadNotice(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void loadData(false, "Weekly"); }, []);

  const visibleLeaders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? leaderboard.filter((entry) => entry.name.toLowerCase().includes(normalized)) : leaderboard;
  }, [leaderboard, query]);

  const selectPeriod = (next: Period) => {
    if (next === period) return;
    setPeriod(next);
    setLeaderboard([]);
    void loadData(false, next);
  };

  return (
    <Screen style={[styles.screen, { backgroundColor: colors.bg.canvas }]}>
      <View style={[styles.shell, { maxWidth: contentWidth.readingMax }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <ChevronLeft size={24} color={colors.fg.primary} />
          </Pressable>
          {searching ? (
            <View style={[styles.searchBox, { backgroundColor: colors.bg.surfaceRaised, borderColor: colors.borderRoles.default, borderRadius: radius.md }]}>
              <Search size={18} color={colors.fg.muted} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Find a student"
                placeholderTextColor={colors.fg.muted}
                style={[typeScale.body, styles.searchInput, { color: colors.fg.primary }]}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={() => { setSearching(false); setQuery(""); }}>
                <X size={20} color={colors.fg.secondary} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.titleRow}>
                <View style={[styles.titleMark, { backgroundColor: colors.brand.fill, borderRadius: radius.sm }]} />
                <Text style={[typeScale.title, { color: colors.fg.primary }]}>Leaderboard</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search leaderboard"
                onPress={() => setSearching(true)}
                style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Search size={23} color={colors.fg.primary} />
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.filters}>
          {periods.map((item) => {
            const active = item === period;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => selectPeriod(item)}
                style={({ pressed }) => [
                  styles.filter,
                  {
                    minHeight: controlSize.minTouch,
                    borderRadius: radius.full,
                    borderColor: active ? colors.brand.fill : colors.brand.border,
                    backgroundColor: active ? colors.brand.fill : pressed ? colors.brand.subtle : "transparent",
                  },
                ]}
              >
                <Text style={[typeScale.label, { color: active ? colors.brand.onFill : colors.brand.foreground }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.state}><ActivityIndicator color={colors.brand.foreground} size="large" /></View>
        ) : loadNotice ? (
          <View style={styles.state}>
            <Text style={[typeScale.bodyStrong, { color: colors.fg.primary }]}>Rankings unavailable</Text>
            <Text style={[typeScale.secondary, styles.stateCopy, { color: colors.fg.secondary }]}>{loadNotice}</Text>
            <Pressable onPress={() => loadData(false, period)} style={[styles.retry, { backgroundColor: colors.brand.fill, borderRadius: radius.md }]}>
              <Text style={[typeScale.label, { color: colors.brand.onFill }]}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true, period)} tintColor={colors.brand.foreground} />}
          >
            {visibleLeaders.map((entry, index) => {
              const rank = index + 1;
              const topThree = rank <= 3;
              const isYou = entry.user_id === user?.id;
              const medalColor = rank === 1 ? colors.status.warning.icon : rank === 2 ? colors.fg.muted : colors.status.warning.fg;
              return (
                <View
                  key={entry.user_id}
                  style={[
                    styles.row,
                    { borderBottomColor: colors.borderRoles.subtle },
                    isYou && { backgroundColor: colors.brand.subtle, borderRadius: radius.md },
                  ]}
                  accessibilityLabel={`${rank}. ${entry.name}, ${entry.totalScore} points`}
                >
                  <View style={styles.rankSlot}>
                    {topThree ? <Medal size={19} color={medalColor} /> : <Text style={[typeScale.label, { color: colors.fg.muted }]}>{rank}</Text>}
                  </View>
                  <Avatar
                    uri={entry.avatar_url || undefined}
                    name={entry.name}
                    size={44}
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: topThree ? colors.brand.subtle : colors.bg.surfaceRaised,
                        borderColor: topThree ? colors.brand.border : colors.borderRoles.default,
                      },
                    ]}
                  />
                  <View style={styles.identity}>
                    <View style={styles.nameLine}>
                      <Text style={[typeScale.bodyStrong, styles.name, { color: colors.fg.primary }]} numberOfLines={1}>{entry.name}</Text>
                      {isYou ? <Text style={[typeScale.caption, { color: colors.brand.foreground }]}>You</Text> : null}
                    </View>
                    <Text style={[typeScale.caption, { color: colors.fg.muted }]}>{entry.wins} wins · {entry.winRate}% win rate</Text>
                  </View>
                  <View style={styles.score}>
                    {rank === 1 ? <Trophy size={15} color={colors.status.warning.icon} /> : null}
                    <Text style={[typeScale.label, { color: topThree ? colors.brand.foreground : colors.fg.primary }]}>{entry.totalScore} pts</Text>
                  </View>
                </View>
              );
            })}
            {visibleLeaders.length === 0 ? (
              <View style={styles.state}>
                <Text style={[typeScale.bodyStrong, { color: colors.fg.primary }]}>{query ? "No student found" : `No ${period.toLowerCase()} results yet`}</Text>
                <Text style={[typeScale.secondary, { color: colors.fg.secondary }]}>{query ? "Try another name." : "Completed matches will appear here automatically."}</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  shell: { flex: 1, width: "100%", alignSelf: "center", paddingHorizontal: 16, paddingTop: 8 },
  header: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  titleMark: { width: 16, height: 16 },
  searchBox: { flex: 1, minHeight: 48, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, paddingVertical: 0 },
  filters: { flexDirection: "row", gap: 8, paddingVertical: 12 },
  filter: { flex: 1, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  list: { paddingTop: 6, paddingBottom: 40 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1 },
  rankSlot: { width: 24, alignItems: "center", justifyContent: "center" },
  avatar: { borderWidth: 1.5 },
  identity: { flex: 1, gap: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1 },
  score: { flexDirection: "row", alignItems: "center", gap: 5 },
  state: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  stateCopy: { textAlign: "center" },
  retry: { minHeight: 48, justifyContent: "center", paddingHorizontal: 20, marginTop: 4 },
});
