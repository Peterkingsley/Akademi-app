import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AdminStackParamList } from "./types";
import { AdminDashboardScreen } from "../screens/main/admin/AdminDashboardScreen";
import { UserManagementScreen } from "../screens/main/admin/UserManagementScreen";
import { AdminUserDetailScreen } from "../screens/main/admin/AdminUserDetailScreen";
import { ContentModerationScreen } from "../screens/main/admin/ContentModerationScreen";
import { DisciplineDocumentsScreen } from "../screens/main/admin/DisciplineDocumentsScreen";
import { UploadCcmasDocumentScreen } from "../screens/main/admin/UploadCcmasDocumentScreen";
import { DocumentDetailScreen } from "../screens/main/admin/DocumentDetailScreen";
import { CoverageMapScreen } from "../screens/main/admin/CoverageMapScreen";
import { PlatformAnalyticsScreen } from "../screens/main/admin/PlatformAnalyticsScreen";
import { FinancialManagementScreen } from "../screens/main/admin/FinancialManagementScreen";
import { SystemMonitoringScreen } from "../screens/main/admin/SystemMonitoringScreen";
import { GeneratedTextbooksScreen } from "../screens/main/admin/GeneratedTextbooksScreen";
import { AdminMoreScreen } from "../screens/main/admin/AdminMoreScreen";
import { AdminTeamScreen } from "../screens/main/admin/AdminTeamScreen";
import { AdminWaitlistScreen } from "../screens/main/admin/AdminWaitlistScreen";
import { AdminTournamentsScreen } from "../screens/main/admin/AdminTournamentsScreen";
import { AdminTournamentCreateScreen } from "../screens/main/admin/AdminTournamentCreateScreen";
import { AdminTournamentCampaignsScreen } from "../screens/main/admin/AdminTournamentCampaignsScreen";
import { AdminTournamentRoomsScreen } from "../screens/main/admin/AdminTournamentRoomsScreen";
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
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <PlatformAnalyticsScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="GeneratedTextbooks" component={GeneratedTextbooksScreen} />
      <Stack.Screen name="DisciplineDocuments" component={DisciplineDocumentsScreen} />
      <Stack.Screen name="UploadCcmasDocument" component={UploadCcmasDocumentScreen} />
      <Stack.Screen name="FinancialManagement">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <FinancialManagementScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="SystemMonitoring">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <SystemMonitoringScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="AdminTeam">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <AdminTeamScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="AdminWaitlist">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <AdminWaitlistScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="AdminTournaments">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <AdminTournamentsScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="AdminTournamentCreate">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <AdminTournamentCreateScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="AdminTournamentCampaigns">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <AdminTournamentCampaignsScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="AdminTournamentRooms">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <AdminTournamentRoomsScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="AuditTrail">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <AuditTrailScreen />
          </PermissionGuard>
        )}
      </Stack.Screen>
      <Stack.Screen name="SecuritySettings">
        {() => (
          <PermissionGuard requiredRole="SUPER_ADMIN">
            <SecuritySettingsScreen />
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
      <Stack.Screen name="UploadCcmasDocument" component={UploadCcmasDocumentScreen} />
      <Stack.Screen name="DocumentDetail" component={DocumentDetailScreen} />
      <Stack.Screen name="CoverageMap" component={CoverageMapScreen} />
    </Stack.Navigator>
  );
};

const UsersStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UserManagement" component={UserManagementScreen} />
      <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
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
        component={UsersStack}
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
