import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  Edge
} from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

interface SafeAreaProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  withBackground?: boolean;
}

export const SafeArea: React.FC<SafeAreaProps> = ({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  style,
  withBackground = true,
}) => {
  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.container,
        withBackground && styles.background,
        style
      ]}
    >
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    backgroundColor: colors.background,
  },
});
