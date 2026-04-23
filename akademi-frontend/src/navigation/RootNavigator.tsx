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

const Stack = createStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef();

if (typeof window !== 'undefined') {
  (window as any).navigationRef = navigationRef;
}

export const RootNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, hasSeenOnboarding } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      const startTime = Date.now();

      if (isAuthenticated) {
        try {
          // Verify session validity on startup
          await userService.getProfile();
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
