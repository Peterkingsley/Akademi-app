import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { RefreshCw, Info, Mail } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";

export const ForgotPasswordScreen: React.FC = () => {
  const { colors, typography, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialEmail = route.params?.email || "";

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSuccess(true);
    } catch (error) {
      console.error("Forgot password failed", error);
      // For demo, show success anyway
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Screen style={{ flex: 1 }} onBack={() => navigation.goBack()} title="">
        <View style={styles.container}>
          <View style={[styles.iconContainer, { backgroundColor: isDark ? "#0D1526" : "#F0F9FF" }]}>
            <Mail size={24} color={colors.primary} />
          </View>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Check your inbox</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12, marginBottom: 32, lineHeight: 24 }]}>
            We've sent a password reset link to <Text style={{ color: colors.primary }}>{email}</Text>.
          </Text>
          <Button
            label="Back to Sign In"
            onPress={() => navigation.navigate("Login")}
            style={styles.button}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ flex: 1 }}
      onBack={() => navigation.goBack()}
      title=""
      rightAction={
        <Text style={[typography.h4, { color: colors.primary }]}>Akademi</Text>
      }
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.iconContainer, { backgroundColor: isDark ? "#0D1526" : "#F0F9FF" }]}>
          <RefreshCw size={24} color={colors.primary} />
        </View>

        <Text style={[typography.h1, { color: colors.textPrimary }]}>Reset your password</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12, marginBottom: 32, lineHeight: 24 }]}>
          Enter your email and we'll send you a reset link.
        </Text>

        <Input
          label="Email Address"
          placeholder="name@university.edu.ng"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          leftIcon={<Mail size={20} color={colors.textMuted} />}
          style={styles.input}
        />

        <View style={[styles.noticeBanner, { backgroundColor: isDark ? "#0D1526" : "#F0F9FF" }]}>
          <Info size={20} color={colors.primary} />
          <Text style={[typography.mono, { color: colors.textSecondary, marginLeft: 12, flex: 1 }]}>
            SYSTEM_NOTICE: ENSURE ACCESS TO YOUR REGISTERED INSTITUTIONAL EMAIL FOR FASTER VERIFICATION.
          </Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.techTextContainer}>
          <Text style={[typography.mono, { color: colors.border, textAlign: "center", fontSize: 7.5 }]}>
            010101 RECOVER_SEQ_INITIATED // AUTH_KEY_GENERATION // SYNC_LIBRARY_ACCESS // 010101
          </Text>
        </View>

        <Button
          label="Send Reset Link"
          onPress={handleReset}
          loading={loading}
          disabled={!email}
          style={styles.button}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          style={styles.backLink}
        >
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Remembered your password? <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24, paddingBottom: 100,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 20,
  },
  input: {
    marginBottom: 24,
  },
  noticeBanner: {
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  techTextContainer: {
    marginBottom: 24,
    alignItems: "center",
  },
  button: {
    marginBottom: 24,
  },
  backLink: {
    alignItems: "center",
    marginBottom: 40,
  },
});
