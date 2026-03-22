import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface BadgeProps {
  label: string;
  variant: 'verified' | 'pending' | 'course' | 'ai';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant,
  style,
}) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'verified':
        return styles.verified;
      case 'pending':
        return styles.pending;
      case 'ai':
        return styles.ai;
      case 'course':
        return styles.course;
      default:
        return styles.course;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'course':
        return { color: colors.primary };
      default:
        return { color: '#FFFFFF' };
    }
  };

  return (
    <View style={[styles.base, getVariantStyle(), style]}>
      <Text style={[styles.text, typography.caption, getTextStyle(), { fontWeight: '700' }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verified: {
    backgroundColor: colors.success,
  },
  pending: {
    backgroundColor: colors.warning,
  },
  ai: {
    backgroundColor: colors.accentPurple,
  },
  course: {
    backgroundColor: colors.surfaceElevated,
  },
  text: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
});
