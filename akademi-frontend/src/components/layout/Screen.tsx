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
import { colors } from "../../theme/colors";

interface ScreenProps {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  title,
  onBack,
  rightAction,
  scrollable = false,
  style,
}) => {
  const Content = scrollable ? ScrollView : View;

  return (
    <SafeArea>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Header title={title} onBack={onBack} rightAction={rightAction} />
        <Content
          style={[styles.content, style]}
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
    paddingBottom: 24,
  },
});
