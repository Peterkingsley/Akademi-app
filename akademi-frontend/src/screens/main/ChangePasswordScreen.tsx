import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useNavigation } from "@react-navigation/native";
import { userService } from "../../services/user";
import { Lock, Eye, EyeOff } from "lucide-react-native";

export const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleUpdate = async () => {
    if (!form.oldPassword || !form.newPassword || !form.confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }

    if (form.newPassword.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await userService.changePassword(form.oldPassword, form.newPassword);
      Alert.alert("Success", "Password updated successfully", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to update password";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={{ flex: 1 }} title="Change Password" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Lock size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Secure Your Account</Text>
          <Text style={styles.subtitle}>
            Your new password must be different from previously used passwords.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Current Password"
            placeholder="Enter current password"
            value={form.oldPassword}
            onChangeText={(text) => setForm({ ...form, oldPassword: text })}
            secureTextEntry={!showOld}
            rightIcon={
              <Eye
                size={20}
                color={showOld ? colors.primary : colors.textMuted}
                onPress={() => setShowOld(!showOld)}
              />
            }
          />

          <Input
            label="New Password"
            placeholder="Min. 8 characters"
            value={form.newPassword}
            onChangeText={(text) => setForm({ ...form, newPassword: text })}
            secureTextEntry={!showNew}
            rightIcon={
              <Eye
                size={20}
                color={showNew ? colors.primary : colors.textMuted}
                onPress={() => setShowNew(!showNew)}
              />
            }
          />

          <Input
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={form.confirmPassword}
            onChangeText={(text) => setForm({ ...form, confirmPassword: text })}
            secureTextEntry={!showConfirm}
            rightIcon={
              <Eye
                size={20}
                color={showConfirm ? colors.primary : colors.textMuted}
                onPress={() => setShowConfirm(!showConfirm)}
              />
            }
          />

          <Button
            label="Update Password"
            onPress={handleUpdate}
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
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 13,
    paddingHorizontal: 20,
  },
  form: {
    gap: 16,
  },
  button: {
    marginTop: 16,
  },
});
