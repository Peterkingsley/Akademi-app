import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ChevronRight, Globe, Layers, ListChecks, Lock, Plus, Swords, Users } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { competitionService, CompetitionRoom } from "../../services/competition";
import { useAuthStore } from "../../store/useAuthStore";
import { useTheme } from "../../theme/ThemeContext";

type MatchTab = "created" | "joined" | "public";

export const CompetitionMatchesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { colors } = useTheme();

  const [myRooms, setMyRooms] = useState<CompetitionRoom[]>([]);
  const [publicRooms, setPublicRooms] = useState<CompetitionRoom[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MatchTab>("created");
  const [loadNotice, setLoadNotice] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setLoadNotice(null);

      const [myData, publicData] = await Promise.all([
        competitionService.getMyRooms(),
        competitionService.getPublicRooms(),
      ]);
      setMyRooms(myData);
      setPublicRooms(publicData);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "We could not refresh your matches right now.";
      if (isRefresh) {
        Alert.alert("Unable to refresh matches", message);
      } else {
        setLoadNotice(message);
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createdRooms = useMemo(
    () => myRooms.filter((room) => room.host.id === user?.id),
    [myRooms, user?.id],
  );
  const joinedRooms = useMemo(
    () => myRooms.filter((room) => room.host.id !== user?.id),
    [myRooms, user?.id],
  );

  const visibleRooms =
    activeTab === "created"
      ? createdRooms
      : activeTab === "joined"
        ? joinedRooms
        : publicRooms;

  return (
    <Screen style={[styles.screen, { backgroundColor: colors.background }]} title="My Matches" scrollable>
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
        <View style={styles.intro}>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>Live Room History</Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Manage rooms you host, view friend invitations, or jump into active public matches.
          </Text>
        </View>

        {loadNotice ? (
          <Card style={[styles.noticeCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Match List Notice</Text>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>{loadNotice}</Text>
          </Card>
        ) : null}

        {/* Tab Row */}
        <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { key: "created", label: "Created", count: createdRooms.length },
            { key: "joined", label: "Joined", count: joinedRooms.length },
            { key: "public", label: "Public", count: publicRooms.length },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                style={[
                  styles.tabButton,
                  isActive && { backgroundColor: colors.primary },
                ]}
                onPress={() => setActiveTab(tab.key as MatchTab)}
              >
                <Text style={[styles.tabLabel, { color: isActive ? "#04110A" : colors.textSecondary }]}>
                  {tab.label}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: isActive ? "rgba(4, 17, 10, 0.2)" : colors.surfaceElevated }]}>
                  <Text style={[styles.countBadgeText, { color: isActive ? "#04110A" : colors.textMuted }]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Visible Rooms List */}
        {visibleRooms.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Swords size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {activeTab === "created"
                ? "No Created Matches Yet"
                : activeTab === "joined"
                  ? "No Joined Matches Yet"
                  : "No Public Rooms Available"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {activeTab === "created"
                ? "When you host a live 1v1 match or speed battle, it will appear here."
                : activeTab === "joined"
                  ? "Rooms you joined from friends or campaign codes will appear here."
                  : "When public battle rooms open up, they will appear here first."}
            </Text>

            {activeTab === "created" ? (
              <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate("CreateCompetition")}
              >
                <Plus size={16} color="#04110A" />
                <Text style={styles.createButtonText}>Create Match Now</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        ) : (
          visibleRooms.map((room) => (
            <Card
              key={room.id}
              style={[styles.roomCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate("CompetitionLobby", { roomId: room.id })}
            >
              <View style={styles.roomTop}>
                <View style={styles.titleWrap}>
                  <Text style={[styles.roomTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {room.title}
                  </Text>
                  <View style={[styles.codeBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <Text style={[styles.codeText, { color: colors.primary }]}>{room.code}</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </View>

              <View style={styles.roomMetaRow}>
                <View style={styles.metaChip}>
                  <Layers size={12} color={colors.primary} />
                  <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                    {room.shared_course_code || "Dual Course"}
                  </Text>
                </View>

                <View style={styles.metaChip}>
                  <Users size={12} color={colors.textMuted} />
                  <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                    {room.participants.length}/{room.max_participants} players
                  </Text>
                </View>

                <View style={styles.metaChip}>
                  {room.visibility === "PUBLIC" ? (
                    <Globe size={12} color={colors.primary} />
                  ) : (
                    <Lock size={12} color={colors.textMuted} />
                  )}
                  <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                    {room.visibility}
                  </Text>
                </View>
              </View>

              <View style={styles.roomFooter}>
                <Text style={[styles.roomStatus, { color: room.status === "LIVE" ? colors.primary : colors.textMuted }]}>
                  {activeTab === "created"
                    ? "Hosted by you"
                    : activeTab === "joined"
                      ? `Host: ${room.host.name}`
                      : `Status: ${room.status}`}
                </Text>
              </View>
            </Card>
          ))
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
  intro: {
    gap: 4,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  introText: {
    fontSize: 13,
    lineHeight: 19,
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
  tabRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 10,
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
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  createButtonText: {
    color: "#04110A",
    fontWeight: "800",
    fontSize: 13,
  },
  roomCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  roomTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roomTitle: {
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  codeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  roomMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaChipText: {
    fontSize: 12,
  },
  roomFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  roomStatus: {
    fontSize: 11,
    fontWeight: "700",
  },
});
