import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LockKeyhole, Mail } from "lucide-react-native";
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { Screen } from "../../components/layout/Screen";
import { BrandWordmark } from "../../components/ui/BrandWordmark";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useGoogleAuth } from "../../hooks/useGoogleAuth";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useTheme } from "../../theme/ThemeContext";

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { loading: googleLoading, error: googleError } = useGoogleAuth();
  const reduceMotion = useReducedMotion();
  const { colors, radius, space, typeScale } = useTheme();
  const styles = useMemo(() => createStyles(colors, radius, space, typeScale), [colors, radius, space, typeScale]);

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldOffset = useSharedValue(0);

  const fieldErrorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fieldOffset.value }],
  }));
  const entrance = (delay: number) => reduceMotion ? undefined : FadeInUp.delay(delay).duration(260);
  const triggerFieldError = () => {
    if (reduceMotion) return;
    fieldOffset.value = withSequence(
      withTiming(-4, { duration: 45 }),
      withTiming(4, { duration: 70 }),
      withTiming(-3, { duration: 60 }),
      withTiming(0, { duration: 55 }),
    );
  };

  const canSubmit = form.email.trim().length > 0 && form.password.length > 0;

  const handleLogin = async () => {
    if (!canSubmit) {
      setError("Enter your email and password to continue.");
      triggerFieldError();
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
      triggerFieldError();
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
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={styles.topRow}>
            <BrandWordmark style={styles.brandWordmark} />
          </Animated.View>

          <Animated.View entering={entrance(80)} style={styles.intro}>
            <Text style={styles.headline}>Welcome back</Text>
            <Text style={styles.subtext}>Pick up where your learning left off.</Text>
          </Animated.View>

          <View style={styles.form}>
            {error || googleError ? (
              <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)} style={styles.errorBanner} accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{error || googleError}</Text>
              </Animated.View>
            ) : null}

            <Animated.View style={fieldErrorStyle}>
              <Animated.View entering={entrance(180)}>
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
              </Animated.View>

              <Animated.View entering={entrance(240)}>
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChangeText={(text) => setForm((current) => ({ ...current, password: text }))}
                  secureTextEntry
                  leftIcon={<LockKeyhole size={20} color={colors.fg.muted} />}
                  labelAccessory={
                    <TouchableOpacity
                      onPress={() => navigation.navigate("ForgotPassword", { email: form.email })}
                      activeOpacity={0.75}
                      accessibilityRole="link"
                      accessibilityLabel="Reset your password"
                    >
                      <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>
                  }
                />
              </Animated.View>
            </Animated.View>

            <Animated.View entering={entrance(300)}>
              <Button
                label="Sign in"
                onPress={handleLogin}
                loading={loading}
                disabled={loading || googleLoading}
                style={styles.signInButton}
                pressScale={0.98}
              />
            </Animated.View>

            <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(420).duration(180)} style={styles.newUserPrompt}>
              <Text style={styles.newUserText}>New to Akademi?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("UniversityPicker")}
                style={styles.createProfileButton}
                activeOpacity={0.75}
                accessibilityRole="link"
                accessibilityLabel="Create your profile"
              >
                <Text style={styles.createProfileText}>Create your profile</Text>
              </TouchableOpacity>
            </Animated.View>
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
    justifyContent: "flex-start",
    paddingHorizontal: space[5],
    paddingVertical: space[8],
  },
  shell: { alignSelf: "center", maxWidth: 520, width: "100%" },
  topRow: {
    marginBottom: space[6],
  },
  brandWordmark: { height: 42, width: 142 },
  intro: { marginBottom: space[8] },
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
  forgotText: { ...typeScale.caption, color: colors.fg.muted },
  signInButton: { minHeight: 48 },
  newUserPrompt: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: space[6],
  },
  newUserText: { ...typeScale.secondary, color: colors.fg.secondary },
  createProfileButton: { marginLeft: space[2] },
  createProfileText: { ...typeScale.secondary, color: colors.brand.foreground, fontWeight: "700" },
});
