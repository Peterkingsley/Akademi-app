import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SessionsScreen } from "../screens/main/SessionsScreen";
import { ProgressScreen } from "../screens/main/ProgressScreen";
import { ProfileScreen } from "../screens/main/ProfileScreen";
import { BottomTabBar } from "../components/navigation/BottomTabBar";

const Tab = createBottomTabNavigator();

export const SessionsTabs = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="SessionsMain" component={SessionsScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
