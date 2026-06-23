import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BookOpen, LockKeyhole, Mail } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { BrandWordmark } from "../../components/ui/BrandWordmark";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = form.email.trim().length > 0 && form.password.length > 0;

  const handleLogin = async () => {
    if (!canSubmit) {
      setError("Enter your email and password to continue.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post("/auth/login", {
        email: form.email.trim(),
        password: form.password,
        deviceInfo: {
          name: Platform.OS === "ios" ? "iPhone" : "Android Device",
          type: Platform.OS === "ios" ? "IOS" : "ANDROID",
        },
      });

      const { user, accessToken, refreshToken } = response.data;
      setAuth(user, accessToken, refreshToken);
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen hideHeader style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <BrandWordmark style={styles.brandText} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <BookOpen size={24} color={colors.primary} />
          </View>
          <Text style={styles.headline}>Welcome back</Text>
          <Text style={styles.subtext}>Sign in to continue your study sessions, materials, and exam prep.</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Input
            label="Email address"
            placeholder="name@example.com"
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            keyboardType="email-address"
            leftIcon={<Mail size={18} color={colors.textMuted} />}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={form.password}
            onChangeText={(text) => setForm({ ...form, password: text })}
            secureTextEntry
            leftIcon={<LockKeyhole size={18} color={colors.textMuted} />}
            style={styles.passwordInput}
          />

          <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword", { email: form.email })} style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button label="Sign in" onPress={handleLogin} loading={loading} disabled={loading} style={styles.signInButton} />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("UniversityPicker")} style={styles.createCard} activeOpacity={0.85}>
          <Text style={styles.createTitle}>New to Akademi?</Text>
          <Text style={styles.createText}>Create your academic profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingBottom: 34,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 22,
  },
  brandText: {
    ...typography.h2,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 20,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    marginBottom: 18,
    width: 48,
  },
  headline: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 36,
  },
  subtext: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
  },
  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: colors.error,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  passwordInput: {
    marginBottom: 8,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 18,
  },
  forgotText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
  },
  signInButton: {
    borderRadius: 8,
  },
  createCard: {
    alignItems: "center",
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  createTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  createText: {
    ...typography.h4,
    color: colors.primary,
    marginTop: 4,
  },
});
