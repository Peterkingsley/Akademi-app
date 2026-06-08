import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useNavigation } from "@react-navigation/native";
import { userService, UserProfile } from "../../services/user";
import { GraduationCap, Landmark, BookOpen, Layers, Calendar } from "lucide-react-native";

export const EditAcademicDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [form, setForm] = useState({
    university: "",
    faculty: "",
    department: "",
    level: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await userService.getProfile();
      setProfile(data);
      setForm({
        university: data.university || "",
        faculty: data.faculty || "",
        department: data.department || "",
        level: data.level?.toString() || "",
      });
    } catch (error) {
      Alert.alert("Error", "Failed to fetch profile details");
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!form.university || !form.department || !form.level) {
      Alert.alert("Error", "University, Department and Level are required");
      return;
    }

    setLoading(true);
    try {
      const levelInt = parseInt(form.level.replace(/[^0-9]/g, ""), 10);
      await userService.updateProfile({
        university: form.university,
        faculty: form.faculty,
        department: form.department,
        level: levelInt,
      });
      Alert.alert("Success", "Academic details updated successfully", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert("Error", "Failed to update academic details");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Screen title="Academic Details" onBack={() => navigation.goBack()}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ flex: 1 }} title="Academic Details" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <GraduationCap size={48} color={colors.primary} />
          <Text style={styles.title}>Update Your Info</Text>
          <Text style={styles.subtitle}>
            Keep your academic information up to date to get the best recommendations.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="University"
            placeholder="e.g. University of Lagos"
            value={form.university}
            onChangeText={(text) => setForm({ ...form, university: text })}
            leftIcon={<Landmark size={20} color={colors.textMuted} />}
          />

          <Input
            label="Faculty"
            placeholder="e.g. Engineering"
            value={form.faculty}
            onChangeText={(text) => setForm({ ...form, faculty: text })}
            leftIcon={<BookOpen size={20} color={colors.textMuted} />}
          />

          <Input
            label="Department"
            placeholder="e.g. Computer Engineering"
            value={form.department}
            onChangeText={(text) => setForm({ ...form, department: text })}
            leftIcon={<BookOpen size={20} color={colors.textMuted} />}
          />

          <Input
            label="Level"
            placeholder="e.g. 300"
            value={form.level}
            onChangeText={(text) => setForm({ ...form, level: text })}
            keyboardType="numeric"
            leftIcon={<Layers size={20} color={colors.textMuted} />}
          />

          <Button
            label="Save Changes"
            onPress={handleSave}
            loading={loading}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  form: {
    gap: 16,
  },
  button: {
    marginTop: 16,
  },
});
