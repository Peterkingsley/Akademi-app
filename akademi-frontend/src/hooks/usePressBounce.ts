import { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

// Snappy compression on press-in, playful overshoot on release (low damping lets
// the spring bounce past 1 before settling, like a game button "boing").
const PRESS_IN_SPRING = { damping: 14, stiffness: 420, mass: 0.5 };
const RELEASE_SPRING = { damping: 8, stiffness: 260, mass: 0.6 };

export function usePressBounce(pressedScale = 0.94) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(pressedScale, PRESS_IN_SPRING);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, RELEASE_SPRING);
  };

  return { animatedStyle, onPressIn, onPressOut, scale };
}
