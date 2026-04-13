import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from "react-native";
import { Screen } from "../../components/layout/Screen";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import { Monitor, Sun, Moon } from "lucide-react-native";

export const AppearanceSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  return (
    <Screen
      title="Appearance"
      onBack={() => navigation.goBack()}
      style={{ backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={[styles.darkPreview, { backgroundColor: isDark ? colors.surfaceElevated : "#E5E7EB" }]}>
            <Sun size={32} color={isDark ? colors.textMuted : colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Choose your vibe</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Customize how Akademi looks on your device.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>THEME</Text>
          <View style={styles.themeOptions}>
            <TouchableOpacity
              style={[styles.themeOption, themeMode === "light" && styles.activeOption]}
              onPress={() => setThemeMode("light")}
            >
              <View style={[styles.themePreview, styles.lightPreview, themeMode === "light" && { borderColor: colors.primary }]}>
                <Sun size={24} color={themeMode === "light" ? colors.primary : colors.textSecondary} />
              </View>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>Light</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeOption, themeMode === "dark" && styles.activeOption]}
              onPress={() => setThemeMode("dark")}
            >
              <View style={[styles.themePreview, styles.darkPreview, themeMode === "dark" && { borderColor: colors.primary }]}>
                <Moon size={24} color={themeMode === "dark" ? colors.primary : colors.textSecondary} />
              </View>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>Dark</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeOption, themeMode === "system" && styles.activeOption]}
              onPress={() => setThemeMode("system")}
            >
              <View style={[styles.themePreview, styles.systemPreview, { backgroundColor: colors.surface, borderColor: themeMode === "system" ? colors.primary : colors.border }]}>
                <Monitor size={24} color={themeMode === "system" ? colors.primary : colors.textSecondary} />
              </View>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>System</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>GENERAL</Text>
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>OLED Dark Mode</Text>
                <Text style={[styles.itemSub, { color: colors.textMuted }]}>Pure black background for battery saving</Text>
              </View>
              <Switch
                value={isDark}
                disabled
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    ...typography.h2,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    textAlign: "center",
    fontSize: 13,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    marginBottom: 16,
    letterSpacing: 1,
  },
  themeOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  activeOption: {
    opacity: 1,
  },
  themePreview: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  lightPreview: {
    backgroundColor: "#F4F4F5",
  },
  darkPreview: {
    backgroundColor: "#18181B",
  },
  systemPreview: {
    borderWidth: 1,
  },
  optionLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
  },
  list: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  listItemLeft: {
    flex: 1,
    marginRight: 16,
  },
  itemLabel: {
    ...typography.h3,
    fontSize: 14,
  },
  itemSub: {
    ...typography.body,
    fontSize: 11,
    marginTop: 2,
  },
});
