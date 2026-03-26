import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Clock, BellOff } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Badge } from "../../components/ui/Badge";

const STORAGE_KEY = "@notification_settings";

export const NotificationsSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [settings, setSettings] = useState({
    dailyStudyReminder: true,
    studyReminderTime: "07:00 PM",
    examCountdown: true,
    examCountdownPeriod: "both" as "3days" | "1week" | "both",
    weeklySummary: false,
    streakAtRisk: true,
    newMaterial: true,
    uploadVerified: false,
    pauseAll: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  };

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  };

  const toggleSetting = (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const updateSetting = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  return (
    <Screen
      title="Notifications"
      onBack={() => navigation.goBack()}
      scrollable
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>

        {/* STUDY REMINDERS */}
        <Section label="STUDY REMINDERS">
          <SettingRow
            label="Daily study reminder"
            subtext="'Hey [Name], time to study!'"
            value={settings.dailyStudyReminder}
            onToggle={() => toggleSetting("dailyStudyReminder")}
          />
          {settings.dailyStudyReminder && (
            <View style={styles.subRow}>
              <View style={styles.timePickerRow}>
                <Clock size={16} color={colors.textSecondary} />
                <Text style={styles.timePickerLabel}>Scheduled for</Text>
                <TouchableOpacity style={styles.timePill}>
                  <Text style={styles.timePillText}>{settings.studyReminderTime}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Section>

        {/* EXAM & PROGRESS */}
        <Section label="EXAM & PROGRESS">
          <SettingRow
            label="Exam countdown alerts"
            value={settings.examCountdown}
            onToggle={() => toggleSetting("examCountdown")}
          />
          {settings.examCountdown && (
            <View style={styles.optionsRow}>
              <OptionPill
                label="3 days before"
                active={settings.examCountdownPeriod === "3days"}
                onPress={() => updateSetting("examCountdownPeriod", "3days")}
              />
              <OptionPill
                label="1 week before"
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
            label="Weekly progress summary"
            value={settings.weeklySummary}
            onToggle={() => toggleSetting("weeklySummary")}
          />
          <SettingRow
            label="Streak at risk alerts"
            value={settings.streakAtRisk}
            onToggle={() => toggleSetting("streakAtRisk")}
            rightElement={<Badge label="CRUCIAL" variant="warning" style={styles.crucialBadge} />}
          />
        </Section>

        {/* COMMUNITY & CONTENT */}
        <Section label="COMMUNITY & CONTENT">
          <SettingRow
            label="New verified material"
            subtext="Get notified when study guides for your enrolled courses are updated"
            value={settings.newMaterial}
            onToggle={() => toggleSetting("newMaterial")}
          />
          <SettingRow
            label="Upload verified notification"
            value={settings.uploadVerified}
            onToggle={() => toggleSetting("uploadVerified")}
          />
        </Section>

        {/* PAUSE ALL */}
        <TouchableOpacity
          style={styles.pauseCard}
          activeOpacity={0.8}
          onPress={() => toggleSetting("pauseAll")}
        >
          <View style={styles.pauseLeft}>
            <View style={styles.pauseIconWrapper}>
              <BellOff size={20} color={colors.textMuted} />
            </View>
            <View>
              <Text style={styles.pauseTitle}>Pause all notifications</Text>
              <Text style={styles.pauseSubtext}>Silence all study and alert activity</Text>
            </View>
          </View>
          <Switch
            value={settings.pauseAll}
            onValueChange={() => toggleSetting("pauseAll")}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : settings.pauseAll ? colors.primary : '#F4F3F4'}
          />
        </TouchableOpacity>

      </ScrollView>
    </Screen>
  );
};

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>{label}</Text>
    <View style={styles.sectionContent}>
      {children}
    </View>
  </View>
);

const SettingRow: React.FC<{
  label: string;
  subtext?: string;
  value: boolean;
  onToggle: () => void;
  rightElement?: React.ReactNode;
}> = ({ label, subtext, value, onToggle, rightElement }) => (
  <View style={styles.settingRow}>
    <View style={styles.settingLeft}>
      <View style={styles.settingTitleRow}>
        <Text style={styles.settingLabel}>{label}</Text>
        {rightElement}
      </View>
      {subtext && <Text style={styles.settingSubtext}>{subtext}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : value ? colors.primary : '#F4F3F4'}
    />
  </View>
);

const OptionPill: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.optionPill, active && styles.optionPillActive]}
    onPress={onPress}
  >
    <Text style={[styles.optionPillText, active && styles.optionPillTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontFamily: "SpaceMono-Regular",
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
    marginLeft: 4,
  },
  sectionContent: {
    gap: 20,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLeft: {
    flex: 1,
    marginRight: 16,
  },
  settingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  settingSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  subRow: {
    marginTop: -8,
    marginLeft: 0,
  },
  timePickerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timePickerLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    marginRight: 12,
  },
  timePill: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timePillText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  optionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: -8,
  },
  optionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  optionPillTextActive: {
    color: "#FFFFFF",
  },
  crucialBadge: {
    marginLeft: 8,
    backgroundColor: "#F59E0B",
  },
  pauseCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1C1A10",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    padding: 16,
    marginTop: 8,
  },
  pauseLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },
  pauseIconWrapper: {
    marginRight: 12,
  },
  pauseTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pauseSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
