import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { X, Search, CheckCircle2, XCircle, Settings, Sparkles } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useNavigation } from "@react-navigation/native";

export const ChallengeResultScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar size={32} name="Akademi" />
          <Text style={[styles.headerTitle, typography.bodySmall, { fontWeight: "700" }]}>Akademi</Text>
        </View>
        <TouchableOpacity style={styles.searchBtn}>
          <Search size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.badgeContainer}>
          <Badge label="⚠ CHALLENGE" variant="warning" style={styles.challengeBadge} />
        </View>

        <Text style={[styles.title, typography.h2]}>Challenge Result</Text>
        <Text style={[styles.subtitle, typography.bodySmall]}>Neural Analysis of your last submission</Text>

        <Card style={StyleSheet.flatten([styles.resultCard, { borderLeftColor: colors.success }])}>
          <View style={styles.cardHeader}>
            <CheckCircle2 size={24} color={colors.success} style={styles.cardIcon} />
            <Text style={[styles.cardTitle, typography.bodySmall, { fontWeight: "700" }]}>What you got right</Text>
          </View>
          <Text style={[styles.cardText, typography.bodySmall]}>
            You correctly identified the phase shift relationship between voltage and current in an inductive load.
          </Text>
        </Card>

        <Card style={StyleSheet.flatten([styles.resultCard, { borderLeftColor: colors.error }])}>
          <View style={styles.cardHeader}>
            <XCircle size={24} color={colors.error} style={styles.cardIcon} />
            <Text style={[styles.cardTitle, typography.bodySmall, { fontWeight: "700" }]}>Where you went wrong</Text>
          </View>
          <Text style={[styles.cardText, typography.bodySmall]}>
            You added R and X_L algebraically (R + X_L) instead of using the phasor sum.
          </Text>
          <View style={styles.codeBlock}>
            <Text style={[styles.codeText, typography.mono]}>// Your submission</Text>
            <Text style={[styles.codeText, typography.mono, { color: colors.error }]}>Z = 50 + 37.7 = 87.7Ω</Text>
          </View>
        </Card>

        <Card style={StyleSheet.flatten([styles.resultCard, { borderLeftColor: colors.primary }])}>
          <View style={styles.cardHeader}>
            <Settings size={24} color={colors.primary} style={styles.cardIcon} />
            <Text style={[styles.cardTitle, typography.bodySmall, { fontWeight: "700" }]}>The correct approach</Text>
          </View>
          <Text style={[styles.cardText, typography.bodySmall]}>
            Use the Pythagorean formula for series circuit impedance.
          </Text>
          <View style={styles.codeBlock}>
            <Text style={[styles.codeText, typography.mono]}>// Correct approach</Text>
            <Text style={[styles.codeText, typography.mono, { color: colors.success }]}>Z = sqrt(R^2 + X_L^2)</Text>
            <Text style={[styles.codeText, typography.mono, { color: colors.success }]}>Z = 62.6Ω</Text>
          </View>
        </Card>

        <View style={styles.rememberBanner}>
          <View style={styles.rememberHeader}>
            <Sparkles size={20} color={colors.warning} style={styles.sparkleIcon} />
            <Text style={[styles.rememberLabel, typography.mono]}>REMEMBER THIS</Text>
          </View>
          <Text style={[styles.rememberText, typography.bodySmall]}>
            "Reactance is resistance to AC current caused by electric or magnetic fields, and it always acts perpendicularly to standard DC resistance."
          </Text>
          <View style={styles.tagPills}>
            <View style={styles.tagPill}>
              <Text style={[styles.tagText, typography.mono]}>BITWISE-SAFETY</Text>
            </View>
            <View style={styles.tagPill}>
              <Text style={[styles.tagText, typography.mono]}>ALGO-CHALLENGE</Text>
            </View>
          </View>
        </View>

        <Button
          label="Review Step-by-Step"
          onPress={() => navigation.navigate("StudyMode")}
          style={styles.reviewBtn}
        />
        <Button
          label="Back to Library"
          variant="secondary"
          onPress={() => navigation.navigate("Library")}
          style={styles.libraryBtn}
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    marginLeft: 12,
  },
  searchBtn: {
    padding: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  badgeContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  challengeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
  },
  resultCard: {
    backgroundColor: colors.surfaceElevated,
    marginBottom: 16,
    padding: 16,
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardIcon: {
    marginRight: 12,
  },
  cardTitle: {
    color: "#FFFFFF",
  },
  cardText: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  codeBlock: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  codeText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 20,
  },
  rememberBanner: {
    backgroundColor: "#1C1A10",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: 16,
    marginBottom: 32,
  },
  rememberHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sparkleIcon: {
    marginRight: 8,
  },
  rememberLabel: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "700",
  },
  rememberText: {
    color: "#FFFFFF",
    lineHeight: 20,
    marginBottom: 16,
    fontStyle: "italic",
  },
  tagPills: {
    flexDirection: "row",
    gap: 8,
  },
  tagPill: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    color: colors.textMuted,
    fontSize: 9,
  },
  reviewBtn: {
    marginBottom: 12,
  },
  libraryBtn: {
    backgroundColor: colors.surfaceElevated,
  },
});
