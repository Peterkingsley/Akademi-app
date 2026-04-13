import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  leftAction,
  rightAction,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]}>
      <View style={styles.left}>
        {leftAction ? (
          leftAction
        ) : onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.center}>
        {title && <Text style={[styles.title, typography.h3, { color: colors.textPrimary }]}>{title}</Text>}
      </View>
      <View style={styles.right}>{rightAction}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  left: {
    minWidth: 40,
    alignItems: "flex-start",
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  right: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  title: {},
  backButton: {
    padding: 4,
  },
});
