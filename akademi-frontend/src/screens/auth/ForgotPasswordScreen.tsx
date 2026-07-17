import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowLeft, RefreshCw, Info, Mail } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { BrandWordmark } from "../../components/ui/BrandWordmark";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialEmail = route.params?.email || "";

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Couldn't send the reset link. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Screen style={{ flex: 1 }} onBack={() => navigation.goBack()} title="">
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Mail size={24} color={colors.primary} />
          </View>
          <Text style={styles.headline}>Check your inbox</Text>
          <Text style={styles.body}>
            We've sent a password reset link to <Text style={{ color: colors.primary }}>{email}</Text>.
          </Text>
          <Button
            label="Back to Sign In"
            onPress={() => navigation.navigate("Login")}
            style={styles.button}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ flex: 1 }}
      onBack={() => navigation.goBack()}
      title=""
      rightAction={
        <BrandWordmark style={styles.headerTitle} />
      }
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.iconContainer}>
          <RefreshCw size={24} color={colors.primary} />
        </View>

        <Text style={styles.headline}>Reset your password</Text>
        <Text style={styles.body}>Enter your email and we'll send you a reset link.</Text>

        <Input
          label="Email Address"
          placeholder="name@university.edu.ng"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          leftIcon={<Mail size={20} color={colors.textMuted} />}
          style={styles.input}
        />

        {error ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.noticeBanner}>
            <Info size={20} color={colors.primary} />
            <Text style={styles.noticeText}>
              Use the email address you registered with for the fastest verification.
            </Text>
          </View>
        )}

        <View style={styles.spacer} />

        <Button
          label="Send Reset Link"
          onPress={handleReset}
          loading={loading}
          disabled={!email}
          style={styles.button}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <Text style={styles.backLinkText}>
            Remembered your password? <Text style={styles.linkText}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    padding: 24, paddingBottom: 100,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 20,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 24,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  body: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginTop: 12,
    marginBottom: 32,
    lineHeight: 24,
  },
  input: {
    marginBottom: 24,
  },
  noticeBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  noticeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginLeft: 12,
    flex: 1,
  },
  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: colors.error,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    lineHeight: 18,
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  button: {
    marginBottom: 24,
  },
  backLink: {
    alignItems: "center",
    marginBottom: 40,
  },
  backLinkText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter-Regular",
  },
  linkText: {
    color: colors.primary,
    fontFamily: "Inter-Bold",
  },
});
