import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { useNavigation } from "@react-navigation/native";

export const EditAcademicDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <Screen style={{ flex: 1 }} title="Edit Academic Details">
      <View style={styles.container}>
        <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>
          Edit Academic Details
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 12 }]}>
          This feature is coming soon. You will be able to update your university, department, and level here.
        </Text>
        <Button
          label="Go Back"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={styles.button}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.background,
  },
  button: {
    marginTop: 32,
    width: "100%",
  },
});
