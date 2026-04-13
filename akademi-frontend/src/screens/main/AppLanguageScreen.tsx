import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import { Globe, Check } from "lucide-react-native";

const LANGUAGES = [
  { id: "en", name: "English", sub: "Default" },
  { id: "yo", name: "Yoruba", sub: "Coming Soon" },
  { id: "ha", name: "Hausa", sub: "Coming Soon" },
  { id: "ig", name: "Igbo", sub: "Coming Soon" },
  { id: "fr", name: "French", sub: "Coming Soon" },
];

export const AppLanguageScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [selected, setSelected] = useState("en");

  return (
    <Screen style={{ flex: 1 }} title="App Language" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Globe size={40} color={colors.primary} />
          <Text style={styles.title}>Language Preferences</Text>
          <Text style={styles.subtitle}>
            Select your preferred language for the Akademi interface.
          </Text>
        </View>

        <View style={styles.list}>
          {LANGUAGES.map((lang) => {
            const isSelected = selected === lang.id;
            const isComingSoon = lang.sub === "Coming Soon";

            return (
              <TouchableOpacity
                key={lang.id}
                style={[styles.langItem, isSelected && styles.selectedItem]}
                onPress={() => !isComingSoon && setSelected(lang.id)}
                disabled={isComingSoon}
                activeOpacity={0.7}
              >
                <View style={styles.langInfo}>
                  <Text style={[styles.langName, isSelected && styles.selectedText]}>
                    {lang.name}
                  </Text>
                  <Text style={styles.langSub}>{lang.sub}</Text>
                </View>
                {isSelected && <Check size={20} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
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
  list: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedItem: {
    backgroundColor: "rgba(34, 197, 94, 0.05)",
  },
  langInfo: {
    flex: 1,
  },
  langName: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 15,
  },
  selectedText: {
    color: colors.primary,
  },
  langSub: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    marginTop: 2,
  },
});
