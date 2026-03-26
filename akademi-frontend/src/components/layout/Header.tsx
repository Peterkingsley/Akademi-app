import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { colors } from "../../theme/colors";
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
  return (
    <View style={[styles.container, style]}>
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
        {title && <Text style={[styles.title, typography.h3]}>{title}</Text>}
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
    backgroundColor: colors.background,
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
  title: {
    color: colors.textPrimary,
  },
  backButton: {
    padding: 4,
  },
});
