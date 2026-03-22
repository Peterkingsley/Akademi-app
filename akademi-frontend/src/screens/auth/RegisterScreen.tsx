import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleRegister = () => {
    // In a real app, we'd call the API here
    navigation.navigate("EmailVerification", { email: form.email });
  };

  return (
    <Screen onBack={() => navigation.goBack()} title="Akademi">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.headline}>Create your account</Text>
        <Text style={styles.subtext}>Join the community of smart learners</Text>

        <Input
          label="Full Name"
          placeholder="Enter your full name"
          value={form.name}
          onChangeText={(text) => setForm({ ...form, name: text })}
        />

        <Input
          label="Email Address"
          placeholder="Enter your email"
          value={form.email}
          onChangeText={(text) => setForm({ ...form, email: text })}
          keyboardType="email-address"
        />

        <Input
          label="Password"
          placeholder="Create a password"
          value={form.password}
          onChangeText={(text) => setForm({ ...form, password: text })}
          secureTextEntry
        />

        <Button
          label="Create Account"
          onPress={handleRegister}
          style={styles.button}
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 28,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter-Regular",
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    marginTop: 16,
  },
});
