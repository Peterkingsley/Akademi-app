import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import { WifiOff } from "lucide-react-native";

export const OfflineDownloadsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <Screen style={{ flex: 1 }} title="Offline Downloads" onBack={() => navigation.goBack()}>
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.iconWrapper}>
            <WifiOff size={48} color={colors.textMuted} />
          </View>
          <Text style={styles.title}>No Offline Content</Text>
          <Text style={styles.subtitle}>
            Materials you download for offline use will appear here. You can access them even without an internet connection.
          </Text>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 14,
  },
});
