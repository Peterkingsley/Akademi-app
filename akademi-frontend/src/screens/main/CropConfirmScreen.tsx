import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { ArrowLeft, Check, X, GraduationCap, Zap, Search } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useNavigation, useRoute } from "@react-navigation/native";
import api from "../../services/api";

export const CropConfirmScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { imageUri } = route.params || {};

  const [strategy, setStrategy] = useState<"step" | "quick">("quick");
  const [loading, setLoading] = useState(false);

  const handleSolve = async () => {
    setLoading(true);
    try {
      // Simulate session creation and OCR
      const { data: session } = await api.post("/sessions", {
        sessionType: "ASSIGNMENT",
        replyMode: strategy === "quick" ? "DIRECT" : "STUDY",
        courseCode: "EEE 301",
      });

      // In a real app, we'd upload the image here
      // For this flow, we'll navigate to AIProcessing
      navigation.navigate("AIProcessing", {
        type: "assignment",
        sessionId: session.id,
        replyMode: strategy === "quick" ? "DIRECT" : "STUDY",
        imageUri: imageUri
      });
    } catch (error) {
      console.error("Failed to process image:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.h3]}>Crop & Confirm</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Camera")} style={styles.headerBtn}>
          <Text style={[styles.retakeText, typography.bodySmall]}>Retake</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageWrapper}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          <View style={styles.badgeOverlay}>
            <View style={styles.aiBadge}>
              <Text style={[styles.aiBadgeText, typography.mono]}>AI ADJUSTED</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.qualityPrompt, typography.h3]}>
          Is the question text clear and fully visible?
        </Text>

        <View style={styles.guidanceRow}>
          <Card style={styles.guidanceCard}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(34, 197, 94, 0.1)" }]}>
              <Check size={16} color={colors.success} />
            </View>
            <Text style={[styles.guidanceText, typography.caption]}>
              Ensure uniform lighting and crop tight to the text bounds.
            </Text>
          </Card>
          <Card style={styles.guidanceCard}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
              <X size={16} color={colors.error} />
            </View>
            <Text style={[styles.guidanceText, typography.caption]}>
              Shadows across text or cutting off equations mid-line.
            </Text>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, typography.mono]}>SUBJECT CONTEXT</Text>
          <View style={styles.coursePill}>
            <GraduationCap size={16} color={colors.primary} />
            <Text style={[styles.courseText, typography.bodySmall]}>Course: EEE 301</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.strategyRow}>
            <TouchableOpacity
              style={[styles.strategyPill, strategy === "step" && styles.activePill]}
              onPress={() => setStrategy("step")}
            >
              <Search size={16} color={strategy === "step" ? "#FFFFFF" : colors.textSecondary} />
              <Text style={[
                styles.strategyLabel,
                typography.bodySmall,
                { color: strategy === "step" ? "#FFFFFF" : colors.textSecondary }
              ]}>Step-by-Step</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.strategyPill, strategy === "quick" && styles.activePill]}
              onPress={() => setStrategy("quick")}
            >
              <Zap size={16} color={strategy === "quick" ? "#FFFFFF" : colors.textSecondary} />
              <Text style={[
                styles.strategyLabel,
                typography.bodySmall,
                { color: strategy === "quick" ? "#FFFFFF" : colors.textSecondary }
              ]}>Quick Answer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Button
          label="Solve This →"
          onPress={handleSolve}
          loading={loading}
          style={styles.solveBtn}
        />

        <View style={styles.bottomHint}>
          <Text style={[styles.hintText, typography.mono]}>
            • NEURAL ENGINE READY FOR OCR EXTRACTION
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  retakeText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 1.2,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: colors.surfaceElevated,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badgeOverlay: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  aiBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  qualityPrompt: {
    color: "#FFFFFF",
    marginBottom: 20,
    textAlign: "center",
  },
  guidanceRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  guidanceCard: {
    flex: 1,
    padding: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: "flex-start",
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  guidanceText: {
    color: colors.textSecondary,
    lineHeight: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 12,
  },
  coursePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  courseText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "600",
  },
  strategyRow: {
    flexDirection: "row",
    gap: 12,
  },
  strategyPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  activePill: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  strategyLabel: {
    marginLeft: 8,
    fontWeight: "600",
  },
  solveBtn: {
    marginTop: 8,
  },
  bottomHint: {
    marginTop: 24,
    alignItems: "center",
  },
  hintText: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
