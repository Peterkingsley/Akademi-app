import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";

import { colors } from "../../theme/colors";

interface BrandWordmarkProps {
  style?: StyleProp<TextStyle>;
  iColor?: string;
}

export const BrandWordmark: React.FC<BrandWordmarkProps> = ({ style, iColor = colors.primary }) => {
  return (
    <Text style={[styles.wordmark, style]}>
      Akadem<Text style={{ color: iColor }}>i</Text>
    </Text>
  );
};

const styles = StyleSheet.create({
  wordmark: {
    color: colors.textPrimary,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    letterSpacing: 0,
  },
});
