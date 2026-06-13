import React, { useEffect, useState } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { createNavigationContainerRef } from "@react-navigation/native";
import { RootStackParamList } from "./types";
import { AuthStack } from "./AuthStack";
import { MainStack } from "./MainStack";
import { AdminStack } from "./AdminStack";
import { SplashScreen } from "../screens/main/SplashScreen";
import { useAuthStore } from "../store/useAuthStore";
import { userService } from "../services/user";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const Stack = createStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef();
const EAS_PROJECT_ID = "d1d7eb95-0f0a-44e4-b839-7f19fa7ef667";

if (typeof window !== 'undefined') {
  (window as any).navigationRef = navigationRef;
}

export const RootNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, updateUser, clearAuth } = useAuthStore();

  const registerForPushNotificationsAsync = async () => {
    try {
      if (!Device.isDevice) return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#22C55E",
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return;

      const token = (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
      await userService.updatePushToken(token);
    } catch (error) {
      console.warn("Push notifications are not configured for this build yet:", error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const startTime = Date.now();

      if (isAuthenticated) {
        try {
          const accessToken = await AsyncStorage.getItem("accessToken");
          const refreshToken = await AsyncStorage.getItem("refreshToken");

          if (!accessToken || !refreshToken) {
            clearAuth();
            throw new Error("No stored login session");
          }

          // Verify session validity on startup
          const profile = await userService.getProfile();
          updateUser(profile);
          // Register for push notifications
          registerForPushNotificationsAsync().catch(console.error);
        } catch (error) {
          clearAuth();
          console.error("Auth verification failed on startup:", error);
        }
      }

      // Ensure splash shows for at least 2.5s
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 2500 - elapsed);

      setTimeout(() => {
        setIsLoading(false);
      }, remaining);
    };

    initializeAuth();
  }, [clearAuth, isAuthenticated, updateUser]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainStack} />
          <Stack.Screen name="Admin" component={AdminStack} />
        </>
      ) : (
        <Stack.Screen
          name="Auth"
          component={AuthStack}
          initialParams={{ screen: "Login" }}
        />
      )}
    </Stack.Navigator>
  );
};
