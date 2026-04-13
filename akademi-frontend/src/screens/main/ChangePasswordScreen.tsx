import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { colors } from "../../theme/colors";
import { useNavigation } from "@react-navigation/native";
import { userService } from "../../services/user";
import { Lock } from "lucide-react-native";

export const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      Alert.alert("Error", "Failed to change password. Please check your old password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Change Password" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.iconContainer}>
          <Lock size={48} color={colors.primary} />
        </View>

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
            placeholder="Enter new password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />

          <Input
            label="Confirm New Password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

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
    padding: 24,
    alignItems: "center",
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    marginTop: 20,
  },
  form: {
    width: "100%",
  },
  button: {
    marginTop: 20,
  },
});
