import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
  RefreshControlProps,
} from "react-native";
import { SafeArea } from "./SafeArea";
import { Header } from "./Header";
import { useTheme } from "../../theme/ThemeContext";

interface ScreenProps {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  hideHeader?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  title,
  onBack,
  leftAction,
  rightAction,
  scrollable = false,
  style,
  hideHeader = false,
  refreshControl,
}) => {
  const { colors } = useTheme();
  const shouldShowHeader =
    !hideHeader && Boolean(title || onBack || leftAction || rightAction);

  return (
    <SafeArea style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {shouldShowHeader && (
          <Header
            title={title}
            onBack={onBack}
            leftAction={leftAction}
            rightAction={rightAction}
          />
        )}
        {scrollable ? (
          <ScrollView
            style={[styles.content, { backgroundColor: colors.background }, style]}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[styles.content, { backgroundColor: colors.background }, style]}
          >
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeArea>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
});
