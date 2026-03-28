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
import { Apple, Eye, EyeOff } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { getErrorMessage } from "../../utils/error-handler";

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      // Navigation to MainStack will be handled by RootNavigator based on isAuthenticated
    } catch (err: any) {
      const message = getErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={{ flex: 1 }}
      onBack={() => navigation.goBack()}
      title=""
      rightAction={
        <Text style={styles.headerTitle}>Akademi</Text>
      }
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.centerTop}>
          <Text style={styles.wordmark}>Akademi</Text>
        </View>

        <Text style={styles.headline}>Welcome back 👋</Text>
        <Text style={styles.subtext}>Sign in to continue learning</Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Input
            label="EMAIL ADDRESS"
            labelStyle={styles.spaceMonoLabel}
            placeholder="name@example.com"
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            keyboardType="email-address"
            style={styles.input}
          />

          <View style={styles.passwordLabelRow}>
            <Text style={[styles.label, styles.spaceMonoLabel]}>PASSWORD</Text>
            <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword", { email: form.email })}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
          <Input
            label=""
            placeholder="••••••••"
            value={form.password}
            onChangeText={(text) => setForm({ ...form, password: text })}
            secureTextEntry={!showPassword}
            style={styles.input}
          />

          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.signInButton}
          />
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialButton}>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.socialButtonText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton}>
            <Apple size={20} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.socialButtonText}>Apple</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("Register")}
          style={styles.signUpLink}
        >
          <Text style={styles.signUpText}>
            New to Akademi? <Text style={styles.linkText}>Create account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.tabSwitcher}>
        <TouchableOpacity style={[styles.tabItem, styles.tabItemActive]}>
          <Text style={styles.tabTextActive}>Sign In</Text>
          <View style={styles.tabIndicator} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation.navigate("Register")}
        >
          <Text style={styles.tabTextInactive}>Create Account</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 100,
    flexGrow: 1,
  },
  centerTop: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  wordmark: {
    color: colors.primary,
    fontSize: 18,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
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
  },
  form: {
    marginBottom: 32,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 8.25,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  spaceMonoLabel: {
    fontFamily: "SpaceMono-Regular",
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 9.75,
    fontFamily: "Inter-Medium",
    marginBottom: 8,
  },
  input: {
    marginBottom: 20,
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
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 8.25,
    fontFamily: "SpaceMono-Regular",
    marginHorizontal: 16,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  socialButton: {
    flexGrow: 1,
    height: 52,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleIcon: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
    marginRight: 8,
  },
  socialButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    marginLeft: 8,
  },
  signUpLink: {
    alignItems: "center",
    marginBottom: 20,
  },
  signUpText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontFamily: "Inter-Regular",
  },
  linkText: {
    color: colors.primary,
    fontFamily: "Inter-Bold",
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
    flexGrow: 1,
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
  tabIndicator: {
    position: "absolute",
    top: 0,
    width: 40,
    height: 2,
    backgroundColor: colors.primary,
  },
});
