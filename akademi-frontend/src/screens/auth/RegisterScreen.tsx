import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowRight, BookOpen, GraduationCap, LockKeyhole, Mail, ShieldCheck, User } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { AuthProgressDots } from "../../components/auth/AuthProgressDots";
import api from "../../services/api";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    university,
    faculty,
    department,
    level,
    semester,
    semesterStart,
    semesterEnd,
    selectedCourses = [],
    academicCourses = [],
  } = route.params || {};

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // University/department/level always come from the earlier onboarding
  // steps. Course codes and semester dates are optional — a student can
  // skip them at sign-up and add them later from their profile.
  const hasAcademicProfile = !!university && !!department && !!level;
  const hasCourses = selectedCourses.length > 0;

  useEffect(() => {
    if (!hasAcademicProfile) {
      setError("Complete your academic profile before creating an account.");
    }
  }, [hasAcademicProfile]);

  const handleRegister = async () => {
    if (!hasAcademicProfile) {
      setError("Complete your academic profile before creating an account.");
      return;
    }

    if (!form.name.trim() || !form.email.trim()) {
      setError("Enter your name and email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const levelInt = parseInt(String(level || "").replace(/[^0-9]/g, ""), 10) || 100;
      const normalizedEmail = form.email.trim().toLowerCase();

      await api.post("/auth/register", {
        name: form.name.trim(),
        email: normalizedEmail,
        password: form.password,
        university,
        faculty,
        department,
        level: levelInt,
        semester,
        semesterStart,
        semesterEnd,
        courses: selectedCourses,
        academicCourses,
      });

      navigation.navigate("EmailVerification", { email: normalizedEmail });
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!form.password) return 0;
    if (form.password.length < 8) return 1;
    if (/[A-Z]/.test(form.password) && /[0-9]/.test(form.password) && /[^A-Za-z0-9]/.test(form.password)) return 4;
    if (/[A-Z]/.test(form.password) && /[0-9]/.test(form.password)) return 3;
    return 2;
  };

  const strength = getPasswordStrength();
  const strengthLabels = ["Not started", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = [colors.border, colors.error, colors.warning, colors.warning, colors.success];

  return (
    <Screen hideHeader style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.profileChip}
            onPress={() => (hasAcademicProfile ? navigation.goBack() : navigation.navigate("UniversityPicker"))}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Edit academic profile"
          >
            <GraduationCap size={16} color={colors.primary} />
            <Text style={styles.profileChipText}>Academic Profile</Text>
          </TouchableOpacity>
          <AuthProgressDots step={4} total={4} />
          <TouchableOpacity
            style={styles.authChip}
            onPress={() => navigation.navigate("Login")}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go to sign in"
          >
            <Text style={styles.authChipText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroCopy}>
            <Text style={styles.headline}>Create Account</Text>
            <Text style={styles.subtext}>Save your materials, practice history, and progress from day one.</Text>
          </View>
          <View style={styles.heroOrb}>
            <ShieldCheck size={28} color="#050505" />
          </View>
        </View>

        <View style={styles.profileSummaryCard}>
          <View style={styles.summaryIcon}>
            <BookOpen size={18} color={colors.primary} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>Current profile</Text>
            <Text style={styles.summaryTitle} numberOfLines={2}>
              {hasAcademicProfile
                ? `${department} / ${level || "Level"}${hasCourses ? ` / Semester ${semester}` : ""}`
                : "Academic profile missing"}
            </Text>
            <Text style={styles.summaryMeta} numberOfLines={2}>
              {!hasAcademicProfile
                ? "Go back and choose your school details before creating your account."
                : hasCourses
                  ? `${university} · ${selectedCourses.length} courses · ${semesterStart} to ${semesterEnd}`
                  : `${university} · No course codes yet — add them anytime from your profile.`}
            </Text>
          </View>
        </View>

        <View style={styles.formPanel}>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            leftIcon={<User size={18} color={colors.textMuted} />}
          />

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
            placeholder="At least 8 characters"
            value={form.password}
            onChangeText={(text) => setForm({ ...form, password: text })}
            secureTextEntry
            leftIcon={<LockKeyhole size={18} color={colors.textMuted} />}
            style={styles.passwordInput}
          />

          <View style={styles.strengthBarContainer}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthSegment,
                  i <= strength && { backgroundColor: strengthColors[strength] },
                ]}
              />
            ))}
          </View>
          <Text style={styles.strengthLabel}>
            Password strength: <Text style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</Text>
          </Text>

          <Text style={styles.termsText}>
            By continuing, you agree to Akademi's{" "}
            <Text
              style={styles.linkText}
              onPress={() => navigation.navigate("PrivacyData")}
              accessibilityRole="link"
              accessibilityLabel="Terms of Service"
            >
              Terms
            </Text>
            {" "}and{" "}
            <Text
              style={styles.linkText}
              onPress={() => navigation.navigate("PrivacyData")}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
            >
              Privacy Policy
            </Text>.
          </Text>

          <Button
            label="Create Account"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.createButton}
            icon={<ArrowRight size={18} color="#FFFFFF" />}
          />
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
    gap: 10,
  },
  profileChip: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#232323",
    flexDirection: "row",
  },
  profileChipText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
    marginLeft: 8,
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
    color: colors.textPrimary,
    fontWeight: "700",
  },
  heroPanel: {
    backgroundColor: "#101412",
    borderWidth: 1,
    borderColor: "#1D3528",
    borderRadius: 28,
    marginBottom: 14,
    minHeight: 186,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingVertical: 20,
    justifyContent: "space-between",
  },
  heroCopy: {
    maxWidth: "74%",
  },
  headline: {
    ...typography.h1,
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 36,
  },
  subtext: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 8,
  },
  heroOrb: {
    position: "absolute",
    right: -18,
    top: -18,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#0A0D0B",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    paddingBottom: 20,
    paddingLeft: 18,
  },
  profileSummaryCard: {
    backgroundColor: "#101412",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1D3528",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(34,197,94,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryLabel: {
    ...typography.label,
    color: colors.primary,
    marginBottom: 4,
  },
  summaryTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  summaryMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
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
  strengthBarContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  strengthSegment: {
    backgroundColor: colors.border,
    borderRadius: 999,
    flex: 1,
    height: 5,
  },
  strengthLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  termsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 18,
    textAlign: "center",
  },
  linkText: {
    color: colors.primary,
    fontWeight: "700",
  },
  createButton: {
    borderRadius: 999,
    height: 52,
  },
});
