import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import { userService } from "../../services/user";
import { Check, ShieldCheck, Lock } from "lucide-react-native";

export const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isMinLength = newPassword.length >= 8;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      await userService.changePassword(oldPassword, newPassword);
      Alert.alert("Success", "Password changed successfully", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to change password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Change Password" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.container}>
        <LinearGradient
          colors={["#0B1E12", "#04110A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.iconContainer}>
            <ShieldCheck size={28} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Security Settings</Text>
          <Text style={styles.heroSubtitle}>Update your password to keep your account & study progress secure</Text>
        </LinearGradient>

        <View style={styles.form}>
          <Input
            label="Current Password"
            placeholder="Enter current password"
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry
          />

          <Input
            label="New Password"
            placeholder="Enter new password (min 8 chars)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />

          <Input
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <View style={styles.requirementsBox}>
            <Text style={styles.reqTitle}>PASSWORD REQUIREMENTS</Text>
            <View style={styles.reqRow}>
              <View style={[styles.reqDot, isMinLength && styles.reqDotActive]}>
                <Check size={10} color={isMinLength ? "#04110A" : colors.textMuted} />
              </View>
              <Text style={[styles.reqText, isMinLength && styles.reqTextActive]}>At least 8 characters long</Text>
            </View>
            <View style={styles.reqRow}>
              <View style={[styles.reqDot, isMatching && styles.reqDotActive]}>
                <Check size={10} color={isMatching ? "#04110A" : colors.textMuted} />
              </View>
              <Text style={[styles.reqText, isMatching && styles.reqTextActive]}>Passwords match</Text>
            </View>
          </View>

          <Button
            label="Update Password"
            onPress={handleChangePassword}
            loading={loading}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 40,
  },
  heroCard: {
    alignItems: "center",
    borderColor: "rgba(34,197,94,0.25)",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    padding: 20,
  },
  iconContainer: {
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    marginBottom: 12,
    width: 48,
  },
  heroTitle: { ...typography.h3, color: colors.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" },
  heroSubtitle: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4, textAlign: "center" },
  form: {
    width: "100%",
  },
  requirementsBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  reqTitle: {
    color: colors.textMuted,
    fontFamily: "SpaceMono-Regular",
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 10,
  },
  reqRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 6,
  },
  reqDot: {
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    marginRight: 8,
    width: 18,
  },
  reqDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reqText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reqTextActive: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  button: {
    marginTop: 20,
  },
});
