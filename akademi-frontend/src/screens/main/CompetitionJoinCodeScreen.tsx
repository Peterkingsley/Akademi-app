import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  BookOpen,
  Clipboard as ClipboardIcon,
  HelpCircle,
  KeyRound,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react-native";
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
      const cleanText = text.trim().toUpperCase();
      setJoinCode(cleanText);
    } else {
      Alert.alert("Clipboard Empty", "No text found on your clipboard.");
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
      const room = await competitionService.joinRoom(
        code,
        joinCourseCode.trim().toUpperCase() || undefined,
      );
      setJoinCode("");
      setJoinCourseCode("");
      navigation.replace("CompetitionLobby", { roomId: room.id });
    } catch (error: any) {
      Alert.alert(
        "Could not join match",
        error?.response?.data?.message || "Check the room code and try again.",
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen
      style={[styles.screen, { backgroundColor: colors.background }]}
      title="Join Match Room"
      scrollable
    >
      <View style={styles.container}>
        {/* Header Hero */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: "rgba(34, 197, 94, 0.15)", borderColor: "rgba(34, 197, 94, 0.3)" },
            ]}
          >
            <KeyRound size={28} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
            Enter Match Code
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            Paste or enter the 6-character room code from your classmate or host to enter the arena.
          </Text>
        </View>

        {/* Main Code Input Card */}
        <Card style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.codeHeaderRow}>
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
              Room Code *
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.pastePill,
                { backgroundColor: "rgba(34, 197, 94, 0.12)", borderColor: colors.primary },
              ]}
              onPress={handlePasteCode}
            >
              <ClipboardIcon size={13} color={colors.primary} />
              <Text style={[styles.pastePillText, { color: colors.primary }]}>Paste Code</Text>
            </TouchableOpacity>
          </View>

          {/* Large Stylized Code Input Box */}
          <View
            style={[
              styles.largeCodeBox,
              { backgroundColor: colors.surfaceElevated, borderColor: joinCode ? colors.primary : colors.border },
            ]}
          >
            <Input
              placeholder="e.g. A7K2Q9"
              value={joinCode}
              onChangeText={(val) => setJoinCode(val.toUpperCase())}
              autoCapitalize="characters"
              maxLength={10}
              style={styles.largeCodeInputText}
            />
          </View>

          {/* Optional Course Code Input */}
          <View style={styles.courseWrap}>
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
              Your Course Code (Optional)
            </Text>
            <Input
              placeholder="e.g. EEE 301 (for dual-course matches)"
              value={joinCourseCode}
              onChangeText={(val) => setJoinCourseCode(val.toUpperCase())}
              autoCapitalize="characters"
            />
          </View>

          {/* Action Join Button */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.joinBtn,
              { backgroundColor: !joinCode.trim() ? colors.surfaceElevated : colors.primary },
            ]}
            onPress={joinMatchByCode}
            disabled={!joinCode.trim() || joining}
          >
            {joining ? (
              <ActivityIndicator color="#04110A" size="small" />
            ) : (
              <UserPlus size={18} color={!joinCode.trim() ? colors.textMuted : "#04110A"} />
            )}
            <Text
              style={[
                styles.joinBtnText,
                { color: !joinCode.trim() ? colors.textMuted : "#04110A" },
              ]}
            >
              {joining ? "Connecting to Arena..." : "Join Live Room"}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* How It Works Guide */}
        <Card style={[styles.guideCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.guideHeader}>
            <Sparkles size={16} color={colors.primary} />
            <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
              How to Join a Duel
            </Text>
          </View>

          <View style={styles.guideSteps}>
            <View style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.surface }]}>
                <Text style={[styles.stepNumText, { color: colors.primary }]}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                Get the room code shared by the match host.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.surface }]}>
                <Text style={[styles.stepNumText, { color: colors.primary }]}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                Paste or type the code in the box above.
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.surface }]}>
                <Text style={[styles.stepNumText, { color: colors.primary }]}>3</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                Tap <Text style={{ color: colors.primary, fontWeight: "700" }}>Join Live Room</Text> to enter the lobby and compete!
              </Text>
            </View>
          </View>
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
    gap: 16,
    paddingBottom: 36,
  },
  heroSection: {
    alignItems: "center",
    textAlign: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  mainCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  codeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  pastePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  pastePillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  largeCodeBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  largeCodeInputText: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  courseWrap: {
    gap: 8,
  },
  courseLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  joinBtnText: {
    fontSize: 15,
    fontWeight: "800",
  },
  guideCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  guideSteps: {
    gap: 10,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: "800",
  },
  stepText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});
