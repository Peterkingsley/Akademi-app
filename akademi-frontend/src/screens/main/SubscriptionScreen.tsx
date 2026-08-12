import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  X,
  Sparkles,
  Infinity as InfinityIcon,
  Book,
  Download,
  Target,
  ArrowRight,
  CheckCircle2,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { SafeArea } from "../../components/layout/SafeArea";
import { userService } from "../../services/user";

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<{ plan: "monthly" | "yearly"; expiresAt: string } | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  const loadSubscription = useCallback(async () => {
    try {
      setCheckingSubscription(true);
      const access = await userService.getFeatureAccess();
      const active = access
        .filter((item) => item.product_code?.startsWith("AKADEMI_PRO_") && item.expires_at && new Date(item.expires_at) > new Date())
        .sort((a, b) => new Date(b.expires_at!).getTime() - new Date(a.expires_at!).getTime())[0];
      setSubscription(active ? {
        plan: active.product_code === "AKADEMI_PRO_YEARLY" ? "yearly" : "monthly",
        expiresAt: active.expires_at!,
      } : null);
    } catch (error) {
      console.error("Subscription status check failed:", error);
    } finally {
      setCheckingSubscription(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadSubscription(); }, [loadSubscription]));

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const checkout = await userService.purchaseSubscription(billingCycle);
      const result = await WebBrowser.openBrowserAsync(checkout.paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: colors.primary,
      });
      try {
        await userService.verifySubscription(checkout.reference);
        await loadSubscription();
        Alert.alert("Welcome to Akademi Pro", "Your payment is confirmed and Pro access is now active.", [
          { text: "Continue", onPress: () => navigation.goBack() },
        ]);
      } catch {
        Alert.alert("Payment awaiting confirmation", "If you completed payment, it may take a moment to confirm. Return to this screen and try again shortly.");
      }
    } catch (error) {
      console.error("Subscription purchase failed:", error);
      Alert.alert("Payment unavailable", "We could not open Kora checkout. Please try again later.");
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
              Unlock the ultimate AI study companion for top grades.
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

          {subscription ? (
            <View style={styles.activeSubscriptionCard}>
              <CheckCircle2 size={24} color={colors.primary} />
              <View style={styles.activeSubscriptionCopy}>
                <Text style={styles.activeSubscriptionTitle}>You’re already subscribed</Text>
                <Text style={styles.activeSubscriptionText}>
                  Akademi Pro {subscription.plan === "yearly" ? "Yearly" : "Monthly"} · Active until {new Date(subscription.expiresAt).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })}
                </Text>
              </View>
            </View>
          ) : null}

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
            label={subscription ? "Already subscribed" : `Pay ${displayPrice} with Kora`}
            onPress={handleUpgrade}
            loading={loading || checkingSubscription}
            disabled={!!subscription}
            icon={subscription ? <CheckCircle2 size={20} color="#FFFFFF" /> : <ArrowRight size={20} color="#FFFFFF" />}
            style={styles.upgradeButton}
          />

          <Text style={styles.trustText}>
            Secure checkout powered by Kora
          </Text>

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
  activeSubscriptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  activeSubscriptionCopy: { flex: 1, gap: 4 },
  activeSubscriptionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800" },
  activeSubscriptionText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
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
});
