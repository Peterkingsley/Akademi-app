import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { AdminStackParamList } from "./types";
import { AdminDashboardScreen } from "../screens/main/admin/AdminDashboardScreen";
import { UserManagementScreen } from "../screens/main/admin/UserManagementScreen";
import { ContentModerationScreen } from "../screens/main/admin/ContentModerationScreen";

const Stack = createStackNavigator<AdminStackParamList>();

export const AdminStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} />
      <Stack.Screen name="ContentModeration" component={ContentModerationScreen} />
    </Stack.Navigator>
  );
};
