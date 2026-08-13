import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { useNavigation } from "@react-navigation/native";
import { Mail, MessageCircle, FileText, ExternalLink, HelpCircle } from "lucide-react-native";

export const HelpSupportScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@akademi.app?subject=Support Request");
  };

  const handleWhatsApp = () => {
    Linking.openURL("whatsapp://send?phone=2348000000000&text=Hi Akademi Support, I need help with...");
  };

  return (
    <Screen style={{ flex: 1 }} title="Help & Support" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.container}>
        <LinearGradient
          colors={["#0B1E12", "#04110A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroIcon}>
            <HelpCircle size={26} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroSubtitle}>We're here to assist with your account, materials, and study tools</Text>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DIRECT SUPPORT</Text>
          <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={handleContactSupport}>
            <View style={styles.iconCircle}>
              <Mail size={19} color={colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Email Support</Text>
              <Text style={styles.cardSub}>Responds within 24 hours (support@akademi.app)</Text>
            </View>
            <ExternalLink size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={handleWhatsApp}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(37,211,102,0.15)" }]}>
              <MessageCircle size={19} color="#25D366" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>WhatsApp Support</Text>
              <Text style={styles.cardSub}>Fast response for urgent academic issues</Text>
            </View>
            <ExternalLink size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LEGAL & RESOURCES</Text>
          <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => navigation.navigate("PrivacyData")}>
            <View style={styles.iconCircle}>
              <FileText size={19} color={colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Privacy Policy & Terms</Text>
              <Text style={styles.cardSub}>Read our student data & service guidelines</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Button
          label="Visit Help Center"
          variant="secondary"
          onPress={() => Linking.openURL("https://help.akademi.app")}
          style={styles.button}
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 40,
  },
  heroCard: {
    alignItems: "center",
    borderColor: "rgba(34,197,94,0.25)",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    padding: 20,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    marginBottom: 12,
    width: 48,
  },
  heroTitle: { ...typography.h3, color: colors.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" },
  heroSubtitle: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4, textAlign: "center" },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
    marginBottom: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(34,197,94,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  button: {
    marginTop: 8,
  },
});
