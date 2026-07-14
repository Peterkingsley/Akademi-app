import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import api from "../../services/api";

export const EmailVerificationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const email: string | undefined = route.params?.email;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(45);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const inputs = useRef<TextInput[]>([]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(countdown);
  }, []);

  const handleChange = (text: string, index: number) => {
    const digitsOnly = text.replace(/[^0-9]/g, "");
    setError(null);

    if (digitsOnly.length > 1) {
      // Pasted or autofilled code — distribute digits across the remaining boxes.
      const newCode = [...code];
      let cursor = index;
      for (const digit of digitsOnly) {
        if (cursor > 5) break;
        newCode[cursor] = digit;
        cursor++;
      }
      setCode(newCode);
      if (newCode.every((digit) => digit !== "")) {
        Keyboard.dismiss();
      } else {
        inputs.current[Math.min(cursor, 5)]?.focus();
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = digitsOnly;
    setCode(newCode);

    if (digitsOnly && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (newCode.every((digit) => digit !== "")) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = code.join("");
    if (otpCode.length !== 6 || !email) return;

    setLoading(true);
    setError(null);
    try {
      const response = await api.post("/auth/verify-email", {
        email,
        token: otpCode,
        deviceInfo: {
          name: Platform.OS === "ios" ? "iPhone" : "Android Device",
          type: Platform.OS === "ios" ? "IOS" : "ANDROID",
        },
      });

      const { user, accessToken, refreshToken, adminAccessToken } = response.data;
      navigation.navigate("SetupComplete", { user, accessToken, refreshToken, adminAccessToken });
    } catch (err: any) {
      setError(err.response?.data?.message || "That code didn't work. Check it and try again.");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || resending || !email) return;

    setResending(true);
    setResendStatus(null);
    try {
      await api.post("/auth/resend-verification", { email });
      setTimer(45);
      setResendStatus({ type: "success", message: "Code sent. Check your inbox." });
    } catch (err: any) {
      setResendStatus({
        type: "error",
        message: err.response?.data?.message || "Couldn't resend the code. Try again.",
      });
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <Screen scrollable style={{ flex: 1 }} onBack={() => navigation.goBack()} title="Akademi">
        <View style={styles.container}>
          <Text style={styles.headline}>Something went wrong</Text>
          <Text style={styles.body}>
            We couldn't find the email address to verify. Please go back and try signing up again.
          </Text>
          <Button
            label="Go back"
            onPress={() => navigation.goBack()}
            style={styles.verifyButton}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable style={{ flex: 1 }}
      onBack={() => navigation.goBack()}
      title="Akademi"
    >
      <View style={styles.container}>
        <Text style={styles.headline}>Check your email</Text>
        <Text style={styles.body}>
          We sent a 6-digit code to <Text style={{ color: colors.primary }}>{email}</Text>. Enter it below to verify your account.
        </Text>

        {error ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.otpContainer}>
          {code.map((digit, index) => (
            <View key={index} style={[
              styles.otpBox,
              digit !== "" && styles.otpBoxFilled,
              error && styles.otpBoxError,
            ]}>
              <TextInput
                ref={(ref) => (inputs.current[index] = ref as TextInput)}
                style={styles.otpInput}
                maxLength={6}
                keyboardType="number-pad"
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                selectionColor={colors.primary}
                autoComplete={index === 0 ? "one-time-code" : "off"}
                textContentType="oneTimeCode"
                accessibilityLabel={`Digit ${index + 1} of 6`}
              />
            </View>
          ))}
        </View>

        <Button
          label="Verify Code"
          onPress={handleVerify}
          loading={loading}
          disabled={code.some(digit => digit === "")}
          style={styles.verifyButton}
        />

        <View style={styles.resendSection}>
          <Text style={styles.resendText}>Didn't get it?</Text>
          <TouchableOpacity
            onPress={handleResend}
            disabled={timer > 0 || resending}
            accessibilityRole="button"
            accessibilityLabel="Resend verification code"
          >
            <Text style={[styles.resendLink, (timer > 0 || resending) && styles.resendDisabled]}>
              {resending ? "Sending..." : "Resend code"} {timer > 0 && <Text style={styles.timer}>0:{timer < 10 ? `0${timer}` : timer}</Text>}
            </Text>
          </TouchableOpacity>
          {resendStatus ? (
            <Text style={[styles.resendStatusText, resendStatus.type === "error" && styles.resendStatusError]}>
              {resendStatus.message}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.changeEmail}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Change email address"
          >
            <Text style={styles.changeEmailText}>Change email address</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24, paddingBottom: 100,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 24,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    marginTop: 20,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter-Regular",
    marginTop: 12,
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: colors.error,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    lineHeight: 18,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
    marginBottom: 40,
  },
  otpBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    width: 48,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
  },
  otpBoxError: {
    borderColor: colors.error,
  },
  otpInput: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: "Inter-Bold",
    textAlign: "center",
    width: "100%",
  },
  verifyButton: {
    marginBottom: 32,
  },
  resendSection: {
    alignItems: "center",
  },
  resendText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginBottom: 8,
  },
  resendLink: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: "Inter-Bold",
  },
  resendDisabled: {
    color: colors.textSecondary,
  },
  resendStatusText: {
    color: colors.success,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginTop: 8,
    textAlign: "center",
  },
  resendStatusError: {
    color: colors.error,
  },
  timer: {
    color: colors.primary,
    fontFamily: "SpaceMono-Regular",
  },
  changeEmail: {
    marginTop: 16,
  },
  changeEmailText: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: "Inter-Regular",
  },
});
