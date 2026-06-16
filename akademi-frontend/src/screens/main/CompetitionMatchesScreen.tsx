import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService, CompetitionRoom } from "../../services/competition";
import { useAuthStore } from "../../store/useAuthStore";

type MatchTab = "created" | "joined" | "public";

export const CompetitionMatchesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [myRooms, setMyRooms] = useState<CompetitionRoom[]>([]);
  const [publicRooms, setPublicRooms] = useState<CompetitionRoom[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MatchTab>("created");

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const [myData, publicData] = await Promise.all([
        competitionService.getMyRooms(),
        competitionService.getPublicRooms(),
      ]);
      setMyRooms(myData);
      setPublicRooms(publicData);
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
    <Screen title="My Matches" scrollable>
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
          <Text style={styles.introTitle}>Your live room history</Text>
          <Text style={styles.introText}>
            Switch between rooms you hosted, rooms you joined, and open public rooms.
          </Text>
        </View>

        <View style={styles.tabRow}>
          {[
            { key: "created", label: "Created" },
            { key: "joined", label: "Joined" },
            { key: "public", label: "Public" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, activeTab === tab.key && styles.activeTabButton]}
              onPress={() => setActiveTab(tab.key as MatchTab)}
            >
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.activeTabLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {visibleRooms.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {activeTab === "created"
                ? "No created matches yet"
                : activeTab === "joined"
                  ? "No joined matches yet"
                  : "No public rooms waiting"}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === "created"
                ? "Once you host a match room, it will appear here."
                : activeTab === "joined"
                  ? "Rooms you joined from friends or campaigns will appear here."
                  : "When public rooms open up, you'll see them here."}
            </Text>
          </Card>
        ) : (
          visibleRooms.map((room) => (
            <Card
              key={room.id}
              style={styles.roomCard}
              onPress={() => navigation.navigate("CompetitionLobby", { roomId: room.id })}
            >
              <View style={styles.roomTop}>
                <Text style={styles.roomTitle}>{room.title}</Text>
                <Text style={styles.roomCode}>{room.code}</Text>
              </View>
              <Text style={styles.roomMeta}>
                {room.format === "SHARED_COURSE"
                  ? room.shared_course_code || "Shared course"
                  : "Dual course"}{" "}
                · {room.participants.length}/{room.max_participants} players
              </Text>
              <Text style={styles.roomStatus}>
                {activeTab === "created"
                  ? "Hosted by you"
                  : activeTab === "joined"
                    ? `Host: ${room.host.name}`
                    : room.status}
              </Text>
            </Card>
          ))
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
  intro: {
    gap: 6,
  },
  introTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  introText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTabButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  activeTabLabel: {
    color: "#04110A",
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
  roomCard: {
    gap: 8,
  },
  roomTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  roomTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
    flex: 1,
  },
  roomCode: {
    ...typography.caption,
    color: colors.primary,
  },
  roomMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  roomStatus: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
