import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowRight, BookOpen, LockKeyhole, Mail, Search, ShieldCheck } from "lucide-react-native";

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
        <View style={styles.topRow}>
          <View style={styles.brandBadge}>
            <BrandWordmark style={styles.brandText} />
          </View>
          <View style={styles.iconRow}>
            <View style={styles.utilityIcon}>
              <Search size={16} color={colors.textPrimary} />
            </View>
            <TouchableOpacity style={styles.authChip} onPress={() => navigation.navigate("UniversityPicker")} activeOpacity={0.85}>
              <Text style={styles.authChipText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroCopy}>
            <Text style={styles.headline}>Sign In</Text>
            <Text style={styles.subtext}>Continue your study sessions, saved materials, and exam prep.</Text>
          </View>
          <View style={styles.heroOrb}>
            <ShieldCheck size={28} color={colors.background} />
          </View>
        </View>

        <View style={styles.formPanel}>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Email"
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

          <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword", { email: form.email })} style={styles.forgotButton} activeOpacity={0.85}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.signInButton}
            icon={<ArrowRight size={18} color="#FFFFFF" />}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>New here?</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity onPress={() => navigation.navigate("UniversityPicker")} style={styles.secondaryCard} activeOpacity={0.85}>
            <View style={styles.secondaryIcon}>
              <BookOpen size={18} color={colors.primary} />
            </View>
            <View style={styles.secondaryCopy}>
              <Text style={styles.secondaryTitle}>Create your academic profile</Text>
              <Text style={styles.secondaryText}>Set up your school, department, level, and course codes.</Text>
            </View>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brandBadge: {
    alignItems: "center",
    backgroundColor: "#101412",
    borderWidth: 1,
    borderColor: "#1D3528",
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  brandText: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  utilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  authChip: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101412",
    borderWidth: 1,
    borderColor: "#1D3528",
  },
  authChipText: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroPanel: {
    backgroundColor: "#101412",
    borderWidth: 1,
    borderColor: "#1D3528",
    borderRadius: 28,
    marginBottom: 16,
    minHeight: 192,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingVertical: 20,
    justifyContent: "space-between",
  },
  heroCopy: {
    maxWidth: "72%",
  },
  headline: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 34,
    lineHeight: 38,
  },
  subtext: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 8,
  },
  heroOrb: {
    position: "absolute",
    right: -22,
    bottom: -28,
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: "#0A0D0B",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingTop: 26,
    paddingLeft: 24,
  },
  formPanel: {
    backgroundColor: "#050505",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1F1F1F",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
  },
  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: colors.error,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    lineHeight: 18,
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
    borderRadius: 999,
    height: 52,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 18,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#1D1D1D",
  },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  secondaryCard: {
    backgroundColor: "#101412",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1D3528",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  secondaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(34,197,94,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  secondaryCopy: {
    flex: 1,
  },
  secondaryTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  secondaryText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
});
