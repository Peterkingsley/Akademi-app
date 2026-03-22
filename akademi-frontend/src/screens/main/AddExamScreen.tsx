import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { useNavigation } from "@react-navigation/native";

export const AddExamScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <Screen title="AddExamScreen">
      <View style={styles.container}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>
          AddExamScreen
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
    marginTop: 20,
    width: "100%",
  },
});
