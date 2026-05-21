import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { useNavigation } from "@react-navigation/native";
import { Mail, MessageCircle, FileText, ExternalLink } from "lucide-react-native";

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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTACT US</Text>
          <TouchableOpacity style={styles.card} onPress={handleContactSupport}>
            <View style={styles.iconCircle}>
              <Mail size={20} color={colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Email Support</Text>
              <Text style={styles.cardSub}>Typically responds within 24 hours</Text>
            </View>
            <ExternalLink size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={handleWhatsApp}>
            <View style={[styles.iconCircle, { backgroundColor: "#25D36620" }]}>
              <MessageCircle size={20} color="#25D366" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>WhatsApp Chat</Text>
              <Text style={styles.cardSub}>Quick help for urgent issues</Text>
            </View>
            <ExternalLink size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESOURCES</Text>
          <TouchableOpacity style={styles.card}>
            <View style={styles.iconCircle}>
              <FileText size={20} color={colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
              <Text style={styles.cardSub}>Common questions and answers</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("PrivacyData")}>
            <View style={styles.iconCircle}>
              <FileText size={20} color={colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Terms of Service</Text>
              <Text style={styles.cardSub}>Read our legal guidelines</Text>
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
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
    marginBottom: 16,
    letterSpacing: 1,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
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
