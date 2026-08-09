import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkPalette, lightPalette } from "./colors";
import { typography, typeScale } from "./typography";
import { spacing, space } from "./spacing";
import { breakpoint, borderWidth, contentWidth, controlSize, elevation, iconSize, motion, radius } from "./foundations";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: typeof darkPalette;
  typography: typeof typography;
  typeScale: typeof typeScale;
  spacing: typeof spacing;
  space: typeof space;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  controlSize: typeof controlSize;
  iconSize: typeof iconSize;
  motion: typeof motion;
  breakpoint: typeof breakpoint;
  contentWidth: typeof contentWidth;
  elevation: typeof elevation;
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
    <ThemeContext.Provider value={{
      themeMode,
      setThemeMode,
      colors,
      typography,
      typeScale,
      spacing,
      space,
      radius,
      borderWidth,
      controlSize,
      iconSize,
      motion,
      breakpoint,
      contentWidth,
      elevation,
      isDark,
    }}>
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
