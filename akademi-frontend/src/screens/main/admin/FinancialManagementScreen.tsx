import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, CreditCard, RefreshCcw, WalletCards } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/Skeleton";
import { adminService } from "../../../services/adminService";
import { useTheme } from "../../../theme/ThemeContext";

type Tab = "subscriptions" | "purchases" | "cases";

const money = (value: unknown) => `₦${Number(value || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString() : "—";

export const FinancialManagementScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("subscriptions");
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setData(await adminService.getFinanceOperations());
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "Could not load financial operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    if (tab === "subscriptions") return data?.subscriptions || [];
    if (tab === "purchases") return data?.koinPurchases || [];
    return data?.koinCases || [];
  }, [data, tab]);

  const renderRow = (item: any) => {
    if (tab === "subscriptions") {
      const paid = ["SUCCESS", "success", "successful"].includes(item.status);
      const active = paid && (!item.expires_at || new Date(item.expires_at) > new Date());
      return (
        <OperationRow
          key={item.id}
          title={item.user?.name || item.user?.email || "Unknown user"}
          subtitle={`${item.product_code || "Premium"} · ${date(item.purchased_at)}`}
          detail={`Expires ${date(item.expires_at)}`}
          status={active ? "ACTIVE" : paid ? "EXPIRED" : item.status}
          statusVariant={active ? "success" : paid ? "warning" : "error"}
          colors={colors}
          typography={typography}
        />
      );
    }

    if (tab === "purchases") {
      return (
        <OperationRow
          key={item.id}
          title={`${Number(item.koin_amount).toLocaleString()} Koin · ${money(item.naira_amount_kobo / 100)}`}
          subtitle={item.user?.name || item.user?.email || "Unknown user"}
          detail={`${item.reference} · ${date(item.created_at)}`}
          status={item.status}
          statusVariant={item.status === "PAID" ? "success" : item.status === "FAILED" ? "error" : "warning"}
          colors={colors}
          typography={typography}
        />
      );
    }

    return (
      <OperationRow
        key={item.id}
        title={`${Number(item.koin_amount).toLocaleString()} Koin · ${money(item.naira_amount_kobo / 100)}`}
        subtitle={item.user?.name || item.user?.email || "Unknown user"}
        detail={item.failure_reason || `${item.reference} · ${date(item.requested_at)}`}
        status={item.status}
        statusVariant="error"
        colors={colors}
        typography={typography}
      />
    );
  };

  return (
    <Screen title="Money Operations">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      >
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Payments control room</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Subscriptions, Koin purchases and payout cases from the live ledger.</Text>
          </View>
          <TouchableOpacity style={[styles.refreshButton, { borderColor: colors.border }]} onPress={() => void load(true)}>
            <RefreshCcw size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.summaryGrid}>{[1, 2, 3, 4].map((item) => <Skeleton key={item} width="48%" height={96} borderRadius={16} />)}</View>
        ) : (
          <View style={styles.summaryGrid}>
            <SummaryCard icon={CreditCard} label="Active Premium" value={data?.summary?.activeSubscriptions || 0} colors={colors} typography={typography} />
            <SummaryCard icon={CreditCard} label="Subscription revenue" value={money(data?.summary?.subscriptionRevenueNaira)} colors={colors} typography={typography} />
            <SummaryCard icon={WalletCards} label="Koin revenue" value={money(data?.summary?.koinRevenueNaira)} colors={colors} typography={typography} />
            <SummaryCard icon={AlertTriangle} label="Cases to review" value={data?.summary?.koinCasesNeedingReview || 0} danger colors={colors} typography={typography} />
          </View>
        )}

        <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {([
            ["subscriptions", "Subscriptions"],
            ["purchases", "Koin purchases"],
            ["cases", `Koin cases (${data?.summary?.koinCasesNeedingReview || 0})`],
          ] as Array<[Tab, string]>).map(([value, label]) => (
            <TouchableOpacity key={value} style={[styles.tab, tab === value && { backgroundColor: colors.primary }]} onPress={() => setTab(value)}>
              <Text style={[typography.caption, { color: tab === value ? "#FFFFFF" : colors.textSecondary, fontWeight: "700" }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={[typography.bodySmall, styles.error, { color: colors.error }]}>{error}</Text> : null}

        <Card style={styles.listCard}>
          {!loading && rows.length === 0 ? (
            <View style={styles.empty}><Text style={[typography.bodySmall, { color: colors.textSecondary }]}>No records in this section.</Text></View>
          ) : rows.map(renderRow)}
        </Card>
      </ScrollView>
    </Screen>
  );
};

const SummaryCard = ({ icon: Icon, label, value, danger, colors, typography }: any) => (
  <Card style={styles.summaryCard}>
    <Icon size={18} color={danger ? colors.error : colors.primary} />
    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 10 }]}>{label}</Text>
    <Text style={[typography.h3, { color: danger ? colors.error : colors.textPrimary, marginTop: 3 }]}>{value}</Text>
  </Card>
);

const OperationRow = ({ title, subtitle, detail, status, statusVariant, colors, typography }: any) => (
  <View style={[styles.operationRow, { borderBottomColor: colors.border }]}>
    <View style={styles.operationCopy}>
      <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "700" }]}>{title}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 3 }]}>{subtitle}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 3 }]} numberOfLines={2}>{detail}</Text>
    </View>
    <Badge label={status} variant={statusVariant} />
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  headingRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  headingCopy: { flex: 1, paddingRight: 12 },
  refreshButton: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  summaryCard: { width: "48%", minHeight: 104, padding: 14 },
  tabs: { flexDirection: "row", borderWidth: 1, borderRadius: 14, padding: 4, marginTop: 22, marginBottom: 12 },
  tab: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  listCard: { padding: 0, overflow: "hidden" },
  operationRow: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  operationCopy: { flex: 1, paddingRight: 10 },
  empty: { padding: 28, alignItems: "center" },
  error: { paddingVertical: 10 },
});
