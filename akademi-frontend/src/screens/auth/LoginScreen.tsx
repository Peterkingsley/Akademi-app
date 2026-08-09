import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowRight, BookOpen, LockKeyhole, Mail } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { BrandWordmark } from "../../components/ui/BrandWordmark";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useGoogleAuth } from "../../hooks/useGoogleAuth";
import { useTheme } from "../../theme/ThemeContext";

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { loading: googleLoading, error: googleError } = useGoogleAuth();
  const { colors, radius, space, typeScale } = useTheme();
  const styles = useMemo(() => createStyles(colors, radius, space, typeScale), [colors, radius, space, typeScale]);

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
        email: form.email.trim().toLowerCase(),
        password: form.password,
        deviceInfo: {
          name: Platform.OS === "ios" ? "iPhone" : "Android Device",
          type: Platform.OS === "ios" ? "IOS" : "ANDROID",
        },
      });

      const { user, accessToken, refreshToken, adminAccessToken } = response.data;
      setAuth(user, accessToken, refreshToken, adminAccessToken);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        (err.request ? "Unable to reach Akademi. Check your connection and try again." : "Sign in failed. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen hideHeader style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <View style={styles.topRow}>
            <BrandWordmark style={styles.brandText} />
            <TouchableOpacity
              style={styles.signUpButton}
              onPress={() => navigation.navigate("UniversityPicker")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              <Text style={styles.signUpText}>Create account</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.intro}>
            <Text style={styles.eyebrow}>WELCOME BACK</Text>
            <Text style={styles.headline}>Continue learning</Text>
            <Text style={styles.subtext}>Sign in to return to your study sessions, course materials, and exam prep.</Text>
          </View>

          <View style={styles.form}>
            {error || googleError ? (
              <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{error || googleError}</Text>
              </View>
            ) : null}

            <Input
              label="Email address"
              placeholder="name@example.com"
              value={form.email}
              onChangeText={(text) => setForm((current) => ({ ...current, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
              enableVoiceInput={false}
              leftIcon={<Mail size={20} color={colors.fg.muted} />}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={form.password}
              onChangeText={(text) => setForm((current) => ({ ...current, password: text }))}
              secureTextEntry
              leftIcon={<LockKeyhole size={20} color={colors.fg.muted} />}
              style={styles.passwordInput}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPassword", { email: form.email })}
              style={styles.forgotButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Reset your password"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button
              label="Sign in"
              onPress={handleLogin}
              loading={loading}
              disabled={loading || googleLoading}
              style={styles.signInButton}
              icon={<ArrowRight size={20} color={colors.brand.onFill} />}
            />

            <View style={styles.newUserBlock}>
              <View style={styles.secondaryIcon}>
                <BookOpen size={20} color={colors.brand.foreground} />
              </View>
              <View style={styles.secondaryCopy}>
                <Text style={styles.secondaryTitle}>New to Akademi?</Text>
                <Text style={styles.secondaryText}>Create your profile and add your course codes.</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate("UniversityPicker")}
                style={styles.inlineAction}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Get started"
              >
                <Text style={styles.inlineActionText}>Get started</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

const createStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  radius: ReturnType<typeof useTheme>["radius"],
  space: ReturnType<typeof useTheme>["space"],
  typeScale: ReturnType<typeof useTheme>["typeScale"],
) => StyleSheet.create({
  screen: { backgroundColor: colors.bg.canvas, flex: 1 },
  page: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: space[5],
    paddingVertical: space[6],
  },
  shell: { alignSelf: "center", maxWidth: 520, width: "100%" },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space[8],
  },
  brandText: { ...typeScale.title, color: colors.fg.primary },
  signUpButton: {
    alignItems: "center",
    borderColor: colors.borderRoles.default,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: space[4],
  },
  signUpText: { ...typeScale.label, color: colors.fg.primary },
  intro: { marginBottom: space[8] },
  eyebrow: { ...typeScale.caption, color: colors.brand.foreground, fontWeight: "700", letterSpacing: 1.2, marginBottom: space[2] },
  headline: { ...typeScale.display, color: colors.fg.primary },
  subtext: { ...typeScale.body, color: colors.fg.secondary, marginTop: space[3], maxWidth: 460 },
  form: { width: "100%" },
  errorBanner: {
    backgroundColor: colors.status.error.bg,
    borderColor: colors.status.error.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[4],
    padding: space[4],
  },
  errorText: { ...typeScale.secondary, color: colors.status.error.fg },
  passwordInput: { marginBottom: space[1] },
  forgotButton: { alignSelf: "flex-end", justifyContent: "center", minHeight: 48, marginBottom: space[3] },
  forgotText: { ...typeScale.label, color: colors.brand.foreground },
  signInButton: { minHeight: 56 },
  newUserBlock: {
    alignItems: "center",
    borderTopColor: colors.borderRoles.subtle,
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: space[8],
    paddingTop: space[6],
  },
  secondaryIcon: {
    alignItems: "center",
    backgroundColor: colors.brand.subtle,
    borderRadius: radius.md,
    height: 44,
    justifyContent: "center",
    marginRight: space[3],
    width: 44,
  },
  secondaryCopy: { flex: 1, paddingRight: space[2] },
  secondaryTitle: { ...typeScale.label, color: colors.fg.primary },
  secondaryText: { ...typeScale.caption, color: colors.fg.muted, marginTop: space[1] },
  inlineAction: { justifyContent: "center", minHeight: 48, paddingHorizontal: space[2] },
  inlineActionText: { ...typeScale.label, color: colors.brand.foreground },
});
