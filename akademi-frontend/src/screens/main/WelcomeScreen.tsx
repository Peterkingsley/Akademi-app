import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Sparkles } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const handleExplore = () => {
    updateUser({ showWelcome: false });
    navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
  };

  return (
    <Screen scrollable title="Welcome">
      <View style={styles.container}>
        <View style={styles.icon}><Sparkles size={34} color={colors.primary} /></View>
        <Text style={styles.title}>Welcome to Akademi, {user?.name?.split(" ")[0] || "there"}.</Text>
        <Text style={styles.body}>Your study space is ready. Explore the app, then tell us about your school when you’re ready to start learning.</Text>
        <Button label="Explore Akademi" onPress={handleExplore} style={styles.button} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 }, icon: { alignItems: "center", backgroundColor: "rgba(34,197,94,0.14)", borderRadius: 24, height: 64, justifyContent: "center", marginBottom: 22, width: 64 }, title: { ...typography.h2, color: colors.textPrimary, lineHeight: 31 }, body: { ...typography.body, color: colors.textSecondary, lineHeight: 23, marginTop: 12 }, button: { marginTop: 30 },
});
