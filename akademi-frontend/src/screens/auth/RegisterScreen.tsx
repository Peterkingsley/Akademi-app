import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BookOpen, GraduationCap, LockKeyhole, Mail, User } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
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

  const hasAcademicProfile = !!university && !!department && !!semester && !!semesterStart && !!semesterEnd && selectedCourses.length > 0;

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

      await api.post("/auth/register", {
        name: form.name.trim(),
        email: form.email.trim(),
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

      navigation.navigate("EmailVerification", { email: form.email.trim() });
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
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.navigate("UniversityPicker")} style={styles.backChip} activeOpacity={0.8}>
            <GraduationCap size={17} color={colors.primary} />
            <Text style={styles.backChipText}>Academic profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Login")} activeOpacity={0.8}>
            <Text style={styles.signInTop}>Sign in</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <User size={23} color={colors.primary} />
          </View>
          <Text style={styles.headline}>Create your account</Text>
          <Text style={styles.subtext}>Save your materials, tutor sessions, mock attempts, and progress history.</Text>
        </View>

        <View style={styles.academicCard}>
          <View style={styles.academicIcon}>
            <BookOpen size={19} color={colors.primary} />
          </View>
          <View style={styles.academicCopy}>
            <Text style={styles.cardLabel}>Studying as</Text>
            <Text style={styles.academicTitle} numberOfLines={2}>
              {hasAcademicProfile ? `${department} / ${level || "Level"} / Semester ${semester}` : "Academic profile missing"}
            </Text>
            <Text style={styles.academicMeta} numberOfLines={2}>
              {hasAcademicProfile ? `${university} - ${selectedCourses.length} course codes - ${semesterStart} to ${semesterEnd}` : "Go back and choose your school details."}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Input
            label="Full name"
            placeholder="Enter your full name"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            leftIcon={<User size={18} color={colors.textMuted} />}
          />

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
            <Text style={styles.linkText} onPress={() => navigation.navigate("PrivacyData")}>Terms</Text>
            {" "}and{" "}
            <Text style={styles.linkText} onPress={() => navigation.navigate("PrivacyData")}>Privacy Policy</Text>.
          </Text>

          <Button label="Create account" onPress={handleRegister} loading={loading} disabled={loading} style={styles.createButton} />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.signInLink}>
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.linkText}>Sign in instead</Text>
          </Text>
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
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backChip: {
    alignItems: "center",
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  backChipText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
    marginLeft: 7,
  },
  signInTop: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    height: 46,
    justifyContent: "center",
    marginBottom: 16,
    width: 46,
  },
  headline: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 27,
    lineHeight: 34,
  },
  subtext: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
  },
  academicCard: {
    alignItems: "center",
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 14,
    padding: 14,
  },
  academicIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    marginRight: 12,
    width: 42,
  },
  academicCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardLabel: {
    ...typography.label,
    color: colors.primary,
    fontSize: 9,
    marginBottom: 4,
  },
  academicTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14,
  },
  academicMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 4,
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
  strengthBarContainer: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 8,
  },
  strengthSegment: {
    backgroundColor: colors.border,
    borderRadius: 2,
    flex: 1,
    height: 4,
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
    borderRadius: 8,
  },
  signInLink: {
    alignItems: "center",
    marginTop: 18,
  },
  signInText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
