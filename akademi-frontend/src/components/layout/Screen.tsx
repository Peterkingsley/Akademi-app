import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';
import { SafeArea } from './SafeArea';
import { Header } from './Header';
import { colors } from '../../theme/colors';

interface ScreenProps {
  children: React.ReactNode;
  headerTitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  safeAreaEdges?: any[];
  onBackPress?: () => void;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  headerTitle,
  showBack = false,
  rightAction,
  scrollable = false,
  style,
  contentContainerStyle,
  safeAreaEdges,
  onBackPress,
}) => {
  const Content = scrollable ? ScrollView : View;

  return (
    <SafeArea edges={safeAreaEdges} style={[styles.container, style]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {(headerTitle || showBack || rightAction) && (
        <Header
          title={headerTitle}
          showBack={showBack}
          rightAction={rightAction}
          onBackPress={onBackPress}
        />
      )}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Content
          style={styles.content}
          contentContainerStyle={[
            scrollable && styles.scrollContent,
            contentContainerStyle
          ]}
          showsVerticalScrollIndicator={false}
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
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
});
