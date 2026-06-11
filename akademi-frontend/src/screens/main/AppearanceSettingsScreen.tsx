import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CheckCircle2, Monitor, Moon, Smartphone, Sun } from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";

type ThemeMode = "light" | "dark" | "system";

const themeOptions: Array<{
  mode: ThemeMode;
  title: string;
  subtitle: string;
  icon: typeof Sun;
}> = [
  {
    mode: "light",
    title: "Light",
    subtitle: "Bright study view",
    icon: Sun,
  },
  {
    mode: "dark",
    title: "Dark",
    subtitle: "Akademi default",
    icon: Moon,
  },
  {
    mode: "system",
    title: "System",
    subtitle: "Follow phone",
    icon: Monitor,
  },
];

export const AppearanceSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(timer);
  }, [saved]);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    setSaved(true);
  };

  return (
    <Screen
      title="Appearance"
      onBack={() => navigation.goBack()}
      style={{ backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: isDark ? "rgba(34,197,94,0.12)" : "#DCFCE7" }]}>
            {isDark ? <Moon size={28} color={colors.primary} /> : <Sun size={28} color={colors.primary} />}
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroKicker, { color: colors.primary }]}>Display</Text>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
              {isDark ? "Dark mode is active" : "Light mode is active"}
            </Text>
            <Text style={[styles.heroText, { color: colors.textSecondary }]}>
              Choose the look that feels easiest to study with on this device.
            </Text>
          </View>
        </View>

        {saved && (
          <View style={[styles.savedRow, { backgroundColor: isDark ? "rgba(34,197,94,0.1)" : "#DCFCE7" }]}>
            <CheckCircle2 size={16} color={colors.success} />
            <Text style={[styles.savedText, { color: colors.success }]}>Appearance saved</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Theme</Text>
        <View style={styles.themeGrid}>
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const active = themeMode === option.mode;
            return (
              <TouchableOpacity
                key={option.mode}
                activeOpacity={0.86}
                onPress={() => handleThemeChange(option.mode)}
                style={[
                  styles.themeCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.themePreview,
                    option.mode === "light" && styles.previewLight,
                    option.mode === "dark" && styles.previewDark,
                    option.mode === "system" && { backgroundColor: colors.surfaceElevated },
                    active && { borderColor: colors.primary },
                  ]}
                >
                  <Icon size={24} color={active ? colors.primary : colors.textSecondary} />
                  {active && (
                    <View style={[styles.checkDot, { backgroundColor: colors.primary }]}>
                      <CheckCircle2 size={13} color={colors.background} />
                    </View>
                  )}
                </View>
                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>{option.title}</Text>
                <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>{option.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Preview</Text>
        <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.previewTop}>
            <View style={[styles.previewAvatar, { backgroundColor: colors.surfaceElevated }]}>
              <Smartphone size={20} color={colors.primary} />
            </View>
            <View style={styles.previewCopy}>
              <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Akademi screen sample</Text>
              <Text style={[styles.previewSubtitle, { color: colors.textSecondary }]}>
                Cards, text, and controls update immediately.
              </Text>
            </View>
          </View>
          <View style={styles.previewStats}>
            <View style={[styles.previewPill, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.previewPillLabel, { color: colors.textMuted }]}>Theme</Text>
              <Text style={[styles.previewPillValue, { color: colors.textPrimary }]}>{themeMode}</Text>
            </View>
            <View style={[styles.previewPill, { backgroundColor: colors.primary }]}>
              <Text style={[styles.previewPillLabel, { color: colors.background }]}>Status</Text>
              <Text style={[styles.previewPillValue, { color: colors.background }]}>Active</Text>
            </View>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>OLED dark background</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Akademi dark mode already uses a near-black background to reduce eye strain and save battery on OLED screens.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 36 },
  hero: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 16,
  },
  heroIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    marginRight: 14,
    width: 52,
  },
  heroCopy: { flex: 1 },
  heroKicker: { ...typography.label, fontSize: 9, marginBottom: 4 },
  heroTitle: { ...typography.h3, fontSize: 18 },
  heroText: { ...typography.body, fontSize: 12, lineHeight: 18, marginTop: 4 },
  savedRow: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  savedText: { ...typography.bodySmall, fontSize: 11, marginLeft: 8 },
  sectionTitle: {
    fontFamily: "SpaceMono-Regular",
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 8,
    textTransform: "uppercase",
  },
  themeGrid: { flexDirection: "row", gap: 10, marginBottom: 26 },
  themeCard: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  themePreview: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 1,
    height: 78,
    justifyContent: "center",
    marginBottom: 10,
    width: "100%",
  },
  previewLight: { backgroundColor: "#F8FAFC" },
  previewDark: { backgroundColor: "#111111" },
  checkDot: {
    alignItems: "center",
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: 7,
    top: 7,
    width: 20,
  },
  optionTitle: { ...typography.h4, fontSize: 12 },
  optionSubtitle: { ...typography.bodySmall, fontSize: 10, marginTop: 3, textAlign: "center" },
  previewCard: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  previewTop: { alignItems: "center", flexDirection: "row", marginBottom: 16 },
  previewAvatar: {
    alignItems: "center",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    marginRight: 12,
    width: 42,
  },
  previewCopy: { flex: 1 },
  previewTitle: { ...typography.h4, fontSize: 13 },
  previewSubtitle: { ...typography.bodySmall, fontSize: 11, lineHeight: 16, marginTop: 3 },
  previewStats: { flexDirection: "row", gap: 10 },
  previewPill: { borderRadius: 8, flex: 1, padding: 12 },
  previewPillLabel: { ...typography.label, fontSize: 8 },
  previewPillValue: { ...typography.h4, fontSize: 13, marginTop: 5, textTransform: "capitalize" },
  infoCard: { borderRadius: 10, borderWidth: 1, padding: 14 },
  infoTitle: { ...typography.h4, fontSize: 13 },
  infoText: { ...typography.bodySmall, fontSize: 11, lineHeight: 17, marginTop: 5 },
});
