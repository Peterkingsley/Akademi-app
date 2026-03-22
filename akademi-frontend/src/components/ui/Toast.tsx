import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning';
  onHide?: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  onHide,
  duration = 3000,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(
        duration,
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished && onHide) {
            runOnJS(onHide)();
          }
        })
      )
    );
    translateY.value = withSequence(
      withTiming(0, { duration: 300 }),
      withDelay(duration, withTiming(20, { duration: 300 }))
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const getBackgroundColor = () => {
    switch (type) {
      case 'error':
        return colors.error;
      case 'warning':
        return colors.warning;
      case 'success':
      default:
        return colors.success;
    }
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: getBackgroundColor() }, animatedStyle]}>
      <Text style={[styles.text, typography.bodySmall, { fontWeight: '600' }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
