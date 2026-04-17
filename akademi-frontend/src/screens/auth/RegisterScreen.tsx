import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Apple } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import { TabSwitcher } from "../../components/ui/TabSwitcher";
import api from "../../services/api";

export const RegisterScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { university, faculty, department, level } = route.params || {};

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const levelInt = parseInt(level?.replace(/[^0-9]/g, "") || "100", 10);

      await api.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        university,
        faculty,
        department,
        level: levelInt,
      });
      navigation.navigate("EmailVerification", { email: form.email });
    } catch (err: any) {
      console.error("Registration failed", err.response?.data?.message || err.message);
      setError(err.response?.data?.message || "Registration failed. Please try again.");
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
  const strengthColors = [colors.error, colors.error, colors.warning, colors.warning, colors.success];

  const tabs = [
    {
      label: "Sign In",
      onPress: () => navigation.navigate("Login"),
      isActive: false,
    },
    {
      label: "Create Account",
      onPress: () => {},
      isActive: true,
    },
  ];

  return (
    <Screen
      style={{ flex: 1 }}
      title=""
      rightAction={
        <Text style={[typography.h4, { color: colors.primary }]}>Akademi</Text>
      }
      scrollable
    >
      <View style={styles.container}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>Almost there!</Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 8, marginBottom: 32 }]}>
          Create your account to save your progress
        </Text>

        {error && (
          <View style={[styles.errorBanner, { borderColor: colors.error }]}>
            <Text style={[typography.bodySmall, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        <View style={styles.socialRow}>
          <TouchableOpacity style={[styles.socialButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={[typography.body, { color: "#FFFFFF", fontWeight: "600", marginLeft: 8 }]}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.socialButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Apple size={20} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={[typography.body, { color: "#FFFFFF", fontWeight: "600", marginLeft: 8 }]}>Apple</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[typography.mono, { color: colors.textMuted, marginHorizontal: 16 }]}>OR CONTINUE WITH</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <Input
          label="Full Name"
          placeholder="Enter your full name"
          value={form.name}
          onChangeText={(text) => setForm({ ...form, name: text })}
        />

        <Input
          label="Email address"
          placeholder="name@university.edu.ng"
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
            secureTextEntry
            style={{ marginBottom: 8 }}
          />
          <View style={styles.strengthBarContainer}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthSegment,
                  { backgroundColor: colors.border },
                  i <= strength && { backgroundColor: strengthColors[strength] }
                ]}
              />
            ))}
          </View>
          <Text style={[typography.mono, { color: colors.textSecondary }]}>
            PASSWORD STRENGTH: <Text style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</Text>
          </Text>
        </View>

        <View style={styles.phoneInputContainer}>
          <View style={styles.labelRow}>
            <Text style={[typography.label, { color: colors.textSecondary }]}>Phone number</Text>
            <Text style={[typography.mono, { color: colors.textMuted }]}>OPTIONAL</Text>
          </View>
          <Input
            label=""
            placeholder="+234 000 000 0000"
            value={form.phone}
            onChangeText={(text) => setForm({ ...form, phone: text })}
            keyboardType="phone-pad"
          />
        </View>

        <Text style={[typography.bodySmall, { color: colors.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 18 }]}>
          By continuing, you agree to our{" "}
          <Text style={{ color: colors.primary, fontWeight: "700" }} onPress={() => Linking.openURL("#")}>Terms of Service</Text>
          {" "}and{" "}
          <Text style={{ color: colors.primary, fontWeight: "700" }} onPress={() => Linking.openURL("#")}>Privacy Policy</Text>
        </Text>

        <Button
          label="Create Account"
          onPress={handleRegister}
          loading={loading}
          style={styles.createButton}
        />

        <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.signInLink}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Already have an account? <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign in instead</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <TabSwitcher tabs={tabs} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 140,
    flex: 1,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  socialButton: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    borderWidth: 1,
  },
  googleIcon: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
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
    borderRadius: 2,
    marginHorizontal: 2,
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
  createButton: {
    marginBottom: 24,
  },
  signInLink: {
    alignItems: "center",
    marginBottom: 40,
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
});
