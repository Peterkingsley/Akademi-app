import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { competitionService } from "../../services/competition";
import { useNavigation } from "@react-navigation/native";

export const CompetitionJoinCodeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [joinCode, setJoinCode] = useState("");
  const [joinCourseCode, setJoinCourseCode] = useState("");
  const [joining, setJoining] = useState(false);

  const joinMatchByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert("Enter match code", "Ask the host for the room code and paste it here.");
      return;
    }

    try {
      setJoining(true);
      const room = await competitionService.joinRoom(code, joinCourseCode.trim().toUpperCase() || undefined);
      setJoinCode("");
      setJoinCourseCode("");
      navigation.replace("CompetitionLobby", { roomId: room.id });
    } catch (error: any) {
      Alert.alert("Could not join match", error?.response?.data?.message || "Check the code and try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen title="Join With Code" scrollable>
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text style={styles.title}>Join a live room</Text>
          <Text style={styles.subtitle}>
            Enter the room code a host shared with you and jump straight into the live lobby.
          </Text>
          <Input
            label="Room code"
            placeholder="e.g. A7K2Q9"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
          />
          <Input
            label="Your course code"
            placeholder="Optional for dual-course matches"
            value={joinCourseCode}
            onChangeText={setJoinCourseCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.button, (!joinCode.trim() || joining) && styles.buttonDisabled]}
            onPress={joinMatchByCode}
            disabled={!joinCode.trim() || joining}
          >
            <Text style={styles.buttonText}>{joining ? "Joining..." : "Join room"}</Text>
          </TouchableOpacity>
        </Card>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  card: {
    gap: 10,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  button: {
    marginTop: 6,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    ...typography.bodySmall,
    color: "#04110A",
    fontWeight: "700",
  },
});
