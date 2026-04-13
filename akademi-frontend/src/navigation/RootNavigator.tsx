import React, { useEffect, useState } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { createNavigationContainerRef } from "@react-navigation/native";
import { RootStackParamList } from "./types";
import { AuthStack } from "./AuthStack";
import { MainStack } from "./MainStack";
import { AdminStack } from "./AdminStack";
import { SplashScreen } from "../screens/main/SplashScreen";
import { useAuthStore } from "../store/useAuthStore";

const Stack = createStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef();

if (typeof window !== 'undefined') {
  (window as any).navigationRef = navigationRef;
}

export const RootNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, hasSeenOnboarding } = useAuthStore();

  useEffect(() => {
    // 5. After 2.5 seconds total: navigate to OnboardingScreen
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

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
