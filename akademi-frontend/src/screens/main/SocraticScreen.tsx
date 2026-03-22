import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { X, Send, Paperclip, Mic, User } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { useNavigation } from "@react-navigation/native";

export const SocraticScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [message, setMessage] = useState("");

  const messages = [
    {
      id: "1",
      sender: "AI",
      text: "Great! Now that we've established R and X_L, how do we combine them to find the magnitude of Z? Think about the <text style={{color: colors.primary, fontWeight: '700'}}>Pythagorean theorem</text>.",
      label: "SOCRATIC GUIDE",
    },
    {
      id: "2",
      sender: "USER",
      text: "Is it Z = sqrt(R^2 + X_L^2)?",
      label: "YOU",
    },
  ];

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar size={32} name="Akademi" />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, typography.bodySmall, { fontWeight: "700" }]}>Akademi</Text>
            <Badge label="• SOCRATIC" variant="blue" style={styles.badge} />
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Home")} style={styles.closeBtn}>
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.assignmentSummary}>
        <Text style={[styles.monoLabel, typography.mono]}>CURRENT ASSIGNMENT</Text>
        <Text style={[styles.assignmentTitle, typography.bodySmall, { fontWeight: "700" }]}>RL Circuit Impedance Analysis</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.chatScroll}
        ref={(ref) => ref?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg) => (
          <View key={msg.id} style={[styles.messageWrapper, msg.sender === "USER" && styles.userMessageWrapper]}>
            <Text style={[
              styles.senderLabel,
              typography.mono,
              msg.sender === "USER" && { textAlign: "right" }
            ]}>
              {msg.label}
            </Text>
            <View style={[
              styles.bubble,
              msg.sender === "USER" ? styles.userBubble : styles.aiBubble
            ]}>
              <Text style={[styles.bubbleText, typography.bodySmall]}>
                {msg.text}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.optionsSection}>
          <TouchableOpacity style={styles.optionPill}>
            <Text style={[styles.optionMono, typography.mono]}>OPTION A</Text>
            <Text style={[styles.optionText, typography.bodySmall]}>Use the magnitude formula</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionPill}>
            <Text style={[styles.optionMono, typography.mono]}>OPTION B</Text>
            <Text style={[styles.optionText, typography.bodySmall]}>Add them algebraically</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <View style={styles.inputBar}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, typography.bodySmall]}
              placeholder="Type your realization here..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity style={styles.sendBtn}>
              <Send size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.inputActions}>
            <View style={styles.actionLinks}>
              <TouchableOpacity>
                <Text style={[styles.actionLink, typography.mono]}>ATTACH DIAGRAM</Text>
              </TouchableOpacity>
              <Text style={styles.divider}>|</Text>
              <TouchableOpacity>
                <Text style={[styles.actionLink, typography.mono]}>VOICE NOTE</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.progressText, typography.mono]}>3 / 5 LESSONS</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    marginLeft: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closeBtn: {
    padding: 8,
  },
  assignmentSummary: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  monoLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 4,
  },
  assignmentTitle: {
    color: "#FFFFFF",
  },
  chatScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  messageWrapper: {
    marginBottom: 24,
    maxWidth: "85%",
  },
  userMessageWrapper: {
    alignSelf: "flex-end",
  },
  senderLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 8,
  },
  bubble: {
    padding: 14,
    borderRadius: 12,
  },
  aiBubble: {
    backgroundColor: "#1E2D5E",
  },
  userBubble: {
    backgroundColor: "#2C3444",
  },
  bubbleText: {
    color: "#FFFFFF",
    lineHeight: 20,
  },
  optionsSection: {
    gap: 12,
    marginTop: 8,
  },
  optionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionMono: {
    color: colors.textMuted,
    marginRight: 12,
    fontSize: 10,
  },
  optionText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  inputBar: {
    backgroundColor: colors.surface,
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingLeft: 20,
    paddingRight: 6,
    height: 48,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  inputActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionLinks: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionLink: {
    color: colors.textMuted,
    fontSize: 10,
  },
  divider: {
    color: colors.textMuted,
    marginHorizontal: 10,
  },
  progressText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },
});
