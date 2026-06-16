import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { CalendarDays, ChevronRight, PlusSquare, RadioTower } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { useTheme } from "../../../theme/ThemeContext";
import { AdminStackParamList } from "../../../navigation/types";

type Nav = StackNavigationProp<AdminStackParamList, "AdminTournaments">;

export const AdminTournamentsScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const navigation = useNavigation<Nav>();

  const Item = ({
    title,
    description,
    icon: Icon,
    onPress,
  }: {
    title: string;
    description: string;
    icon: any;
    onPress: () => void;
  }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82}>
      <Card
        style={{
          ...styles.itemCard,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}14` }]}>
          <Icon size={20} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>{title}</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{description}</Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </Card>
    </TouchableOpacity>
  );

  return (
    <Screen title="Tournament Control" scrollable>
      <View style={styles.container}>
        <Card
          style={{
            ...styles.heroCard,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <Text style={[typography.caption, { color: colors.primary }]}>ADMIN COMPETITIONS</Text>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Manage campaigns, live events, and student-created match rooms.</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Create a tournament with verified Akademi materials, preview how students will see it, publish it, then monitor every room that runs from it.
          </Text>
        </Card>

        <Item
          title="Create Tournament"
          description="Build a new campaign with live material selection, schedule pickers, and student preview."
          icon={PlusSquare}
          onPress={() => navigation.navigate("AdminTournamentCreate")}
        />
        <Item
          title="Existing Campaigns"
          description="Review draft, published, live, and completed tournament campaigns."
          icon={CalendarDays}
          onPress={() => navigation.navigate("AdminTournamentCampaigns")}
        />
        <Item
          title="Past Matches & Student Rooms"
          description="Track private battles, student-created rooms, and tournament-backed live rounds."
          icon={RadioTower}
          onPress={() => navigation.navigate("AdminTournamentRooms")}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 4,
  },
});
