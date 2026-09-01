import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowRight, CheckSquare, LockKeyhole, Mail, Phone, Square, User } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const normalizePhoneForDisplay = (value: string) => value.replace(/[^+\d]/g, "");

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [form, setForm] = useState({ name: "", phoneNumber: "", email: "", password: "" });
  const [supportContactOptIn, setSupportContactOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    const name = form.name.trim();
    const phoneNumber = form.phoneNumber.trim();
    const email = form.email.trim().toLowerCase();

    if (!name || !phoneNumber || !email) {
      setError("Enter your name, phone number, and email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/register", { name, phoneNumber, email, password: form.password, supportContactOptIn });
      navigation.navigate("EmailVerification", { email });
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "We couldn't create your account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen hideHeader style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>AKADEMI</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")} accessibilityRole="button"><Text style={styles.signIn}>Sign in</Text></TouchableOpacity>
        </View>
        <View style={styles.heroPanel}>
          <View style={styles.heroCopy}><Text style={styles.headline}>Create your account</Text><Text style={styles.subtext}>Start exploring Akademi in less than a minute.</Text></View>
        </View>
        <View style={styles.formPanel}>
          {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
          <Input label="Full Name" placeholder="Enter your full name" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} leftIcon={<User size={18} color={colors.textMuted} />} />
          <Input label="Phone Number" placeholder="08012345678" value={form.phoneNumber} onChangeText={(phoneNumber) => setForm((current) => ({ ...current, phoneNumber: normalizePhoneForDisplay(phoneNumber) }))} keyboardType="phone-pad" leftIcon={<Phone size={18} color={colors.textMuted} />} />
          <Input label="Email Address" placeholder="name@example.com" value={form.email} onChangeText={(email) => setForm((current) => ({ ...current, email }))} keyboardType="email-address" autoCapitalize="none" leftIcon={<Mail size={18} color={colors.textMuted} />} />
          <Input label="Password" placeholder="At least 8 characters" value={form.password} onChangeText={(password) => setForm((current) => ({ ...current, password }))} secureTextEntry leftIcon={<LockKeyhole size={18} color={colors.textMuted} />} />
          <TouchableOpacity style={styles.consentRow} onPress={() => setSupportContactOptIn((current) => !current)} accessibilityRole="checkbox" accessibilityState={{ checked: supportContactOptIn }}>
            {supportContactOptIn ? <CheckSquare size={20} color={colors.primary} /> : <Square size={20} color={colors.textMuted} />}
            <Text style={styles.consentText}>Akademi support may contact me to help me get started.</Text>
          </TouchableOpacity>
          <Text style={styles.termsText}>By continuing, you agree to Akademi's <Text style={styles.linkText} onPress={() => navigation.navigate("PrivacyData")}>Terms</Text> and <Text style={styles.linkText} onPress={() => navigation.navigate("PrivacyData")}>Privacy Policy</Text>.</Text>
          <Button label="Create Account" onPress={handleRegister} loading={loading} disabled={loading} style={styles.createButton} icon={<ArrowRight size={18} color="#FFFFFF" />} />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 }, container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  topRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }, brand: { ...typography.label, color: colors.textPrimary, fontWeight: "800", letterSpacing: 1.2 }, signIn: { ...typography.bodySmall, color: colors.primary, fontWeight: "700" },
  heroPanel: { backgroundColor: "#101412", borderColor: "#1D3528", borderRadius: 28, borderWidth: 1, marginBottom: 16, minHeight: 168, overflow: "hidden", padding: 22 }, heroCopy: { maxWidth: "100%" }, headline: { ...typography.h1, color: "#FFFFFF", fontSize: 30, lineHeight: 36 }, subtext: { ...typography.body, color: colors.textSecondary, lineHeight: 20, marginTop: 8 },
  formPanel: { backgroundColor: "#050505", borderColor: "#1F1F1F", borderRadius: 28, borderWidth: 1, padding: 18 }, errorBanner: { backgroundColor: "rgba(239,68,68,0.12)", borderColor: colors.error, borderRadius: 12, borderWidth: 1, marginBottom: 14, padding: 12 }, errorText: { ...typography.bodySmall, color: colors.error, lineHeight: 18 },
  consentRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, marginBottom: 18, marginTop: 2 }, consentText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 19 }, termsText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 19, marginBottom: 18, textAlign: "center" }, linkText: { color: colors.primary, fontWeight: "700" }, createButton: { borderRadius: 999, height: 52 },
});
