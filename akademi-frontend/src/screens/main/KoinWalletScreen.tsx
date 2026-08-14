import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight, Coins, ShieldCheck, WalletCards } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { KoinWallet, koinService } from "../../services/koin";
import { useTheme } from "../../theme/ThemeContext";
import * as WebBrowser from "expo-web-browser";

const labels: Record<string, string> = {
  PURCHASE: "Koin purchase", REWARD_SENT: "Player reward", REWARD_RECEIVED: "Reward received",
  STAKE: "Match stake", POOL_CONTRIBUTION: "Prize pool", PRIZE_WIN: "Competition prize",
  POOL_REFUND: "Pool refund", WITHDRAWAL: "Withdrawal", WITHDRAWAL_REFUND: "Withdrawal refund",
  ADMIN_ADJUSTMENT: "Balance adjustment",
};

export const KoinWalletScreen: React.FC = () => {
  const { colors, typeScale, radius } = useTheme();
  const [wallet, setWallet] = useState<KoinWallet | null>(null);
  const [packages, setPackages] = useState<Array<{ koin: number; naira: number; enabled: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingKoin, setBuyingKoin] = useState<number | null>(null);

  const load = async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      const [walletData, packageData] = await Promise.all([koinService.getWallet(), koinService.getPackages()]);
      setWallet(walletData); setPackages(packageData);
    } catch (error: any) {
      Alert.alert("Koin unavailable", error?.response?.data?.message || "Please try again.");
    } finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { void load(); }, []);

  const buyKoin = async (koinAmount: number, enabled: boolean) => {
    if (!enabled || buyingKoin !== null) {
      if (!enabled) Alert.alert("Koin purchases unavailable", "Koin purchases have not been enabled yet.");
      return;
    }
    try {
      setBuyingKoin(koinAmount);
      const checkout = await koinService.purchase(koinAmount);
      await WebBrowser.openBrowserAsync(checkout.paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: colors.brand.foreground,
      });
      try {
        const confirmation = await koinService.verifyPurchase(checkout.reference);
        await load(true);
        Alert.alert(
          confirmation.credited ? "Koin added" : "Payment confirmed",
          `${koinAmount.toLocaleString()} Koin is available in your wallet.`,
        );
      } catch {
        Alert.alert("Payment awaiting confirmation", "If you completed payment, pull down to refresh in a moment. Your Koin will be added automatically after Kora confirms it.");
      }
    } catch (error: any) {
      Alert.alert("Payment unavailable", error?.response?.data?.message || "We could not open Kora checkout. Please try again.");
    } finally {
      setBuyingKoin(null);
    }
  };

  if (loading) return <Screen style={[styles.screen, styles.center, { backgroundColor: colors.bg.canvas }]}><ActivityIndicator color={colors.brand.foreground} size="large" /></Screen>;

  return (
    <Screen title="Koin Wallet" style={[styles.screen, { backgroundColor: colors.bg.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand.foreground} />}>
        <Card elevated style={[styles.balanceCard, { borderRadius: radius.xl, borderColor: colors.brand.border }]}>
          <View style={[styles.koinIcon, { backgroundColor: colors.brand.subtle }]}><Coins size={28} color={colors.brand.foreground} /></View>
          <Text style={[typeScale.secondary, { color: colors.fg.secondary }]}>Available balance</Text>
          <Text style={[styles.balance, { color: colors.fg.primary }]}>{(wallet?.balance || 0).toLocaleString()} Koin</Text>
          <Text style={[typeScale.secondary, { color: colors.fg.muted }]}>Withdrawable value: ₦{(wallet?.withdrawableNaira || 0).toLocaleString()}</Text>
          <View style={[styles.rateBox, { backgroundColor: colors.bg.surfaceRaised, borderRadius: radius.md }]}>
            <View style={styles.rateColumn}>
              <Text style={[typeScale.caption, styles.rateLabel, { color: colors.fg.secondary }]}>BUY RATE</Text>
              <Text style={[typeScale.label, styles.rateValue, { color: colors.fg.primary }]}>100 Koin = ₦100</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderRoles.default }]} />
            <View style={styles.rateColumn}>
              <Text style={[typeScale.caption, styles.rateLabel, { color: colors.fg.secondary }]}>SELL RATE</Text>
              <Text style={[typeScale.label, styles.rateValue, { color: colors.fg.primary }]}>100 Koin = ₦80</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={[typeScale.h3, { color: colors.fg.primary }]}>Buy Koin</Text>
          <View style={styles.packages}>
            {packages.map((item) => (
              <Pressable key={item.koin} disabled={buyingKoin !== null} onPress={() => void buyKoin(item.koin, item.enabled)} style={[styles.package, { backgroundColor: colors.bg.surface, borderColor: colors.borderRoles.default, borderRadius: radius.md, opacity: buyingKoin !== null && buyingKoin !== item.koin ? 0.55 : 1 }]}>
                {buyingKoin === item.koin ? <ActivityIndicator size="small" color={colors.brand.foreground} /> : <Coins size={18} color={colors.brand.foreground} />}<Text style={[typeScale.bodyStrong, { color: colors.fg.primary }]}>{item.koin.toLocaleString()}</Text><Text style={[typeScale.caption, { color: colors.fg.muted }]}>₦{item.naira.toLocaleString()}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable onPress={() => Alert.alert("Withdraw Koin", `Minimum withdrawal is ${(wallet?.minimumWithdrawalKoin || 1250).toLocaleString()} Koin. Withdrawals require age and identity verification and will open after payout-provider approval.`)} style={[styles.withdraw, { backgroundColor: colors.brand.fill, borderRadius: radius.md }]}>
          <WalletCards size={20} color={colors.brand.onFill} /><Text style={[typeScale.bodyStrong, { color: colors.brand.onFill }]}>Withdraw Koin</Text>
        </Pressable>

        <View style={[styles.safety, { backgroundColor: colors.status.info.bg, borderColor: colors.status.info.border, borderRadius: radius.md }]}>
          <ShieldCheck size={20} color={colors.status.info.icon} /><Text style={[typeScale.secondary, styles.safetyText, { color: colors.status.info.fg }]}>Users under 18 can buy and use Koin, but withdrawals unlock at 18. Prize pools pay 80% to the winner and 20% to Akademi.</Text>
        </View>

        <View style={styles.section}>
          <Text style={[typeScale.h3, { color: colors.fg.primary }]}>Recent activity</Text>
          <Card noPadding style={{ borderRadius: radius.lg }}>
            {(wallet?.ledger || []).length ? wallet!.ledger.map((entry) => {
              const incoming = entry.amount > 0;
              return <View key={entry.id} style={[styles.activity, { borderBottomColor: colors.borderRoles.subtle }]}>
                <View style={[styles.activityIcon, { backgroundColor: incoming ? colors.status.success.bg : colors.bg.surfaceRaised }]}>{incoming ? <ArrowDownLeft size={18} color={colors.status.success.icon} /> : <ArrowUpRight size={18} color={colors.fg.secondary} />}</View>
                <View style={styles.activityCopy}><Text style={[typeScale.bodyStrong, { color: colors.fg.primary }]}>{labels[entry.type] || "Koin activity"}</Text><Text style={[typeScale.caption, { color: colors.fg.muted }]}>{new Date(entry.created_at).toLocaleDateString()}</Text></View>
                <Text style={[typeScale.label, { color: incoming ? colors.status.success.fg : colors.fg.primary }]}>{incoming ? "+" : ""}{entry.amount} K</Text>
              </View>;
            }) : <View style={styles.empty}><Text style={[typeScale.secondary, { color: colors.fg.secondary }]}>Your Koin activity will appear here.</Text></View>}
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { alignItems: "center", justifyContent: "center" }, content: { padding: 16, paddingBottom: 48, gap: 24 },
  balanceCard: { alignItems: "center", gap: 5, padding: 20 }, koinIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 }, balance: { fontSize: 32, lineHeight: 40, fontWeight: "800" },
  rateBox: { width: "100%", marginTop: 12, paddingVertical: 14, paddingHorizontal: 8, flexDirection: "row", alignItems: "stretch" },
  rateColumn: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4 },
  rateLabel: { textAlign: "center" },
  rateValue: { textAlign: "center", flexShrink: 1 },
  divider: { width: 1, alignSelf: "stretch", marginVertical: 2 }, section: { gap: 12 }, packages: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  package: { width: "48%", minHeight: 76, padding: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7 }, withdraw: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  safety: { borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 }, safetyText: { flex: 1 }, activity: { minHeight: 68, paddingHorizontal: 14, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  activityIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }, activityCopy: { flex: 1, gap: 2 }, empty: { minHeight: 100, alignItems: "center", justifyContent: "center", padding: 16 },
});
