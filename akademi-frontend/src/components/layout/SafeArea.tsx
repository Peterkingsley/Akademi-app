import React from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ViewStyle,
  Platform,
} from "react-native";
import { useTheme } from "../../theme/ThemeContext";

interface SafeAreaProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const SafeArea: React.FC<SafeAreaProps> = ({ children, style }) => {
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }, style]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
});
