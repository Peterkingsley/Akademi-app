import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Apple, Eye, EyeOff } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import { Toast } from "../../components/ui/Toast";
import api from "../../services/api";

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { university, faculty, department, level, selectedCourses } = route.params || {};

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Basic enforcement: if academic data is missing, redirect back
    if (!university || !department) {
       setError("Missing academic profile. Please go back and complete the selection.");
    }
  }, [university, department]);

  const handleRegister = async () => {
    if (!university || !department) {
      setError("Please complete the onboarding flow correctly.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Convert level string to number (e.g. "300L" -> 300)
      const levelInt = parseInt(level.replace(/[^0-9]/g, ""), 10) || 100;

      await api.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        university,
        faculty,
        department,
        level: levelInt,
        courses: selectedCourses,
      });
      navigation.navigate("EmailVerification", { email: form.email });
    } catch (err: any) {
      console.log("Registration failed", err.response?.data?.message || err.message);
      const message = err.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!form.password) return 0;
    if (form.password.length < 4) return 1;
    if (form.password.length < 8) return 2;
    if (/[A-Z]/.test(form.password) && /[0-9]/.test(form.password)) return 4;
    return 3;
  };

  const strength = getPasswordStrength();
  const strengthLabels = ["WEAK", "WEAK", "FAIR", "MEDIUM", "STRONG"];

  const handleSocialComingSoon = () => {
    setToast({ message: "Coming soon...", type: "warning" });
  };
  const strengthColors = [colors.error, colors.error, colors.warning, colors.warning, colors.success];

  return (
    <Screen style={{ flex: 1 }}
      onBack={() => navigation.navigate("Onboarding")}
      title=""
      rightAction={
        <Text style={styles.headerTitle}>Akademi</Text>
      }
      scrollable
    >
      <View style={styles.container}>
        <Text style={styles.headline}>Almost there!</Text>
        <Text style={styles.subtext}>Create your account to save your progress</Text>

        {error && (
          <View style={styles.errorBanner}>
            <View style={styles.errorHeader}>
              <Text style={styles.errorText}>{error}</Text>
              {error.includes("academic profile") && (
                <TouchableOpacity
                  style={styles.errorAction}
                  onPress={() => navigation.navigate("Onboarding")}
                >
                  <Text style={styles.errorActionText}>Go back</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.googleButton} onPress={handleSocialComingSoon}>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.appleButton} onPress={handleSocialComingSoon}>
            <Apple size={20} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.appleText}>Apple</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
          <View style={styles.dividerLine} />
        </View>

        <Input
          label="Full Name"
          placeholder="Enter your full name"
          value={form.name}
          onChangeText={(text) => setForm({ ...form, name: text })}
        />

        <Input
          label="Email address"
          placeholder="name@example.com"
          value={form.email}
          onChangeText={(text) => setForm({ ...form, email: text })}
          keyboardType="email-address"
        />

        <View style={styles.passwordContainer}>
          <Input
            label="Password"
            placeholder="Min. 8 characters"
            value={form.password}
            onChangeText={(text) => setForm({ ...form, password: text })}
            secureTextEntry={!showPassword}
            style={{ marginBottom: 8 }}
          />
          <View style={styles.strengthBarContainer}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthSegment,
                  i <= strength && { backgroundColor: strengthColors[strength] }
                ]}
              />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: colors.textSecondary }]}>
            PASSWORD STRENGTH: <Text style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</Text>
          </Text>
        </View>

        <View style={styles.phoneInputContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>Phone number</Text>
            <Text style={styles.optionalTag}>OPTIONAL</Text>
          </View>
          <Input
            label=""
            placeholder="+234 000 000 0000"
            value={form.phone}
            onChangeText={(text) => setForm({ ...form, phone: text })}
            keyboardType="phone-pad"
          />
        </View>

        <Text style={styles.termsText}>
          By continuing, you agree to our{" "}
          <Text style={styles.linkText} onPress={() => navigation.navigate("PrivacyData")}>Terms of Service</Text>
          {" "}and{" "}
          <Text style={styles.linkText} onPress={() => navigation.navigate("PrivacyData")}>Privacy Policy</Text>
        </Text>

        <Button
          label="Create Account"
          onPress={handleRegister}
          loading={loading}
          disabled={!university || !department || !form.email || !form.password || !form.name}
          style={styles.createButton}
        />

        <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.signInLink}>
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.linkText}>Sign in instead</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.tabTextInactive}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, styles.tabItemActive]}>
          <Text style={styles.tabTextActive}>Create Account</Text>
          <View style={styles.tabIndicator} />
        </TouchableOpacity>
      </View>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onHide={() => setToast(null)}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerTitle: {
    color: colors.primary,
    fontSize: 13.5,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  container: {
    padding: 24,
    paddingBottom: 140,
    flex: 1,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 24,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 11.25,
    fontFamily: "Inter-Regular",
    marginTop: 8,
    marginBottom: 32,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  googleButton: {
    flex: 1,
    height: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  googleIcon: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4285F4",
    marginRight: 8,
  },
  googleText: {
    color: "#000000",
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  appleButton: {
    flex: 1,
    height: 52,
    backgroundColor: "#000000",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  appleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    marginLeft: 8,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 8.25,
    fontFamily: "SpaceMono-Regular",
    marginHorizontal: 16,
  },
  passwordContainer: {
    marginBottom: 20,
  },
  strengthBarContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  strengthLabel: {
    fontSize: 8.25,
    fontFamily: "SpaceMono-Regular",
  },
  phoneInputContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 9.75,
    fontFamily: "Inter-Regular",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  optionalTag: {
    color: colors.textMuted,
    fontSize: 8.25,
    fontFamily: "SpaceMono-Regular",
  },
  termsText: {
    color: colors.textSecondary,
    fontSize: 9.75,
    fontFamily: "Inter-Regular",
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 24,
  },
  linkText: {
    color: colors.primary,
    fontFamily: "Inter-Bold",
  },
  createButton: {
    marginBottom: 24,
  },
  signInLink: {
    alignItems: "center",
    marginBottom: 40,
  },
  signInText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontFamily: "Inter-Regular",
  },
  tabSwitcher: {
    flexDirection: "row",
    height: 60,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  tabTextInactive: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontFamily: "Inter-SemiBold",
  },
  tabTextActive: {
    color: colors.primary,
    fontSize: 10.5,
    fontFamily: "Inter-SemiBold",
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    color: colors.error,
    fontSize: 10.5,
    fontFamily: "Inter-Medium",
    flex: 1,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorAction: {
    backgroundColor: colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  errorActionText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontFamily: "Inter-Bold",
  },
  tabIndicator: {
    position: "absolute",
    top: 0,
    width: 40,
    height: 2,
    backgroundColor: colors.primary,
  },
});
