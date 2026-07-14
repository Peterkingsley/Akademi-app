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
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { clearSentryUserContext, initSentry, Sentry, setSentryRouteTag, setSentryUserContext } from "./src/lib/sentry";
import { useAuthStore } from "./src/store/useAuthStore";

// Keep the splash screen visible while we fetch resources
SplashScreenNative.preventAutoHideAsync();
initSentry();

const AppContent = () => {
  const { isDark } = useTheme();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      setSentryUserContext({
        id: user.id,
        role: user.admin_role || null,
        isAdmin: Boolean(user.admin_role),
      });
    } else {
      clearSentryUserContext();
    }
  }, [user]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => setSentryRouteTag(navigationRef.getCurrentRoute()?.name)}
      onStateChange={() => setSentryRouteTag(navigationRef.getCurrentRoute()?.name)}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
};

function App() {
  const [fontsLoaded, fontError] = useFonts({
    "Inter-Regular": Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
    "SpaceMono-Regular": SpaceMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreenNative.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
