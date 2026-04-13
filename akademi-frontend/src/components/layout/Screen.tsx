import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
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
}) => {
  const { colors } = useTheme();
  const Content = scrollable ? ScrollView : View;

  return (
    <SafeArea style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {!hideHeader && (
          <Header
            title={title}
            onBack={onBack}
            leftAction={leftAction}
            rightAction={rightAction}
          />
        )}
        <Content
          style={[styles.content, { backgroundColor: colors.background }, style]}
          contentContainerStyle={scrollable ? styles.scrollContent : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </Content>
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
