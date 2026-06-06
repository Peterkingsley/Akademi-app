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
  Bot,
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
    { icon: <InfinityIcon size={20} color="#FFFFFF" />, text: "Unlimited assignment solving" },
    { icon: <Book size={20} color="#FFFFFF" />, text: "Full Study Mode with practice questions" },
    { icon: <Bot size={20} color="#FFFFFF" />, text: "Unlimited Live Tutor sessions" },
    { icon: <Download size={20} color="#FFFFFF" />, text: "Offline access to all materials" },
    { icon: <Target size={20} color="#FFFFFF" />, text: "Full Exam Prep & unlimited mock exams" },
  ];

  const displayPrice = billingCycle === "yearly" ? "NGN 18,000" : "NGN 2,500";
  const displayOriginalPrice = billingCycle === "yearly" ? "NGN 30,000" : null;
  const displaySavings = billingCycle === "yearly" ? "SAVE NGN 12,000" : null;

  return (
    <View style={styles.container}>
      <SafeArea style={{ flex: 1 }}>
        <LinearGradient
          colors={["#1E1B4B", "#4338CA"]}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Akademi Pro +</Text>
              <Sparkles size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.subtitle}>
              {isFreeBetaActive
                ? "Free beta is active. All MVP study tools are unlocked."
                : "Unlock the full potential of your academic journey."}
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
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 20,
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: 4,
  },
  headerContent: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    ...typography.h2,
    color: "#FFFFFF",
    marginRight: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#C7D2FE",
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  featureText: {
    fontSize: 11.25,
    color: colors.textPrimary,
  },
  betaBanner: {
    backgroundColor: colors.primary + "18",
    borderWidth: 1,
    borderColor: colors.primary + "55",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  betaLabel: {
    ...typography.mono,
    color: colors.primary,
    fontSize: 8,
    marginBottom: 6,
  },
  betaText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    lineHeight: 18,
  },
  toggleContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  toggleBackground: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 24,
    padding: 4,
    width: "100%",
  },
  toggleOption: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: "#FFFFFF",
  },
  toggleText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: "#000000",
  },
  yearlyOptionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  saveBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  saveBadgeText: {
    fontSize: 7.5,
    fontWeight: "700",
    color: "#000000",
  },
  priceContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  priceText: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  pricePeriod: {
    fontSize: 13.5,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  savingsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  originalPrice: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: "line-through",
    marginRight: 8,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
  },
  upgradeButton: {
    marginBottom: 20,
  },
  trustText: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  restoreButton: {
    alignSelf: "center",
  },
  restoreText: {
    fontSize: 10.5,
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },
});
