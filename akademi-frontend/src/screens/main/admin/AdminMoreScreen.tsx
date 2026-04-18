import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import {
  BarChart2,
  DollarSign,
  Activity,
  Users2,
  ShieldCheck,
  ChevronRight,
  ShieldAlert
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AdminStackParamList } from "../../../navigation/types";
import { useAuthStore } from "../../../store/useAuthStore";

type NavigationProp = StackNavigationProp<AdminStackParamList, "AdminMore">;

export const AdminMoreScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  const isSuperAdmin = user?.admin_role === 'SUPER_ADMIN';

  const MenuItem = ({ icon: Icon, label, onPress, color = colors.primary, description }: any) => (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${color}10` }]}>
        <Icon size={22} color={color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[typography.body, { fontWeight: "600", color: colors.textPrimary }]}>{label}</Text>
        {description && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{description}</Text>}
      </View>
      <ChevronRight size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <Screen title="More Operations" scrollable>
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.md }]}>PLATFORM MANAGEMENT</Text>
          <View style={[styles.menuGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MenuItem
              icon={BarChart2}
              label="Platform Analytics"
              description="User growth, retention and feature usage"
              onPress={() => navigation.navigate("PlatformAnalytics")}
            />
            {isSuperAdmin && (
              <>
                <MenuItem
                  icon={DollarSign}
                  label="Financial Management"
                  description="Revenue, transactions and projections"
                  onPress={() => navigation.navigate("FinancialManagement")}
                  color="#F59E0B"
                />
                <MenuItem
                  icon={Activity}
                  label="System Monitoring"
                  description="Service health, AI usage and logs"
                  onPress={() => navigation.navigate("SystemMonitoring")}
                  color="#8B5CF6"
                />
              </>
            )}
          </View>
        </View>

        {isSuperAdmin && (
          <View style={styles.section}>
            <View style={styles.securityHeader}>
                <ShieldAlert size={16} color="#EF4444" />
                <Text style={[typography.label, { color: "#EF4444", marginLeft: 8 }]}>SECURITY & TEAM (RESTRICTED)</Text>
            </View>
            <View style={[styles.menuGroup, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: "#EF4444" }]}>
              <MenuItem
                icon={Users2}
                label="Admin Team"
                description="Manage administrative accounts and roles"
                onPress={() => navigation.navigate("AdminTeam")}
                color="#EF4444"
              />
              <MenuItem
                icon={ShieldCheck}
                label="Audit Trail"
                description="Technical activity logs and master feed"
                onPress={() => navigation.navigate("AuditTrail")}
                color="#EF4444"
              />
              <MenuItem
                icon={ShieldCheck}
                label="Security Settings"
                description="2FA, session timeout and IP logs"
                onPress={() => navigation.navigate("SecuritySettings")}
                color="#EF4444"
              />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuGroup: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
});
