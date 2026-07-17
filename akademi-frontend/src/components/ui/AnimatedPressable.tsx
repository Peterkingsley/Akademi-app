import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressBounce } from '../../hooks/usePressBounce';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export interface AnimatedPressableProps extends TouchableOpacityProps {
  pressedScale?: number;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  pressedScale = 0.96,
  onPressIn,
  onPressOut,
  style,
  ...props
}) => {
  const { animatedStyle, onPressIn: bounceIn, onPressOut: bounceOut } = usePressBounce(pressedScale);

  const handlePressIn = (e: any) => {
    bounceIn();
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    bounceOut();
    if (onPressOut) onPressOut(e);
  };

  return (
    <AnimatedTouchable
      activeOpacity={0.88}
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
};
