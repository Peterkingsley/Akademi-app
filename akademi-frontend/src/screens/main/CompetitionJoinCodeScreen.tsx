import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Clipboard as ClipboardIcon, KeyRound, UserPlus, Zap } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { competitionService } from "../../services/competition";
import { useTheme } from "../../theme/ThemeContext";

export const CompetitionJoinCodeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [joinCode, setJoinCode] = useState("");
  const [joinCourseCode, setJoinCourseCode] = useState("");
  const [joining, setJoining] = useState(false);

  const handlePasteCode = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setJoinCode(text.trim().toUpperCase());
    }
  };

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
    <Screen style={[styles.screen, { backgroundColor: colors.background }]} title="Join With Code" scrollable>
      <View style={styles.container}>
        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
              <KeyRound size={26} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Enter Match Code</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Paste or type the room code provided by your opponent to join their live arena.
              </Text>
            </View>
          </View>

          <View style={styles.inputWrap}>
            <Input
              label="Match Room Code *"
              placeholder="e.g. A7K2Q9"
              value={joinCode}
              onChangeText={(val) => setJoinCode(val.toUpperCase())}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.pasteButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={handlePasteCode}
            >
              <ClipboardIcon size={14} color={colors.primary} />
              <Text style={[styles.pasteButtonText, { color: colors.primary }]}>Paste</Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Your Course Code"
            placeholder="Optional for dual-course matches (e.g. EEE 202)"
            value={joinCourseCode}
            onChangeText={(val) => setJoinCourseCode(val.toUpperCase())}
            autoCapitalize="characters"
          />

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.button,
              { backgroundColor: !joinCode.trim() ? colors.surfaceElevated : colors.primary },
            ]}
            onPress={joinMatchByCode}
            disabled={!joinCode.trim() || joining}
          >
            <UserPlus size={18} color={!joinCode.trim() ? colors.textMuted : "#04110A"} />
            <Text style={[styles.buttonText, { color: !joinCode.trim() ? colors.textMuted : "#04110A" }]}>
              {joining ? "Entering Arena..." : "Join Live Room"}
            </Text>
          </TouchableOpacity>
        </Card>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 18,
    paddingBottom: 36,
  },
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  inputWrap: {
    position: "relative",
  },
  pasteButton: {
    position: "absolute",
    right: 10,
    top: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  pasteButtonText: {
    fontSize: 11,
    fontWeight: "800",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
