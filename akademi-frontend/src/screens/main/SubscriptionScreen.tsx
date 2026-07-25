import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  X,
  Sparkles,
  Infinity as InfinityIcon,
  Book,
  Download,
  Target,
  ArrowRight
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { userService } from "../../services/user";
import { SafeArea } from "../../components/layout/SafeArea";

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isFreeBetaActive, setIsFreeBetaActive] = useState(false);

  useEffect(() => {
    const fetchAccess = async () => {
      try {
        const access = await userService.getFeatureAccess();
        setIsFreeBetaActive(access.some((item) => item.payment_ref === "BYPASS"));
      } catch (error) {
        console.error("Feature access check failed:", error);
      } finally {
        setCheckingAccess(false);
      }
    };

    fetchAccess();
  }, []);

  const handleUpgrade = async () => {
    if (isFreeBetaActive) {
      navigation.goBack();
      return;
    }

    setLoading(true);
    try {
      const { paymentUrl, betaUnlocked, message } = await userService.purchaseSubscription(billingCycle);
      if (betaUnlocked) {
        setIsFreeBetaActive(true);
        Alert.alert("Free beta active", message || "All MVP features are unlocked for now.");
        return;
      }

      if (!paymentUrl) {
        Alert.alert("Payment unavailable", "Payment setup is not ready yet. Please try again later.");
        return;
      }

      await WebBrowser.openBrowserAsync(paymentUrl);
    } catch (error) {
      console.error("Subscription purchase failed:", error);
      Alert.alert("Payment unavailable", "We could not start checkout. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <InfinityIcon size={18} color={colors.primary} />, text: "Unlimited AI Socratic tutor & assignment solving" },
    { icon: <Book size={18} color={colors.primary} />, text: "Full Study Mode with practice questions & formulas" },
    { icon: <Download size={18} color={colors.primary} />, text: "Offline downloads for all course materials" },
    { icon: <Target size={18} color={colors.primary} />, text: "Complete Exam Prep hub & unlimited CBT mock exams" },
  ];

  const displayPrice = billingCycle === "yearly" ? "NGN 18,000" : "NGN 2,500";
  const displayOriginalPrice = billingCycle === "yearly" ? "NGN 30,000" : null;
  const displaySavings = billingCycle === "yearly" ? "SAVE NGN 12,000" : null;

  return (
    <View style={styles.container}>
      <SafeArea style={{ flex: 1 }}>
        <LinearGradient
          colors={["#0B1E12", "#04110A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Akademi Pro</Text>
              <Sparkles size={22} color={colors.primary} />
            </View>
            <Text style={styles.subtitle}>
              {isFreeBetaActive
                ? "Free beta is active. All MVP study tools are unlocked for you."
                : "Unlock the ultimate AI study companion for top grades."}
            </Text>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Features List */}
          <View style={styles.featuresList}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={styles.featureIconCircle}>
                  {feature.icon}
                </View>
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </View>

          {isFreeBetaActive && (
            <View style={styles.betaBanner}>
              <Text style={styles.betaLabel}>FREE BETA</Text>
              <Text style={styles.betaText}>
                Payments are configured for launch, but checkout is paused while beta access is unlocked.
              </Text>
            </View>
          )}

          {/* Billing Toggle */}
          <View style={styles.toggleContainer}>
            <View style={styles.toggleBackground}>
              <TouchableOpacity
                style={[styles.toggleOption, billingCycle === "monthly" && styles.toggleActive]}
                onPress={() => setBillingCycle("monthly")}
              >
                <Text style={[styles.toggleText, billingCycle === "monthly" && styles.toggleTextActive]}>
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleOption, billingCycle === "yearly" && styles.toggleActive]}
                onPress={() => setBillingCycle("yearly")}
              >
                <View style={styles.yearlyOptionRow}>
                  <Text style={[styles.toggleText, billingCycle === "yearly" && styles.toggleTextActive]}>
                    Yearly
                  </Text>
                  <View style={styles.saveBadge}>
                    <Text style={styles.saveBadgeText}>SAVE 40%</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Price Display */}
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>{displayPrice}<Text style={styles.pricePeriod}>/{billingCycle === "yearly" ? "year" : "mo"}</Text></Text>
            {billingCycle === "yearly" && (
              <View style={styles.savingsRow}>
                <Text style={styles.originalPrice}>{displayOriginalPrice}</Text>
                <Text style={styles.savingsText}>{displaySavings}</Text>
              </View>
            )}
          </View>

          {/* Action Button */}
          <Button
            label={isFreeBetaActive ? "Continue with free beta" : "Upgrade to Pro"}
            onPress={handleUpgrade}
            loading={loading || checkingAccess}
            icon={<ArrowRight size={20} color="#FFFFFF" />}
            style={styles.upgradeButton}
          />

          <Text style={styles.trustText}>
            {isFreeBetaActive
              ? "No payment needed during beta. Paid plans can be enabled after launch."
              : "Cancel anytime - Secure payment - 3-day free trial"}
          </Text>

          {!isFreeBetaActive && (
            <TouchableOpacity style={styles.restoreButton}>
              <Text style={styles.restoreText}>Restore purchases</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeArea>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: 10,
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: 4,
  },
  headerContent: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    ...typography.h2,
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginRight: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#D4D4D8",
    textAlign: "center",
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "rgba(34, 197, 94, 0.3)",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  featureText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "600",
    flex: 1,
  },
  betaBanner: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  betaLabel: {
    ...typography.mono,
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 4,
  },
  betaText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  toggleContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  toggleBackground: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 4,
    width: "100%",
  },
  toggleOption: {
    flex: 1,
    height: 42,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  yearlyOptionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  saveBadge: {
    backgroundColor: "#04110A",
    borderColor: "rgba(34, 197, 94, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  saveBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: colors.primary,
  },
  priceContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  priceText: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  savingsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  originalPrice: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: "line-through",
    marginRight: 8,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  upgradeButton: {
    marginBottom: 20,
  },
  trustText: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 16,
  },
  restoreButton: {
    alignSelf: "center",
  },
  restoreText: {
    fontSize: 11,
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },
});
