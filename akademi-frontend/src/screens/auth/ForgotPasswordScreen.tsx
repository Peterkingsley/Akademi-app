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
import { RefreshCw, Info, Mail } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
    },
  });

  const onReset = async (data: { email: string }) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.post("/auth/forgot-password", {
        email: data.email,
      });
      setSuccessMessage("Reset link sent. Check your inbox.");
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message || "Failed to send reset link. Please try again."
      );
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
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <RefreshCw size={24} color={colors.primary} />
            </View>
          </View>

          <Text style={styles.headline}>Reset your password</Text>
          <Text style={styles.subtext}>
            Enter your email and we'll send you a reset link.
          </Text>

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
                label="Email Address"
                placeholder="name@university.edu"
                value={value}
                onChangeText={onChange}
                keyboardType="email-address"
                leftIcon={<Mail size={20} color={colors.textSecondary} />}
                error={errors.email?.message}
              />
            )}
            name="email"
          />

          <View style={styles.noticeBanner}>
            <Info size={18} color={colors.primary} />
            <Text style={styles.noticeText}>
              SYSTEM_NOTICE: ENSURE ACCESS TO YOUR REGISTERED INSTITUTIONAL EMAIL FOR FASTER VERIFICATION.
            </Text>
          </View>

          {successMessage && (
            <Text style={styles.successText}>{successMessage}</Text>
          )}
          {errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          <View style={styles.techTextContainer}>
            <Text style={styles.techText}>
              010101 RECOVER_SEQ_INITIATED // AUTH_KEY_GENERATION // SYNC_LIBRARY_ACCESS // 010101
            </Text>
          </View>

          <Button
            label="Send Reset Link"
            onPress={handleSubmit(onReset)}
            loading={isLoading}
            style={styles.resetButton}
          />

          <TouchableOpacity
            style={styles.footer}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.footerText}>
              Remembered your password? <Text style={styles.linkText}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 40,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconBackground: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0D1526",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 32,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    marginTop: 12,
    marginBottom: 32,
    lineHeight: 24,
  },
  noticeBanner: {
    flexDirection: "row",
    backgroundColor: "#0D1526",
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeText: {
    color: colors.textSecondary,
    fontFamily: "SpaceMono-Regular",
    fontSize: 11,
    marginLeft: 12,
    flex: 1,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  techTextContainer: {
    marginTop: 60,
    marginBottom: 12,
    alignItems: "center",
  },
  techText: {
    color: "#1F2937",
    fontFamily: "SpaceMono-Regular",
    fontSize: 10,
    textAlign: "center",
  },
  resetButton: {
    marginTop: 8,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
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
});
