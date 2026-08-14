import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight, Coins, ShieldCheck, WalletCards } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { KoinWallet, NigerianBank, ResolvedBankAccount, koinService } from "../../services/koin";
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
  const [sellOpen, setSellOpen] = useState(false);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<NigerianBank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [sellAmount, setSellAmount] = useState("1250");
  const [resolvedAccount, setResolvedAccount] = useState<ResolvedBankAccount | null>(null);
  const [selling, setSelling] = useState(false);

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

  const openSell = async () => {
    setSellOpen(true); setResolvedAccount(null);
    if (!banks.length) {
      try { setBanks(await koinService.getBanks()); }
      catch (error: any) { Alert.alert("Banks unavailable", error?.response?.data?.message || "Please try again."); }
    }
  };

  const verifySellAccount = async () => {
    if (!selectedBank || !/^\d{10}$/.test(accountNumber)) return Alert.alert("Check bank details", "Choose a bank and enter a valid 10-digit account number.");
    try { setSelling(true); setResolvedAccount(await koinService.resolveAccount(selectedBank.code, accountNumber)); }
    catch (error: any) { Alert.alert("Account not verified", error?.response?.data?.message || "Check the account details."); }
    finally { setSelling(false); }
  };

  const submitSell = async () => {
    const amount = Number(sellAmount);
    if (!resolvedAccount || !selectedBank) return;
    if (!Number.isInteger(amount) || amount < (wallet?.minimumWithdrawalKoin || 1250)) return Alert.alert("Amount too low", `Minimum sale is ${(wallet?.minimumWithdrawalKoin || 1250).toLocaleString()} Koin.`);
    if (amount > (wallet?.balance || 0)) return Alert.alert("Insufficient Koin", "Your Koin balance is lower than this amount.");
    try {
      setSelling(true);
      const result = await koinService.withdraw(amount, selectedBank.code, accountNumber);
      setSellOpen(false); await load(true);
      Alert.alert("Sale submitted", `${amount.toLocaleString()} Koin is being sold for ₦${Math.floor(amount * 0.8).toLocaleString()}. Payout status: ${result.status}.`);
    } catch (error: any) { Alert.alert("Sale unavailable", error?.response?.data?.message || "Please try again."); }
    finally { setSelling(false); }
  };

  if (loading) return <Screen style={[styles.screen, styles.center, { backgroundColor: colors.bg.canvas }]}><ActivityIndicator color={colors.brand.foreground} size="large" /></Screen>;

  return (
    <Screen title="Koin Wallet" style={[styles.screen, { backgroundColor: colors.bg.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand.foreground} />}>
        <Card elevated style={[styles.balanceCard, { borderRadius: radius.xl, borderColor: colors.brand.border }]}>
          <View style={[styles.koinIcon, { backgroundColor: colors.brand.subtle }]}><Coins size={28} color={colors.brand.foreground} /></View>
          <Text style={[typeScale.secondary, { color: colors.fg.secondary }]}>Available balance</Text>
          <Text style={[styles.balance, { color: colors.fg.primary }]}>{(wallet?.balance || 0).toLocaleString()} Koin</Text>
          <Text style={[typeScale.secondary, { color: colors.fg.muted }]}>Value: ₦{(wallet?.balance || 0).toLocaleString()}</Text>
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

        <Pressable onPress={() => void openSell()} style={[styles.withdraw, { backgroundColor: colors.brand.fill, borderRadius: radius.md }]}>
          <WalletCards size={20} color={colors.brand.onFill} /><Text style={[typeScale.bodyStrong, { color: colors.brand.onFill }]}>Sell Koin</Text>
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
      <Modal visible={sellOpen} transparent animationType="slide" onRequestClose={() => setSellOpen(false)}>
        <View style={styles.modalBackdrop}><View style={[styles.sellSheet, { backgroundColor: colors.bg.surface, borderColor: colors.borderRoles.default, borderRadius: radius.xl }]}>
          <Text style={[typeScale.h3, { color: colors.fg.primary }]}>Sell Koin</Text>
          <Text style={[typeScale.secondary, { color: colors.fg.secondary }]}>Minimum 1,250 Koin. You receive ₦80 for every 100 Koin.</Text>
          <TextInput value={sellAmount} onChangeText={setSellAmount} keyboardType="number-pad" placeholder="Koin amount" placeholderTextColor={colors.fg.muted} style={[styles.input, { color: colors.fg.primary, borderColor: colors.borderRoles.default }]} />
          <TextInput value={accountNumber} onChangeText={(value) => { setAccountNumber(value.replace(/\D/g, '').slice(0, 10)); setResolvedAccount(null); }} keyboardType="number-pad" placeholder="10-digit account number" placeholderTextColor={colors.fg.muted} style={[styles.input, { color: colors.fg.primary, borderColor: colors.borderRoles.default }]} />
          <Text style={[typeScale.label, { color: colors.fg.primary }]}>Select bank</Text>
          <ScrollView style={styles.bankList} nestedScrollEnabled>
            {banks.map((bank) => <Pressable key={bank.code} onPress={() => { setSelectedBank(bank); setResolvedAccount(null); }} style={[styles.bankRow, { borderBottomColor: colors.borderRoles.subtle, backgroundColor: selectedBank?.code === bank.code ? colors.brand.subtle : 'transparent' }]}><Text style={[typeScale.secondary, { color: colors.fg.primary }]}>{bank.name}</Text></Pressable>)}
          </ScrollView>
          {resolvedAccount ? <View style={[styles.accountResult, { backgroundColor: colors.status.success.bg }]}><Text style={[typeScale.bodyStrong, { color: colors.status.success.fg }]}>{resolvedAccount.accountName}</Text><Text style={[typeScale.caption, { color: colors.status.success.fg }]}>{resolvedAccount.bankName} •••• {resolvedAccount.accountNumber.slice(-4)}</Text></View> : null}
          <View style={styles.modalActions}>
            <Pressable onPress={() => setSellOpen(false)} style={[styles.modalButton, { borderColor: colors.borderRoles.default }]}><Text style={{ color: colors.fg.primary }}>Cancel</Text></Pressable>
            <Pressable disabled={selling} onPress={() => void (resolvedAccount ? submitSell() : verifySellAccount())} style={[styles.modalButton, { backgroundColor: colors.brand.fill }]}>{selling ? <ActivityIndicator color={colors.brand.onFill} /> : <Text style={{ color: colors.brand.onFill, fontWeight: '700' }}>{resolvedAccount ? 'Confirm sale' : 'Verify account'}</Text>}</Pressable>
          </View>
        </View></View>
      </Modal>
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', padding: 12 }, sellSheet: { borderWidth: 1, padding: 18, gap: 12, maxHeight: '90%' }, input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 }, bankList: { maxHeight: 180, borderRadius: 12 }, bankRow: { minHeight: 46, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 1 }, accountResult: { padding: 12, borderRadius: 12, gap: 3 }, modalActions: { flexDirection: 'row', gap: 10 }, modalButton: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
