import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Apple } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../theme/ThemeContext";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import { TabSwitcher } from "../../components/ui/TabSwitcher";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";

export const LoginScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const navigation = useNavigation<any>();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
        deviceInfo: {
          name: Platform.OS === 'ios' ? 'iPhone' : 'Android Device',
          type: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        }
      });

      const { user, accessToken, refreshToken } = response.data;

      await AsyncStorage.setItem("accessToken", accessToken);
      await AsyncStorage.setItem("refreshToken", refreshToken);

      setAuth(user, accessToken, refreshToken);
    } catch (err: any) {
      console.error("Login failed", err.response?.data?.message || err.message);
      setError(err.response?.data?.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      label: "Sign In",
      onPress: () => {},
      isActive: true,
    },
    {
      label: "Create Account",
      onPress: () => navigation.navigate("Register"),
      isActive: false,
    },
  ];

  return (
    <Screen
      style={{ flex: 1 }}
      title=""
      rightAction={
        <Text style={[typography.h4, { color: colors.primary }]}>Akademi</Text>
      }
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.centerTop}>
          <Text style={[typography.h2, { color: colors.primary }]}>AKADEMI</Text>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Welcome back</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 8 }]}>
            Continue your academic journey with AI precision.
          </Text>
        </View>

        {error && (
          <View style={[styles.errorBanner, { borderColor: colors.error }]}>
            <Text style={[typography.bodySmall, { color: colors.error, fontWeight: "500" }]}>
              {error}
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <Input
            label="Institutional Email"
            placeholder="name@university.edu.ng"
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            keyboardType="email-address"
          />

          <View style={styles.passwordLabelRow}>
            <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword", { email: form.email })}>
              <Text style={[typography.bodySmall, { color: colors.primary, fontWeight: "500" }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </View>
          <Input
            label="Password"
            placeholder="Enter your password"
            value={form.password}
            onChangeText={(text) => setForm({ ...form, password: text })}
            secureTextEntry
          />

          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.signInButton}
          />
        </View>

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[typography.mono, { color: colors.textMuted, marginHorizontal: 16 }]}>
            OR CONTINUE WITH
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

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

        <TouchableOpacity
          onPress={() => navigation.navigate("Register")}
          style={styles.signUpLink}
        >
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            New to Akademi? <Text style={{ color: colors.primary, fontWeight: "700" }}>Create account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <TabSwitcher tabs={tabs} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 140,
    flexGrow: 1,
  },
  centerTop: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  form: {
    marginBottom: 32,
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 8,
  },
  signInButton: {
    marginTop: 8,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  dividerLine: {
    flexGrow: 1,
    height: 1,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  socialButton: {
    flexGrow: 1,
    height: 52,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
    borderWidth: 1,
  },
  googleIcon: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  signUpLink: {
    alignItems: "center",
    marginBottom: 20,
  },
});
