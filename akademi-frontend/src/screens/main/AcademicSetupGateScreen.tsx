import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { GraduationCap } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { useAcademicSetupStore } from "../../store/useAcademicSetupStore";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export const AcademicSetupGateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const setPendingDestination = useAcademicSetupStore((state) => state.setPendingDestination);
  const deferGateOnce = useAcademicSetupStore((state) => state.deferGateOnce);

  useEffect(() => {
    if (route.params?.destination) setPendingDestination(route.params.destination);
  }, [route.params?.destination, setPendingDestination]);

  return (
    <Screen scrollable title="Finish setup" onBack={() => navigation.goBack()}>
      <View style={styles.container}>
        <View style={styles.icon}><GraduationCap size={34} color={colors.primary} /></View>
        <Text style={styles.title}>Finish setting up your Akademi</Text>
        <Text style={styles.body}>We need to know where you study so Akademi can find the right courses, materials and past questions for you.</Text>
        <Text style={styles.note}>Takes about 30 seconds.</Text>
        <Button label="Set up my school" onPress={() => navigation.navigate("AcademicSetup")} style={styles.primary} />
        <Button label="Not now" variant="secondary" onPress={() => { deferGateOnce(); navigation.goBack(); }} style={styles.secondary} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 }, icon: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(34,197,94,0.14)", borderRadius: 24, height: 64, justifyContent: "center", marginBottom: 22, width: 64 },
  title: { ...typography.h2, color: colors.textPrimary, lineHeight: 30 }, body: { ...typography.body, color: colors.textSecondary, lineHeight: 23, marginTop: 12 }, note: { ...typography.bodySmall, color: colors.primary, fontWeight: "700", marginTop: 12 }, primary: { marginTop: 30 }, secondary: { marginTop: 12 },
});
