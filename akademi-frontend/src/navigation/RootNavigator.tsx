import React, { useEffect, useState } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { RootStackParamList } from "./types";
import { AuthStack } from "./AuthStack";
import { MainStack } from "./MainStack";
import { SplashScreen } from "../screens/main/SplashScreen";
import { useAuthStore } from "../store/useAuthStore";

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, hasSeenOnboarding } = useAuthStore();

  useEffect(() => {
    // Simulate splash screen for 2 seconds
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainStack} />
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
