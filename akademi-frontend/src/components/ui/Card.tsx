import React from "react";
import { TouchableOpacity, View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  onPress?: () => void;
  bordered?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  elevated = false,
  onPress,
  bordered = true,
}) => {
  const { colors } = useTheme();
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
        },
        bordered && styles.bordered,
        style,
      ]}
    >
      {children}
    </Container>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    padding: 16,
    overflow: "hidden",
  },
  bordered: {
    borderWidth: 1,
  },
});
