import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { X, Book, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { useNavigation } from "@react-navigation/native";

export const StudyModeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const options = [
    { id: "A", text: "Reactance increases with frequency" },
    { id: "B", text: "Reactance decreases with frequency" },
    { id: "C", text: "Reactance remains constant" },
  ];

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.h3]}>Assignment Analysis</Text>
        <Badge label="Study Reply" variant="purple" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.headline, typography.h2]}>RL Circuit Impedance</Text>
        <Text style={[styles.intro, typography.bodySmall]}>
          I've broken down the core concept of impedance calculation to help you master the underlying physics...
        </Text>

        <View style={styles.step}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={[styles.stepBadgeText, typography.mono]}>STEP 1</Text>
            </View>
            <Text style={[styles.stepTitle, typography.h3]}>The Component Vectors</Text>
          </View>
          <Text style={[styles.stepDesc, typography.bodySmall]}>
            Understand that Resistance (R) and Inductive Reactance (X_L) act at 90 degrees to each other.
          </Text>
          <View style={styles.codeBlock}>
            <Text style={[styles.codeText, typography.mono]}>R = 50Ω (Real axis)</Text>
            <Text style={[styles.codeText, typography.mono]}>X_L = j37.7Ω (Imaginary axis)</Text>
          </View>
        </View>

        <View style={styles.checkSection}>
          <View style={styles.checkHeader}>
            <Book size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={[styles.checkTitle, typography.h3]}>Check your understanding</Text>
          </View>
          <Card style={styles.mcqCard}>
            <Text style={[styles.mcqQuestion, typography.bodySmall, { fontWeight: "700" }]}>
              Based on the formula X_L = 2πfL, how does inductive reactance change if the frequency (f) is doubled?
            </Text>
            <View style={styles.optionsList}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.optionPill,
                    selectedOption === opt.id && styles.selectedOption,
                  ]}
                  onPress={() => setSelectedOption(opt.id)}
                >
                  <Text style={[
                    styles.optionText,
                    typography.bodySmall,
                    { color: selectedOption === opt.id ? "#FFFFFF" : colors.textSecondary }
                  ]}>
                    {opt.text}
                  </Text>
                  {selectedOption === opt.id && <CheckCircle2 size={16} color={colors.success} />}
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        </View>

        <TouchableOpacity style={styles.tutorBanner}>
          <Avatar size={32} name="Scholar" />
          <View style={styles.tutorTextContainer}>
            <Text style={[styles.tutorText, typography.bodySmall]}>
              Still confused? Our scholars are online to help you 1-on-1.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("LiveTutorEntry")}>
              <Text style={[styles.tutorLink, typography.bodySmall]}>Ask the Live Tutor →</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <View style={styles.bottomBar}>
          <Button
            label="Back to Problem"
            variant="ghost"
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          />
          <Button
            label="Finish Study"
            onPress={() => navigation.navigate("Home")}
            style={styles.finishBtn}
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
    marginBottom: 32,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headline: {
    color: "#FFFFFF",
    fontSize: 28,
    marginBottom: 12,
  },
  intro: {
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  step: {
    marginBottom: 40,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  stepBadge: {
    backgroundColor: "#0D1526",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  stepBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },
  stepTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  stepDesc: {
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  codeBlock: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  codeText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 24,
  },
  checkSection: {
    marginBottom: 40,
  },
  checkHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  checkTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  mcqCard: {
    backgroundColor: colors.surfaceElevated,
    padding: 16,
  },
  mcqQuestion: {
    color: "#FFFFFF",
    lineHeight: 22,
    marginBottom: 20,
  },
  optionsList: {
    gap: 12,
  },
  optionPill: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedOption: {
    borderColor: colors.success,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  optionText: {
    fontWeight: "500",
  },
  tutorBanner: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 40,
  },
  tutorTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  tutorText: {
    color: "#FFFFFF",
    lineHeight: 20,
    marginBottom: 4,
  },
  tutorLink: {
    color: colors.primary,
    fontWeight: "600",
  },
  bottomBar: {
    flexDirection: "row",
    gap: 16,
  },
  backBtn: {
    flex: 1,
  },
  finishBtn: {
    flex: 2,
  },
});
