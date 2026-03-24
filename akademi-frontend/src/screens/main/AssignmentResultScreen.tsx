import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { ArrowLeft, Share2, Bookmark, RefreshCw, Book } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { useNavigation } from "@react-navigation/native";

export const AssignmentResultScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, typography.h3]}>Assignment Result</Text>
        </View>
        <Badge label="Direct Answer" variant="blue" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.inquiryCard}>
          <Text style={[styles.monoLabel, typography.mono]}>YOUR INQUIRY</Text>
          <Text style={[styles.questionText, typography.bodySmall]}>
            Calculate the total impedance of a circuit with a 50Ω resistor and a 100mH inductor at 60Hz.
          </Text>
        </Card>

        <Card style={styles.aiResponseCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiProfile}>
              <Avatar size={32} name="Akademi Synthesis" />
              <View style={styles.aiNameContainer}>
                <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700" }]}>Akademi Synthesis</Text>
                <Text style={[styles.aiModel, typography.caption]}>v2.4 Technical Model</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.headline, typography.h2]}>Total Impedance: 62.6Ω at 37.0°</Text>

          <Text style={[styles.explanation, typography.bodySmall]}>
            To find the total impedance (Z) in an RL circuit, we must first calculate the inductive reactance (X_L) and then combine it with the resistance (R) using phasor addition.
          </Text>

          <View style={styles.step}>
            <Text style={[styles.stepNumber, typography.mono]}>01.</Text>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, typography.bodySmall, { fontWeight: "700" }]}>Calculate Inductive Reactance</Text>
              <View style={styles.codeBlock}>
                <Text style={[styles.codeText, typography.mono]}>X_L = 2 * π * f * L</Text>
                <Text style={[styles.codeText, typography.mono]}>X_L = 2 * 3.14159 * 60 * 0.1</Text>
                <Text style={[styles.codeText, typography.mono]}>X_L ≈ 37.7Ω</Text>
              </View>
            </View>
          </View>

          <View style={styles.step}>
            <Text style={[styles.stepNumber, typography.mono]}>02.</Text>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, typography.bodySmall, { fontWeight: "700" }]}>Calculate Total Impedance Magnitude</Text>
              <View style={styles.codeBlock}>
                <Text style={[styles.codeText, typography.mono]}>Z| = sqrt(R^2 + X_L^2)</Text>
                <Text style={[styles.codeText, typography.mono]}>Z| = sqrt(50^2 + 37.7^2)</Text>
                <Text style={[styles.codeText, typography.mono]}>Z| ≈ 62.6Ω</Text>
              </View>
            </View>
          </View>

          <View style={styles.conceptInsight}>
            <Text style={[styles.monoLabel, typography.mono, { color: colors.accentPurple }]}>CONCEPT INSIGHT</Text>
            <Text style={[styles.insightText, typography.bodySmall]}>
              Impedance is a vector quantity. The resistor contributes to the real part, while the inductor contributes to the imaginary part (reactance).
            </Text>
          </View>
        </Card>

        <TouchableOpacity
          style={styles.studyModeBanner}
          onPress={() => navigation.navigate("StudyMode")}
        >
          <View style={styles.bannerLeft}>
            <Book size={24} color={colors.warning} />
            <View style={styles.bannerTextContainer}>
              <Text style={[styles.bannerTitle, typography.bodySmall, { fontWeight: "700" }]}>Want to truly understand this?</Text>
              <Text style={[styles.bannerSubtext, typography.caption]}>Switch to Study Mode for a step-by-step Socratic walkthrough.</Text>
            </View>
          </View>
          <Text style={styles.bannerArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn}>
            <Share2 size={20} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, typography.caption]}>SHARE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Bookmark size={20} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, typography.caption]}>SAVE</Text>
          </TouchableOpacity>
          <Button
            label="Try Another"
            onPress={() => navigation.navigate("Solve")}
            icon={<RefreshCw size={18} color="#FFFFFF" />}
            style={styles.tryAnotherBtn}
          />
        </View>
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
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  inquiryCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: "transparent",
    marginBottom: 24,
    paddingVertical: 12,
  },
  monoLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
  },
  questionText: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  aiResponseCard: {
    backgroundColor: colors.surface,
    padding: 20,
    marginBottom: 24,
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  aiProfile: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiNameContainer: {
    marginLeft: 12,
  },
  aiName: {
    color: "#FFFFFF",
  },
  aiModel: {
    color: colors.textMuted,
  },
  headline: {
    color: colors.primary,
    marginBottom: 16,
  },
  explanation: {
    color: "#FFFFFF",
    lineHeight: 24,
    marginBottom: 24,
  },
  step: {
    flexDirection: "row",
    marginBottom: 20,
  },
  stepNumber: {
    color: colors.textMuted,
    marginRight: 12,
    marginTop: 4,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: "#FFFFFF",
    marginBottom: 12,
  },
  codeBlock: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
  },
  codeText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 20,
  },
  conceptInsight: {
    backgroundColor: "#0D1526",
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentPurple,
    marginTop: 8,
  },
  insightText: {
    color: "#FFFFFF",
    lineHeight: 20,
  },
  studyModeBanner: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 32,
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  bannerTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  bannerTitle: {
    color: "#FFFFFF",
  },
  bannerSubtext: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  bannerArrow: {
    color: colors.primary,
    fontSize: 20,
    marginLeft: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actionBtn: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  actionLabel: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  tryAnotherBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
  },
});
