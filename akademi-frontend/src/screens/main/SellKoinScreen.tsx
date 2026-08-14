import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { CalendarDays, CheckCircle2, Search, WalletCards } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { KoinWallet, NigerianBank, ResolvedBankAccount, koinService } from "../../services/koin";
import { useTheme } from "../../theme/ThemeContext";
import { userService } from "../../services/user";

export const SellKoinScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, typeScale, radius } = useTheme();
  const [wallet, setWallet] = useState<KoinWallet | null>(null);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [selectedBank, setSelectedBank] = useState<NigerianBank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("1250");
  const [resolved, setResolved] = useState<ResolvedBankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([koinService.getWallet(), koinService.getBanks()])
      .then(([walletData, bankData]) => { setWallet(walletData); setBanks(bankData); })
      .catch((error: any) => Alert.alert("Sell Koin unavailable", error?.response?.data?.message || "Please try again."))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    void userService.getProfile().then((profile) => setDateOfBirth(profile.date_of_birth || null)).catch(() => undefined);
  }, []));

  const filteredBanks = useMemo(() => {
    const query = bankSearch.trim().toLowerCase();
    return query ? banks.filter((bank) => bank.name.toLowerCase().includes(query)) : banks;
  }, [bankSearch, banks]);

  const verifyAccount = async () => {
    if (!dateOfBirth) return Alert.alert("Date of birth required", "Add your date of birth before selling Koin.", [{ text: "Cancel", style: "cancel" }, { text: "Add now", onPress: () => navigation.navigate("PersonalDetails") }]);
    if (!selectedBank) return Alert.alert("Select a bank", "Choose the destination bank first.");
    if (!/^\d{10}$/.test(accountNumber)) return Alert.alert("Check account number", "Enter a valid 10-digit account number.");
    try {
      setSubmitting(true);
      setResolved(await koinService.resolveAccount(selectedBank.code, accountNumber));
    } catch (error: any) {
      Alert.alert("Account not verified", error?.response?.data?.message || "Check the bank details and try again.");
    } finally { setSubmitting(false); }
  };

  const confirmSale = async () => {
    const koinAmount = Number(amount);
    const minimum = wallet?.minimumWithdrawalKoin || 1250;
    if (!resolved || !selectedBank) return;
    if (!Number.isInteger(koinAmount) || koinAmount < minimum) return Alert.alert("Amount too low", `Minimum sale is ${minimum.toLocaleString()} Koin.`);
    if (koinAmount > (wallet?.balance || 0)) return Alert.alert("Insufficient Koin", "Your balance is lower than this sale amount.");
    try {
      setSubmitting(true);
      const result = await koinService.withdraw(koinAmount, selectedBank.code, accountNumber);
      Alert.alert("Sale submitted", `${koinAmount.toLocaleString()} Koin is being sold for ₦${Math.floor(koinAmount * 0.8).toLocaleString()}. Payout status: ${result.status}.`, [
        { text: "Done", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert("Sale unavailable", error?.response?.data?.message || "Please try again.");
    } finally { setSubmitting(false); }
  };

  if (loading) return <Screen title="Sell Koin" onBack={() => navigation.goBack()} style={styles.center}><ActivityIndicator size="large" color={colors.brand.foreground} /></Screen>;

  const koinAmount = Number(amount) || 0;
  return (
    <Screen title="Sell Koin" onBack={() => navigation.goBack()} style={{ backgroundColor: colors.bg.canvas }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card elevated style={[styles.summary, { borderRadius: radius.lg }]}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.brand.subtle }]}><WalletCards size={23} color={colors.brand.foreground} /></View>
          <View style={styles.summaryCopy}><Text style={[typeScale.caption, { color: colors.fg.muted }]}>AVAILABLE</Text><Text style={[typeScale.h3, { color: colors.fg.primary }]}>{(wallet?.balance || 0).toLocaleString()} Koin</Text></View>
          <View><Text style={[typeScale.caption, { color: colors.fg.muted }]}>SELL RATE</Text><Text style={[typeScale.bodyStrong, { color: colors.fg.primary }]}>100 K = ₦80</Text></View>
        </Card>

        {!dateOfBirth ? <Pressable onPress={() => navigation.navigate("PersonalDetails")} style={[styles.dobNotice, { backgroundColor: colors.status.warning.bg, borderColor: colors.status.warning.border, borderRadius: radius.md }]}><CalendarDays size={21} color={colors.status.warning.icon} /><View style={{ flex: 1, gap: 2 }}><Text style={[typeScale.bodyStrong, { color: colors.status.warning.fg }]}>Add your date of birth</Text><Text style={[typeScale.caption, { color: colors.status.warning.fg }]}>Required before payouts. Tap to open Personal Details.</Text></View></Pressable> : null}

        <View style={styles.section}>
          <Text style={[typeScale.h3, { color: colors.fg.primary }]}>1. Enter amount</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Minimum 1,250 Koin" placeholderTextColor={colors.fg.muted} style={[styles.input, { color: colors.fg.primary, borderColor: colors.borderRoles.default, backgroundColor: colors.bg.surface }]} />
          <Text style={[typeScale.secondary, { color: colors.fg.secondary }]}>You receive ₦{Math.floor(koinAmount * 0.8).toLocaleString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[typeScale.h3, { color: colors.fg.primary }]}>2. Choose your bank</Text>
          <View style={[styles.searchBox, { borderColor: colors.borderRoles.default, backgroundColor: colors.bg.surface }]}><Search size={18} color={colors.fg.muted} /><TextInput value={bankSearch} onChangeText={setBankSearch} placeholder="Search banks" placeholderTextColor={colors.fg.muted} style={[styles.searchInput, { color: colors.fg.primary }]} /></View>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={[styles.bankList, { borderColor: colors.borderRoles.default, borderRadius: radius.md }]}>
            {filteredBanks.map((bank) => <Pressable key={bank.code} onPress={() => { setSelectedBank(bank); setResolved(null); }} style={[styles.bankRow, { borderBottomColor: colors.borderRoles.subtle, backgroundColor: selectedBank?.code === bank.code ? colors.brand.subtle : colors.bg.surface }]}><Text style={[typeScale.bodyStrong, { color: colors.fg.primary, flex: 1 }]}>{bank.name}</Text>{selectedBank?.code === bank.code ? <CheckCircle2 size={20} color={colors.brand.foreground} /> : null}</Pressable>)}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={[typeScale.h3, { color: colors.fg.primary }]}>3. Verify account</Text>
          <TextInput value={accountNumber} onChangeText={(value) => { setAccountNumber(value.replace(/\D/g, "").slice(0, 10)); setResolved(null); }} keyboardType="number-pad" placeholder="10-digit account number" placeholderTextColor={colors.fg.muted} style={[styles.input, { color: colors.fg.primary, borderColor: colors.borderRoles.default, backgroundColor: colors.bg.surface }]} />
          {resolved ? <View style={[styles.resolved, { backgroundColor: colors.status.success.bg, borderColor: colors.status.success.border }]}><CheckCircle2 size={21} color={colors.status.success.icon} /><View><Text style={[typeScale.bodyStrong, { color: colors.status.success.fg }]}>{resolved.accountName}</Text><Text style={[typeScale.caption, { color: colors.status.success.fg }]}>{resolved.bankName} •••• {resolved.accountNumber.slice(-4)}</Text></View></View> : null}
          <Pressable disabled={submitting} onPress={() => void (resolved ? confirmSale() : verifyAccount())} style={[styles.primaryButton, { backgroundColor: colors.brand.fill, borderRadius: radius.md }]}>{submitting ? <ActivityIndicator color={colors.brand.onFill} /> : <Text style={[typeScale.bodyStrong, { color: colors.brand.onFill }]}>{resolved ? `Sell for ₦${Math.floor(koinAmount * 0.8).toLocaleString()}` : "Verify account"}</Text>}</Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" }, content: { padding: 16, paddingBottom: 48, gap: 28 },
  summary: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }, summaryIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" }, summaryCopy: { flex: 1, gap: 2 },
  section: { gap: 12 }, input: { height: 54, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 16 }, searchBox: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9 }, searchInput: { flex: 1, height: "100%" },
  bankList: { borderWidth: 1, maxHeight: 330, overflow: "hidden" }, bankRow: { minHeight: 52, paddingHorizontal: 14, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  resolved: { borderWidth: 1, borderRadius: 12, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 }, primaryButton: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  dobNotice: { borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
});
