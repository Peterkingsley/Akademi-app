import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { Sparkle } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface AIInsightBannerProps {
  text: string;
  style?: ViewStyle;
}

export const AIInsightBanner: React.FC<AIInsightBannerProps> = ({ text, style }) => {
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.glowBorder, animatedBorderStyle]} />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Sparkle size={18} color={colors.primary} fill={colors.primary} />
        </View>
        <Text style={[styles.text, typography.mono]}>{text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D1526', // A slightly darker/more blue variation of the background for AI components
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent', // The real border is handled by the animated view
  },
  glowBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 10,
    marginTop: 2,
  },
  text: {
    flex: 1,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
