import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import { Check, Globe } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGUAGES = [
  { id: "en", name: "English", nativeName: "English" },
  { id: "yo", name: "Yoruba", nativeName: "Yorùbá" },
  { id: "ha", name: "Hausa", nativeName: "Hausa" },
  { id: "ig", name: "Igbo", nativeName: "Asụsụ Igbo" },
  { id: "fr", name: "French", nativeName: "Français" },
];

export const AppLanguageScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [selected, setSelected] = useState("en");

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    const lang = await AsyncStorage.getItem("appLanguage");
    if (lang) setSelected(lang);
  };

  const handleSelect = async (id: string) => {
    setSelected(id);
    await AsyncStorage.setItem("appLanguage", id);
    // In a real app, you would trigger an i18n reload here
  };

  return (
    <Screen style={{ flex: 1 }} title="App Language" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Globe size={32} color={colors.primary} />
          </View>
          <Text style={styles.subtitle}>
            Select your preferred language for the Akademi interface. This will not affect the language of your course materials.
          </Text>
        </View>

        <View style={styles.list}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.id}
              style={[styles.item, selected === lang.id && styles.itemSelected]}
              onPress={() => handleSelect(lang.id)}
            >
              <View>
                <Text style={styles.langName}>{lang.name}</Text>
                <Text style={styles.nativeName}>{lang.nativeName}</Text>
              </View>
              {selected === lang.id && <Check size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
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
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemSelected: {
    backgroundColor: colors.surfaceElevated,
  },
  langName: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  nativeName: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
