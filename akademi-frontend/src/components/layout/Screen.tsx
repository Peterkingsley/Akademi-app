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
  const Content = scrollable ? ScrollView : View;

  return (
    <SafeArea>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
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
    flexGrow: 1,
    paddingBottom: 32,
  },
});
