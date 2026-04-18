import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AdminStackParamList } from "./types";
import { AdminDashboardScreen } from "../screens/main/admin/AdminDashboardScreen";
import { UserManagementScreen } from "../screens/main/admin/UserManagementScreen";
import { ContentModerationScreen } from "../screens/main/admin/ContentModerationScreen";
import { DisciplineDocumentsScreen } from "../screens/main/admin/DisciplineDocumentsScreen";
import { DocumentDetailScreen } from "../screens/main/admin/DocumentDetailScreen";
import { CoverageMapScreen } from "../screens/main/admin/CoverageMapScreen";
import { PlatformAnalyticsScreen } from "../screens/main/admin/PlatformAnalyticsScreen";
import { FinancialManagementScreen } from "../screens/main/admin/FinancialManagementScreen";
import { SystemMonitoringScreen } from "../screens/main/admin/SystemMonitoringScreen";
import { AdminMoreScreen } from "../screens/main/admin/AdminMoreScreen";
import { AdminTeamScreen } from "../screens/main/admin/AdminTeamScreen";
import { AuditTrailScreen } from "../screens/main/admin/AuditTrailScreen";
import { SecuritySettingsScreen } from "../screens/main/admin/SecuritySettingsScreen";

import { LayoutDashboard, Users, Shield, Brain, Settings } from "lucide-react-native";
import { useTheme } from "../theme/ThemeContext";
import { PermissionGuard } from "../components/auth/PermissionGuard";

const Stack = createStackNavigator<AdminStackParamList>();
const Tab = createBottomTabNavigator();

const MoreStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminMore" component={AdminMoreScreen} />
      <Stack.Screen name="PlatformAnalytics">
        {(props) => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <PlatformAnalyticsScreen {...props} />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="FinancialManagement">
        {(props) => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <FinancialManagementScreen {...props} />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="SystemMonitoring">
        {(props) => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <SystemMonitoringScreen {...props} />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="AdminTeam">
        {(props) => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <AdminTeamScreen {...props} />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="AuditTrail">
        {(props) => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <AuditTrailScreen {...props} />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="SecuritySettings">
        {(props) => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <SecuritySettingsScreen {...props} />
          </PermissionGuard>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

const DocumentsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DisciplineDocuments" component={DisciplineDocumentsScreen} />
      <Stack.Screen name="DocumentDetail" component={DocumentDetailScreen} />
      <Stack.Screen name="CoverageMap" component={CoverageMapScreen} />
    </Stack.Navigator>
  );
};

export const AdminStack = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Users"
        component={UserManagementScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Moderation"
        component={ContentModerationScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Shield size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsStack}
        options={{
          tabBarIcon: ({ color, size }) => <Brain size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
