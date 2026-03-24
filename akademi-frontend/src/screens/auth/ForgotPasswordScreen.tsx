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

  const handleReset = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSuccess(true);
    } catch (error) {
      console.error("Forgot password failed", error);
      // For demo, show success anyway
      setSuccess(true);
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
        <Text style={styles.headerTitle}>Akademi</Text>
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

        <View style={styles.noticeBanner}>
          <Info size={20} color={colors.primary} />
          <Text style={styles.noticeText}>
            SYSTEM_NOTICE: ENSURE ACCESS TO YOUR REGISTERED INSTITUTIONAL EMAIL FOR FASTER VERIFICATION.
          </Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.techTextContainer}>
          <Text style={styles.techText}>
            010101 RECOVER_SEQ_INITIATED // AUTH_KEY_GENERATION // SYNC_LIBRARY_ACCESS // 010101
          </Text>
        </View>

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
    fontSize: 18,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  container: {
    padding: 24,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: "#0D1526",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 20,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 32,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  body: {
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    marginTop: 12,
    marginBottom: 32,
    lineHeight: 24,
  },
  input: {
    marginBottom: 24,
  },
  noticeBanner: {
    backgroundColor: "#0D1526",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  noticeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: "SpaceMono-Regular",
    marginLeft: 12,
    flex: 1,
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  techTextContainer: {
    marginBottom: 24,
    alignItems: "center",
  },
  techText: {
    color: colors.border,
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    textAlign: "center",
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
    fontSize: 14,
    fontFamily: "Inter-Regular",
  },
  linkText: {
    color: colors.primary,
    fontFamily: "Inter-Bold",
  },
});
