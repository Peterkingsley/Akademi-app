import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "./types";
import { HomeScreen } from "../screens/main/HomeScreen";
import { SolveScreen } from "../screens/main/SolveScreen";
import { LibraryScreen } from "../screens/main/LibraryScreen";
import { ProfileScreen } from "../screens/main/ProfileScreen";
import { BottomTabBar } from "../components/navigation/BottomTabBar";

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabs = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Solve" component={SolveScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
