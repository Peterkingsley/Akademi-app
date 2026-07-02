import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, DepartmentCoverage, SchoolCoverageAudit } from "../../../services/adminService";
import { Shield, ShieldAlert, ShieldCheck, AlertCircle, Building2, RefreshCw } from "lucide-react-native";
import { Card } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/Skeleton";

type ViewMode = "schools" | "documents";
type SchoolStatus = SchoolCoverageAudit["schools"][number]["status"];

const statusLabels: Record<SchoolStatus, string> = {
  complete: "Complete",
  needs_enrichment: "Needs enrichment",
  placeholder_only: "Placeholder only",
  missing_departments: "Missing departments",
};

export const CoverageMapScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [coverage, setCoverage] = useState<DepartmentCoverage[]>([]);
  const [schoolAudit, setSchoolAudit] = useState<SchoolCoverageAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("schools");
  const [schoolStatusFilter, setSchoolStatusFilter] = useState<SchoolStatus | "all">("all");

  useEffect(() => {
    fetchCoverage();
  }, []);

  const fetchCoverage = async () => {
    try {
      setLoading(true);
      const [departmentData, schoolData] = await Promise.all([
        adminService.getDepartmentCoverage(),
        adminService.getSchoolCoverageAudit(),
      ]);
      setCoverage(departmentData);
      setSchoolAudit(schoolData);
    } catch (error) {
      console.error("Failed to fetch coverage", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSchools = useMemo(() => {
    const schools = schoolAudit?.schools || [];
    if (schoolStatusFilter === "all") return schools;
    return schools.filter((school) => school.status === schoolStatusFilter);
  }, [schoolAudit, schoolStatusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "complete":
        return "#AFE607";
      case "outdated":
      case "needs_enrichment":
        return "#F59E0B";
      case "placeholder_only":
        return "#8B5CF6";
      case "missing":
      case "missing_departments":
        return "#EF4444";
      default:
        return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
      case "complete":
        return ShieldCheck;
      case "outdated":
      case "needs_enrichment":
        return AlertCircle;
      case "placeholder_only":
      case "missing":
      case "missing_departments":
        return ShieldAlert;
      default:
        return Shield;
    }
  };

  const renderDepartmentItem = ({ item }: { item: DepartmentCoverage }) => {
    const color = getStatusColor(item.status);
    const Icon = getStatusIcon(item.status);

    return (
      <Card style={StyleSheet.flatten([styles.coverageCard, { borderColor: color + "40" }])}>
        <View style={[styles.statusIndicator, { backgroundColor: color }]} />
        <View style={styles.cardHeader}>
          <Icon size={20} color={color} />
          <Text style={[typography.caption, { color, fontWeight: "900", marginLeft: 6, textTransform: "uppercase" }]}>
            {item.status}
          </Text>
        </View>
        <Text style={[typography.body, { fontWeight: "700", color: colors.textPrimary, marginTop: 8 }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
          {item.university}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
            {item.lastUpdated ? `Updated ${new Date(item.lastUpdated).toLocaleDateString()}` : "Never updated"}
          </Text>
        </View>
      </Card>
    );
  };

  const renderSchoolItem = ({ item }: { item: SchoolCoverageAudit["schools"][number] }) => {
    const color = getStatusColor(item.status);
    const Icon = getStatusIcon(item.status);

    return (
      <Card style={StyleSheet.flatten([styles.schoolCard, { borderColor: color + "40" }])}>
        <View style={styles.cardHeader}>
          <Icon size={20} color={color} />
          <Text style={[typography.caption, { color, fontWeight: "900", marginLeft: 6, textTransform: "uppercase" }]}>
            {statusLabels[item.status]}
          </Text>
        </View>
        <Text style={[typography.body, { fontWeight: "800", color: colors.textPrimary, marginTop: 8 }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
          {item.facultyCount} faculties • {item.departmentCount} departments
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]} numberOfLines={2}>
          {item.recommendedAction}
        </Text>
      </Card>
    );
  };

  const summary = schoolAudit?.summary;
  const schoolStatusOptions: Array<{ key: SchoolStatus | "all"; label: string; count: number }> = [
    { key: "all", label: "All", count: summary?.totalSchools || 0 },
    { key: "complete", label: "Complete", count: summary?.completeSchools || 0 },
    { key: "needs_enrichment", label: "Needs work", count: summary?.needsEnrichmentSchools || 0 },
    { key: "placeholder_only", label: "Placeholder", count: summary?.placeholderOnlySchools || 0 },
    { key: "missing_departments", label: "Missing", count: summary?.missingDepartmentSchools || 0 },
  ];

  return (
    <Screen title="Knowledge Coverage" scrollable={false}>
      <View style={[styles.headerPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.headerTitleRow}>
          <Building2 size={22} color={colors.primary} />
          <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "900" }]}>School data coverage</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchCoverage}>
            <RefreshCw size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          {(["schools", "documents"] as ViewMode[]).map((mode) => {
            const active = viewMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.modeChip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                onPress={() => setViewMode(mode)}
              >
                <Text style={[typography.caption, { color: active ? "#020403" : colors.textPrimary, fontWeight: "900" }]}>
                  {mode === "schools" ? "Schools" : "Documents"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.grid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} width="48%" height={120} borderRadius={16} style={{ marginBottom: 16 }} />
          ))}
        </View>
      ) : viewMode === "schools" ? (
        <FlatList
          data={filteredSchools}
          renderItem={renderSchoolItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View>
              {summary && (
                <View style={styles.summaryGrid}>
                  <SummaryCard label="Total schools" value={summary.totalSchools} />
                  <SummaryCard label="Incomplete" value={summary.incompleteSchools} danger />
                  <SummaryCard label="Placeholder only" value={summary.placeholderOnlySchools} warning />
                  <SummaryCard label="Low departments" value={summary.lowDepartmentSchools} warning />
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {schoolStatusOptions.map((option) => {
                  const active = schoolStatusFilter === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.filterChip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                      onPress={() => setSchoolStatusFilter(option.key)}
                    >
                      <Text style={[typography.caption, { color: active ? "#020403" : colors.textPrimary, fontWeight: "900" }]}>
                        {option.label}: {option.count}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={coverage}
          renderItem={renderDepartmentItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
        />
      )}
    </Screen>
  );
};

const SummaryCard = ({ label, value, danger, warning }: { label: string; value: number; danger?: boolean; warning?: boolean }) => {
  const { colors, typography } = useTheme();
  const color = danger ? "#EF4444" : warning ? "#F59E0B" : colors.primary;

  return (
    <View style={[styles.summaryCard, { borderColor: color + "40", backgroundColor: color + "10" }]}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.h2, { color, fontWeight: "900" }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  headerPanel: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    margin: 16,
    marginBottom: 0,
    padding: 14,
  },
  headerTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  refreshButton: {
    marginLeft: "auto",
    padding: 6,
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeChip: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  row: {
    justifyContent: "space-between",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    width: "48%",
  },
  filterRow: {
    gap: 10,
    paddingBottom: 14,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  coverageCard: {
    marginBottom: 16,
    width: "48%",
    minHeight: 120,
    position: "relative",
    overflow: "hidden",
  },
  schoolCard: {
    marginBottom: 12,
    minHeight: 132,
  },
  statusIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 4,
    height: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardFooter: {
    marginTop: "auto",
    paddingTop: 12,
  },
});
