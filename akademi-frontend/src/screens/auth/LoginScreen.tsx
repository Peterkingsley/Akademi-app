import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useForm, Controller } from "react-hook-form";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { AlertCircle } from "lucide-react-native";

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onLogin = async (data: any) => {
    setIsLoading(true);
    setErrorMessage(null);
    setUnverifiedEmail(false);
    try {
      const response = await api.post("/auth/login", {
        email: data.email,
        password: data.password,
      });

      const { user, accessToken, refreshToken } = response.data;

      await AsyncStorage.setItem("accessToken", accessToken);
      await AsyncStorage.setItem("refreshToken", refreshToken);

      setAuth(user, accessToken, refreshToken);
      // RootNavigator will handle navigation to Main based on isAuthenticated state
    } catch (error: any) {
      if (error.response?.status === 403) {
        setUnverifiedEmail(true);
      } else {
        setErrorMessage(
          error.response?.data?.message || "Invalid credentials. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen onBack={() => navigation.goBack()} title="Akademi">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>Akademi</Text>
            <Text style={styles.headline}>Welcome back 👋</Text>
            <Text style={styles.subtext}>Sign in to continue learning</Text>
          </View>

          {unverifiedEmail && (
            <View style={styles.unverifiedBanner}>
              <AlertCircle size={20} color={colors.warning} />
              <Text style={styles.unverifiedText}>
                Please verify your email first. Check your inbox.
              </Text>
            </View>
          )}

          <Controller
            control={control}
            rules={{
              required: "Email is required",
              pattern: {
                value: /\S+@\S+\.\S+/,
                message: "Invalid email format",
              },
            }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="EMAIL ADDRESS"
                placeholder="name@example.com"
                value={value}
                onChangeText={onChange}
                keyboardType="email-address"
                error={errors.email?.message}
                style={styles.input}
              />
            )}
            name="email"
          />

          <View style={styles.passwordHeader}>
            <Text style={[styles.passwordLabel, typography.caption]}>PASSWORD</Text>
            <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
              <Text style={styles.forgotPasswordLink}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
          <Controller
            control={control}
            rules={{ required: "Password is required" }}
            render={({ field: { onChange, value } }) => (
              <Input
                label=""
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                secureTextEntry
                error={errors.password?.message || errorMessage}
                style={styles.input}
              />
            )}
            name="password"
          />

          <Button
            label="Sign In"
            onPress={handleSubmit(onLogin)}
            loading={isLoading}
            style={styles.signInButton}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton}>
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Text style={styles.socialButtonText}>Apple</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.footer}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.footerText}>
              New to Akademi? <Text style={styles.linkText}>Create account</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.tabSwitcher}>
        <TouchableOpacity style={[styles.tab, styles.activeTab]}>
          <Text style={[styles.tabText, styles.activeTabText]}>Sign In</Text>
          <View style={styles.activeTabIndicator} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => navigation.navigate("Register")}
        >
          <Text style={styles.tabText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  wordmark: {
    color: colors.primary,
    fontSize: 24,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    marginBottom: 24,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 32,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter-Regular",
    marginTop: 8,
  },
  unverifiedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  unverifiedText: {
    color: colors.warning,
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  input: {
    marginBottom: 16,
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  passwordLabel: {
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  forgotPasswordLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  signInButton: {
    marginTop: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontFamily: "SpaceMono-Regular",
    fontSize: 11,
    paddingHorizontal: 16,
  },
  socialButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  socialButton: {
    flex: 1,
    height: 52,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  socialButtonText: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  footer: {
    marginTop: 32,
    alignItems: "center",
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: colors.primary,
    fontWeight: "600",
  },
  tabSwitcher: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: "row",
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  activeTab: {
    position: "relative",
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  activeTabText: {
    color: colors.primary,
  },
  activeTabIndicator: {
    position: "absolute",
    top: 0,
    width: "40%",
    height: 3,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
