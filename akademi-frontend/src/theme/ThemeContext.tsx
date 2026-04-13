import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkPalette, lightPalette } from "./colors";
import { spacing } from "./spacing";
import { typography } from "./typography";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: typeof darkPalette;
  spacing: typeof spacing;
  typography: typeof typography;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const savedTheme = await AsyncStorage.getItem("themeMode");
    if (savedTheme) {
      setThemeModeState(savedTheme as ThemeMode);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem("themeMode", mode);
  };

  const isDark = themeMode === "system"
    ? systemColorScheme === "dark"
    : themeMode === "dark";

  const colors = isDark ? darkPalette : lightPalette;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, colors, spacing, typography, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
