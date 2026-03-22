import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm, Controller } from "react-hook-form";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { university, faculty, department, level } = route.params || {};

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
    },
  });

  const password = watch("password", "");

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[0-9]/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;
    return strength;
  };

  const strength = getPasswordStrength(password);
  const strengthLabels = ["WEAK", "WEAK", "MEDIUM", "STRONG", "VERY STRONG"];

  const onRegister = async (data: any) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await api.post("/auth/register", {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        university,
        faculty,
        department,
        level,
      });
      navigation.navigate("EmailVerification", { email: data.email });
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || "Registration failed. Please try again.");
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
          <Text style={styles.headline}>Almost there!</Text>
          <Text style={styles.subtext}>Create your account to save your progress</Text>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={[styles.socialButton, styles.googleButton]}>
              <Text style={styles.googleButtonText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.socialButton, styles.appleButton]}>
              <Text style={styles.appleButtonText}>Apple</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <Controller
            control={control}
            rules={{ required: "Full name is required" }}
            render={({ field: { onChange, value } }) => (
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                value={value}
                onChangeText={onChange}
                error={errors.name?.message}
              />
            )}
            name="name"
          />

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
                label="Email address"
                placeholder="name@example.com"
                value={value}
                onChangeText={onChange}
                keyboardType="email-address"
                error={errors.email?.message}
              />
            )}
            name="email"
          />

          <Controller
            control={control}
            rules={{
              required: "Password is required",
              minLength: { value: 8, message: "Minimum 8 characters" },
            }}
            render={({ field: { onChange, value } }) => (
              <View>
                <Input
                  label="Password"
                  placeholder="Min. 8 characters"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry
                  error={errors.password?.message}
                />
                <View style={styles.strengthBarContainer}>
                  {[1, 2, 3, 4].map((index) => (
                    <View
                      key={index}
                      style={[
                        styles.strengthSegment,
                        index <= strength && {
                          backgroundColor:
                            strength <= 1
                              ? colors.error
                              : strength <= 2
                              ? colors.warning
                              : colors.success,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.strengthLabel}>
                  PASSWORD STRENGTH: {strengthLabels[strength]}
                </Text>
              </View>
            )}
            name="password"
          />

          <Controller
            control={control}
            render={({ field: { onChange, value } }) => (
              <View style={styles.phoneInputContainer}>
                <View style={styles.phoneLabelRow}>
                  <Text style={[styles.phoneLabel, typography.caption]}>Phone number</Text>
                  <Text style={styles.optionalTag}>OPTIONAL</Text>
                </View>
                <Input
                  label=""
                  placeholder="+234 000 000 0000"
                  value={value}
                  onChangeText={onChange}
                  keyboardType="phone-pad"
                  style={{ marginBottom: 0 }}
                />
              </View>
            )}
            name="phone"
          />

          <Text style={styles.termsText}>
            By continuing, you agree to our{" "}
            <Text style={styles.linkText}>Terms of Service</Text> and{" "}
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Text>

          {errorMessage && <Text style={styles.errorBanner}>{errorMessage}</Text>}

          <Button
            label="Create Account"
            onPress={handleSubmit(onRegister)}
            loading={isLoading}
            style={styles.createButton}
          />

          <TouchableOpacity
            style={styles.footer}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.footerText}>
              Already have an account? <Text style={styles.linkText}>Sign in instead</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.tabText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, styles.activeTab]}>
          <Text style={[styles.tabText, styles.activeTabText]}>Create Account</Text>
          <View style={styles.activeTabIndicator} />
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
    marginBottom: 32,
  },
  socialButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    height: 52,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },
  googleButtonText: {
    color: "#000000",
    fontWeight: "600",
  },
  appleButton: {
    backgroundColor: "#000000",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
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
  strengthBarContainer: {
    flexDirection: "row",
    marginTop: -10,
    marginBottom: 8,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    marginRight: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
    marginBottom: 20,
  },
  phoneInputContainer: {
    marginBottom: 20,
  },
  phoneLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  phoneLabel: {
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  optionalTag: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter-Bold",
  },
  termsText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
  },
  linkText: {
    color: colors.primary,
    fontWeight: "600",
  },
  errorBanner: {
    color: colors.error,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    textAlign: "center",
  },
  createButton: {
    marginTop: 24,
  },
  footer: {
    marginTop: 24,
    alignItems: "center",
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
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
