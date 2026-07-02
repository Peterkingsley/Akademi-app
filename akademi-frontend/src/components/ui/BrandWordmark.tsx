import React from "react";
import { Image, ImageStyle, StyleProp, StyleSheet } from "react-native";

const logo = require("../../../assets/branding/akademi-logo.png");

interface BrandWordmarkProps {
  style?: StyleProp<ImageStyle>;
}

export const BrandWordmark: React.FC<BrandWordmarkProps> = ({ style }) => {
  const flattened = (StyleSheet.flatten(style) || {}) as ImageStyle & { fontSize?: number };
  const derivedHeight =
    typeof flattened.height === "number"
      ? flattened.height
      : typeof flattened.fontSize === "number"
        ? Math.max(flattened.fontSize * 1.45, 28)
        : 40;
  const derivedWidth =
    typeof flattened.width === "number"
      ? flattened.width
      : derivedHeight * 2.57;

  return (
    <Image
      source={logo}
      resizeMode="contain"
      accessibilityLabel="Akademi"
      style={[styles.wordmark, { width: derivedWidth, height: derivedHeight }, style]}
    />
  );
};

const styles = StyleSheet.create({
  wordmark: {
    maxWidth: "100%",
  },
});
