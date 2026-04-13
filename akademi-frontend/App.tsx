import { navigationRef } from './src/navigation/RootNavigator';
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { SpaceMono_400Regular } from "@expo-google-fonts/space-mono";
import * as SplashScreenNative from "expo-splash-screen";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";

// Keep the splash screen visible while we fetch resources
SplashScreenNative.preventAutoHideAsync();

const AppContent = () => {
  const { isDark } = useTheme();

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    "Inter-Regular": Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
    "SpaceMono-Regular": SpaceMono_400Regular,
  });

  useEffect(() => {
    if (fontError) {
      console.error("Font loading error:", fontError);
    }

    if (fontsLoaded || fontError) {
      SplashScreenNative.hideAsync();
    }

    // Safety timeout: hide splash screen after 10 seconds regardless of font state
    const timeout = setTimeout(() => {
      SplashScreenNative.hideAsync();
    }, 10000);

    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
