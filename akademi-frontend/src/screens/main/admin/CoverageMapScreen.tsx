import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, DepartmentCoverage } from "../../../services/adminService";
import { Shield, ShieldAlert, ShieldCheck, AlertCircle } from "lucide-react-native";
import { Card } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/Skeleton";

export const CoverageMapScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [coverage, setCoverage] = useState<DepartmentCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoverage();
  }, []);

  const fetchCoverage = async () => {
    try {
      setLoading(true);
      const data = await adminService.getDepartmentCoverage();
      setCoverage(data);
    } catch (error) {
      console.error("Failed to fetch coverage", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "#AFE607";
      case "outdated": return "#F59E0B";
      case "missing": return "#EF4444";
      default: return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return ShieldCheck;
      case "outdated": return AlertCircle;
      case "missing": return ShieldAlert;
      default: return Shield;
    }
  };

  const renderItem = ({ item }: { item: DepartmentCoverage }) => {
    const color = getStatusColor(item.status);
    const Icon = getStatusIcon(item.status);

    return (
      <Card style={StyleSheet.flatten([styles.coverageCard, { borderColor: color + "40" }])}>
        <View style={[styles.statusIndicator, { backgroundColor: color }]} />
        <View style={styles.cardHeader}>
          <Icon size={20} color={color} />
          <Text style={[typography.caption, { color, fontWeight: '900', marginLeft: 6, textTransform: 'uppercase' }]}>
            {item.status}
          </Text>
        </View>
        <Text style={[typography.body, { fontWeight: '700', color: colors.textPrimary, marginTop: 8 }]} numberOfLines={1}>
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

  return (
    <Screen title="Knowledge Coverage" scrollable={false}>
      <View style={styles.legend}>
        <LegendItem label="Active" color="#AFE607" />
        <LegendItem label="Outdated" color="#F59E0B" />
        <LegendItem label="Missing" color="#EF4444" />
      </View>

      {loading ? (
        <View style={styles.grid}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} width="48%" height={120} borderRadius={16} style={{ marginBottom: 16 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={coverage}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
        />
      )}
    </Screen>
  );
};

const LegendItem = ({ label, color }: any) => {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 16,
    gap: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
  },
  listContent: {
    padding: 16,
  },
  row: {
    justifyContent: "space-between",
  },
  coverageCard: {
    width: "48%",
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statusIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 4,
    borderBottomLeftRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  }
});

