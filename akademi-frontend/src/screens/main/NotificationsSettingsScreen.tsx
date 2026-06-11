import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileCheck2,
  Flame,
  LineChart,
  Sparkles,
} from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const STORAGE_KEY = "@notification_settings";

type CountdownPeriod = "3days" | "1week" | "both";

type NotificationSettings = {
  dailyStudyReminder: boolean;
  studyReminderTime: string;
  examCountdown: boolean;
  examCountdownPeriod: CountdownPeriod;
  weeklySummary: boolean;
  streakAtRisk: boolean;
  newMaterial: boolean;
  uploadVerified: boolean;
  tutorSummary: boolean;
  pauseAll: boolean;
};

const defaultSettings: NotificationSettings = {
  dailyStudyReminder: true,
  studyReminderTime: "07:00 PM",
  examCountdown: true,
  examCountdownPeriod: "both",
  weeklySummary: true,
  streakAtRisk: true,
  newMaterial: true,
  uploadVerified: true,
  tutorSummary: true,
  pauseAll: false,
};

const reminderTimes = ["06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM"];

export const NotificationsSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const activeCount = useMemo(() => {
    if (settings.pauseAll) return 0;
    return [
      settings.dailyStudyReminder,
      settings.examCountdown,
      settings.weeklySummary,
      settings.streakAtRisk,
      settings.newMaterial,
      settings.uploadVerified,
      settings.tutorSummary,
    ].filter(Boolean).length;
  }, [settings]);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      }
    } catch (error) {
      console.error("Failed to load notification settings", error);
    }
  };

  const persistSettings = async (nextSettings: NotificationSettings) => {
    setSettings(nextSettings);
    setSaved(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
    } catch (error) {
      console.error("Failed to save notification settings", error);
    } finally {
      setTimeout(() => setSaved(false), 1200);
    }
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    persistSettings({ ...settings, [key]: !settings[key] });
  };

  const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    persistSettings({ ...settings, [key]: value });
  };

  return (
    <Screen title="Notifications" onBack={() => navigation.goBack()} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            {settings.pauseAll ? (
              <BellOff size={28} color={colors.warning} />
            ) : (
              <Bell size={28} color={colors.primary} />
            )}
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Preference center</Text>
            <Text style={styles.heroTitle}>
              {settings.pauseAll ? "Notifications are paused" : `${activeCount} alerts enabled`}
            </Text>
            <Text style={styles.heroText}>
              Control study nudges, approvals, new materials, tutor summaries, and exam reminders.
            </Text>
          </View>
        </View>

        {saved && (
          <View style={styles.savedRow}>
            <CheckCircle2 size={16} color={colors.success} />
            <Text style={styles.savedText}>Saved on this device</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.pauseCard, settings.pauseAll && styles.pauseCardActive]}
          activeOpacity={0.86}
          onPress={() => toggleSetting("pauseAll")}
        >
          <View style={styles.rowIconWarning}>
            <BellOff size={20} color={settings.pauseAll ? colors.warning : colors.textMuted} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Pause all notifications</Text>
            <Text style={styles.rowSubtitle}>Silence every alert until you turn this off.</Text>
          </View>
          <Toggle value={settings.pauseAll} onValueChange={() => toggleSetting("pauseAll")} />
        </TouchableOpacity>

        <Section title="Study">
          <SettingRow
            icon={<Clock size={20} color={colors.primary} />}
            title="Daily study reminder"
            subtitle={`Send a reminder around ${settings.studyReminderTime}.`}
            value={settings.dailyStudyReminder}
            disabled={settings.pauseAll}
            onToggle={() => toggleSetting("dailyStudyReminder")}
          />
          {settings.dailyStudyReminder && !settings.pauseAll && (
            <View style={styles.inlineOptions}>
              {reminderTimes.map((time) => (
                <OptionPill
                  key={time}
                  label={time}
                  active={settings.studyReminderTime === time}
                  onPress={() => updateSetting("studyReminderTime", time)}
                />
              ))}
            </View>
          )}
          <SettingRow
            icon={<Flame size={20} color={colors.warning} />}
            title="Streak at risk"
            subtitle="Warn students before they lose study momentum."
            value={settings.streakAtRisk}
            disabled={settings.pauseAll}
            badge="Important"
            onToggle={() => toggleSetting("streakAtRisk")}
          />
        </Section>

        <Section title="Exams and progress">
          <SettingRow
            icon={<CalendarClock size={20} color={colors.primary} />}
            title="Exam countdown"
            subtitle="Notify before scheduled exam plans."
            value={settings.examCountdown}
            disabled={settings.pauseAll}
            onToggle={() => toggleSetting("examCountdown")}
          />
          {settings.examCountdown && !settings.pauseAll && (
            <View style={styles.inlineOptions}>
              <OptionPill
                label="3 days"
                active={settings.examCountdownPeriod === "3days"}
                onPress={() => updateSetting("examCountdownPeriod", "3days")}
              />
              <OptionPill
                label="1 week"
                active={settings.examCountdownPeriod === "1week"}
                onPress={() => updateSetting("examCountdownPeriod", "1week")}
              />
              <OptionPill
                label="Both"
                active={settings.examCountdownPeriod === "both"}
                onPress={() => updateSetting("examCountdownPeriod", "both")}
              />
            </View>
          )}
          <SettingRow
            icon={<LineChart size={20} color={colors.primary} />}
            title="Weekly progress summary"
            subtitle="Summarize solved questions, tutor time, uploads, and mocks."
            value={settings.weeklySummary}
            disabled={settings.pauseAll}
            onToggle={() => toggleSetting("weeklySummary")}
          />
        </Section>

        <Section title="Content and tutor">
          <SettingRow
            icon={<Sparkles size={20} color={colors.primary} />}
            title="New verified material"
            subtitle="Alert when approved materials match your courses."
            value={settings.newMaterial}
            disabled={settings.pauseAll}
            onToggle={() => toggleSetting("newMaterial")}
          />
          <SettingRow
            icon={<FileCheck2 size={20} color={colors.primary} />}
            title="Upload approval"
            subtitle="Tell you when an uploaded material becomes public."
            value={settings.uploadVerified}
            disabled={settings.pauseAll}
            onToggle={() => toggleSetting("uploadVerified")}
          />
          <SettingRow
            icon={<Sparkles size={20} color={colors.primary} />}
            title="Tutor session summary"
            subtitle="Notify when Live Tutor generates a session recap."
            value={settings.tutorSummary}
            disabled={settings.pauseAll}
            onToggle={() => toggleSetting("tutorSummary")}
          />
        </Section>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            These preferences are saved on this device for MVP. Push delivery uses the backend notification feed and your registered device token.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

const Toggle = ({ value, onValueChange, disabled }: { value: boolean; onValueChange: () => void; disabled?: boolean }) => (
  <Switch
    value={value}
    disabled={disabled}
    onValueChange={onValueChange}
    trackColor={{ false: colors.border, true: colors.primary }}
    thumbColor={Platform.OS === "ios" ? "#FFFFFF" : value ? "#FFFFFF" : "#F4F3F4"}
  />
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

const SettingRow = ({
  icon,
  title,
  subtitle,
  value,
  onToggle,
  disabled,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  badge?: string;
}) => (
  <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
    <View style={styles.rowIcon}>{icon}</View>
    <View style={styles.rowCopy}>
      <View style={styles.rowTitleLine}>
        <Text style={styles.rowTitle}>{title}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      <Text style={styles.rowSubtitle}>{subtitle}</Text>
    </View>
    <Toggle value={value} disabled={disabled} onValueChange={onToggle} />
  </View>
);

const OptionPill = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[styles.optionPill, active && styles.optionPillActive]} onPress={onPress}>
    <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 36 },
  hero: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(34,197,94,0.22)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 16,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    marginRight: 14,
    width: 52,
  },
  heroCopy: { flex: 1 },
  heroKicker: { ...typography.label, color: colors.primary, fontSize: 9, marginBottom: 4 },
  heroTitle: { ...typography.h3, color: colors.textPrimary, fontSize: 18 },
  heroText: { ...typography.body, color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  savedRow: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 8,
    flexDirection: "row",
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  savedText: { ...typography.bodySmall, color: colors.success, fontSize: 11, marginLeft: 8 },
  pauseCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 24,
    padding: 14,
  },
  pauseCardActive: { backgroundColor: "#1C1710", borderColor: "rgba(245,158,11,0.35)" },
  rowIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  rowIconWarning: {
    alignItems: "center",
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  rowCopy: { flex: 1, marginRight: 12 },
  rowTitleLine: { alignItems: "center", flexDirection: "row", flexWrap: "wrap" },
  rowTitle: { ...typography.h4, color: colors.textPrimary, fontSize: 13, lineHeight: 19 },
  rowSubtitle: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 3 },
  badge: {
    backgroundColor: "rgba(245,158,11,0.16)",
    borderRadius: 8,
    color: colors.warning,
    fontSize: 9,
    fontWeight: "700",
    marginLeft: 8,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  section: { marginBottom: 22 },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: "SpaceMono-Regular",
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 76,
    padding: 14,
  },
  settingRowDisabled: { opacity: 0.48 },
  inlineOptions: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  optionPill: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  optionTextActive: { color: colors.background },
  footerNote: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  footerText: { ...typography.bodySmall, color: colors.textMuted, fontSize: 11, lineHeight: 17 },
});
