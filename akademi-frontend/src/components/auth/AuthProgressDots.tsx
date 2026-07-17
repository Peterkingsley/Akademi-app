import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../../theme/colors";

interface AuthProgressDotsProps {
  step: number;
  total: number;
}

export const AuthProgressDots: React.FC<AuthProgressDotsProps> = ({ step, total }) => {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
    >
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[styles.dot, index === step - 1 && styles.activeDot]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1F2937",
    marginLeft: 4,
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 12,
  },
});
