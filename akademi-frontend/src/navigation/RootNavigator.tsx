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

const Stack = createStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef();

if (typeof window !== 'undefined') {
  (window as any).navigationRef = navigationRef;
}

export const RootNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, hasSeenOnboarding, updateUser } = useAuthStore();

  const registerForPushNotificationsAsync = async () => {
    if (!Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await userService.updatePushToken(token);

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const startTime = Date.now();

      if (isAuthenticated) {
        try {
          // Verify session validity on startup
          const profile = await userService.getProfile();
          updateUser(profile);
          // Register for push notifications
          registerForPushNotificationsAsync().catch(console.error);
        } catch (error) {
          // If profile fetch fails, the API interceptor will have called clearAuth()
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
  }, [isAuthenticated]);

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
          initialParams={
            !hasSeenOnboarding ? { screen: "Onboarding" } : { screen: "Login" }
          }
        />
      )}
    </Stack.Navigator>
  );
};
