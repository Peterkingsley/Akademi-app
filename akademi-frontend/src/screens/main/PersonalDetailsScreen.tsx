import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CalendarDays, LockKeyhole } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { Card } from "../../components/ui/Card";
import { userService } from "../../services/user";
import { useTheme } from "../../theme/ThemeContext";

export const PersonalDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, typeScale, radius } = useTheme();
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [alreadySet, setAlreadySet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void userService.getProfile().then((profile) => {
      if (profile.date_of_birth) {
        setDateOfBirth(profile.date_of_birth.slice(0, 10));
        setAlreadySet(true);
      }
    }).catch(() => Alert.alert("Profile unavailable", "Could not load your personal details."))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return Alert.alert("Invalid date", "Enter your date of birth as YYYY-MM-DD, for example 2003-08-21.");
    try {
      setSaving(true);
      await userService.updateProfile({ date_of_birth: dateOfBirth });
      Alert.alert("Date of birth saved", "Your age can now be checked when you sell Koin.", [{ text: "Continue", onPress: () => navigation.goBack() }]);
    } catch (error: any) {
      Alert.alert("Unable to save", error?.response?.data?.message || "Check the date and try again.");
    } finally { setSaving(false); }
  };

  return (
    <Screen title="Personal Details" onBack={() => navigation.goBack()} style={{ backgroundColor: colors.bg.canvas }}>
      <View style={styles.content}>
        <Card elevated style={[styles.card, { borderRadius: radius.lg }]}>
          <View style={[styles.icon, { backgroundColor: colors.brand.subtle }]}><CalendarDays size={25} color={colors.brand.foreground} /></View>
          <Text style={[typeScale.h3, { color: colors.fg.primary }]}>Date of birth</Text>
          <Text style={[typeScale.secondary, styles.centerText, { color: colors.fg.secondary }]}>Required to confirm that you are 18 or older before Koin payouts.</Text>
          {loading ? <ActivityIndicator color={colors.brand.foreground} /> : <TextInput editable={!alreadySet} value={dateOfBirth} onChangeText={(value) => setDateOfBirth(value.replace(/[^0-9-]/g, "").slice(0, 10))} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.fg.muted} style={[styles.input, { color: colors.fg.primary, borderColor: colors.borderRoles.default, backgroundColor: alreadySet ? colors.bg.surfaceRaised : colors.bg.surface }]} />}
          {alreadySet ? <View style={styles.locked}><LockKeyhole size={16} color={colors.fg.muted} /><Text style={[typeScale.caption, { color: colors.fg.muted, flex: 1 }]}>For payout security, contact support if this date needs correction.</Text></View> : <Pressable disabled={saving || loading} onPress={() => void save()} style={[styles.button, { backgroundColor: colors.brand.fill, borderRadius: radius.md }]}>{saving ? <ActivityIndicator color={colors.brand.onFill} /> : <Text style={[typeScale.bodyStrong, { color: colors.brand.onFill }]}>Save date of birth</Text>}</Pressable>}
        </Card>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({ content: { padding: 16 }, card: { padding: 22, alignItems: "center", gap: 13 }, icon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" }, centerText: { textAlign: "center" }, input: { width: "100%", height: 54, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, textAlign: "center", fontSize: 17 }, button: { width: "100%", minHeight: 52, alignItems: "center", justifyContent: "center" }, locked: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8 } });
