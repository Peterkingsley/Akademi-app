import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';

type BadgeVariant = 'verified' | 'pending' | 'course' | 'ai';

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant, style }) => {
  const getBadgeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'verified':
        return {
          container: { backgroundColor: colors.success },
          text: { color: '#FFFFFF' },
        };
      case 'pending':
        return {
          container: { backgroundColor: colors.warning },
          text: { color: '#000000' },
        };
      case 'course':
        return {
          container: { backgroundColor: colors.surfaceElevated },
          text: { color: colors.primary },
        };
      case 'ai':
        return {
          container: { backgroundColor: colors.accentPurple },
          text: { color: '#FFFFFF' },
        };
      default:
        return {
          container: { backgroundColor: colors.surfaceElevated },
          text: { color: colors.textPrimary },
        };
    }
  };

  const { container, text } = getBadgeStyles();

  return (
    <View style={[styles.container, container, style]}>
      <Text style={[styles.text, text]}>{label.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 99,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'Inter-SemiBold',
  },
});
