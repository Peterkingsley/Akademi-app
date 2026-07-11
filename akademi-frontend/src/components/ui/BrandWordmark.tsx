import React from "react";
import { Image, ImageStyle, StyleProp, StyleSheet, TextStyle } from "react-native";

const logo = require("../../../assets/branding/akademi-logo.png");

interface BrandWordmarkProps {
  // Callers pass typography presets (fontSize, fontFamily, fontWeight, color) so this component
  // can derive an image size that matches nearby text - only width/height ever reach the
  // underlying <Image>, so the prop accepts TextStyle shapes too, not just ImageStyle.
  style?: StyleProp<ImageStyle | TextStyle>;
}

export const BrandWordmark: React.FC<BrandWordmarkProps> = ({ style }) => {
  const flattened = (StyleSheet.flatten(style) || {}) as ImageStyle & TextStyle;
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
      style={[styles.wordmark, { width: derivedWidth, height: derivedHeight }, style as StyleProp<ImageStyle>]}
    />
  );
};

const styles = StyleSheet.create({
  wordmark: {
    maxWidth: "100%",
  },
});
