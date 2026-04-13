import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import { Palette, Moon, Sun, Monitor } from "lucide-react-native";

export const AppearanceSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [themeMode, setThemeMode] = useState("dark"); // dark, light, system

  return (
    <Screen style={{ flex: 1 }} title="Appearance" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Palette size={40} color={colors.primary} />
          <Text style={styles.title}>Visual Settings</Text>
          <Text style={styles.subtitle}>
            Customize how Akademi looks on your device.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>THEME MODE</Text>
          <View style={styles.themeOptions}>
            <TouchableOpacity
              style={[styles.themeOption, themeMode === "light" && styles.activeOption]}
              onPress={() => setThemeMode("light")}
            >
              <View style={[styles.themePreview, styles.lightPreview]}>
                <Sun size={24} color="#666" />
              </View>
              <Text style={styles.optionLabel}>Light</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeOption, themeMode === "dark" && styles.activeOption]}
              onPress={() => setThemeMode("dark")}
            >
              <View style={[styles.themePreview, styles.darkPreview]}>
                <Moon size={24} color="#FFF" />
              </View>
              <Text style={styles.optionLabel}>Dark</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeOption, themeMode === "system" && styles.activeOption]}
              onPress={() => setThemeMode("system")}
            >
              <View style={[styles.themePreview, styles.systemPreview]}>
                <Monitor size={24} color={colors.textSecondary} />
              </View>
              <Text style={styles.optionLabel}>System</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GENERAL</Text>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <Text style={styles.itemLabel}>OLED Dark Mode</Text>
                <Text style={styles.itemSub}>Pure black background for battery saving</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={setIsDarkMode}
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
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 13,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
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
    borderColor: colors.primary,
  },
  systemPreview: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionLabel: {
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: "Inter-Medium",
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
    fontSize: 14,
  },
  itemSub: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
