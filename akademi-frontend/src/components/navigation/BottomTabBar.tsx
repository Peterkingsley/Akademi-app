import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { BarChart3, Clock3, House, Camera, Library, User } from "lucide-react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import * as Haptics from "expo-haptics";

const INDICATOR_WIDTH = 28;
const INDICATOR_SPRING = { damping: 16, stiffness: 260, mass: 0.7 };
const ICON_SPRING = { damping: 8, stiffness: 300, mass: 0.5 };
const LIFT_SPRING = { damping: 10, stiffness: 260, mass: 0.5 };

const TabIcon: React.FC<{ focused: boolean; children: React.ReactNode }> = ({ focused, children }) => {
  const scale = useSharedValue(focused ? 1.15 : 1);
  const translateY = useSharedValue(focused ? -3 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, ICON_SPRING);
    translateY.value = withSpring(focused ? -3 : 0, LIFT_SPRING);
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

interface BottomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { colors } = useTheme();
  const [tabWidth, setTabWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      const target = state.index * tabWidth + tabWidth / 2 - INDICATOR_WIDTH / 2;
      indicatorX.value = withSpring(target, INDICATOR_SPRING);
    }
  }, [state.index, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const getIcon = (name: string, color: string) => {
    switch (name) {
      case "Home":
        return <House size={24} color={color} />;
      case "Solve":
        return <Camera size={24} color={color} />;
      case "Library":
        return <Library size={24} color={color} />;
      case "SessionsMain":
        return <Clock3 size={24} color={color} />;
      case "Progress":
        return <BarChart3 size={24} color={color} />;
      case "Profile":
        return <User size={24} color={color} />;
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}
      onLayout={(event) => setTabWidth(event.nativeEvent.layout.width / state.routes.length)}
    >
      {tabWidth > 0 && (
        <Animated.View
          style={[styles.slidingIndicator, { backgroundColor: colors.primary }, indicatorStyle]}
        />
      )}
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        const activeColor = colors.primary;
        const inactiveColor = colors.textMuted;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.8}
          >
            <TabIcon focused={isFocused}>
              {getIcon(route.name, isFocused ? activeColor : inactiveColor)}
            </TabIcon>
            <Text
              style={[
                styles.label,
                typography.caption,
                { color: isFocused ? activeColor : inactiveColor },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    height: Platform.OS === "ios" ? 88 : 64,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 24 : 0,
  },
  tabItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    marginTop: 4,
  },
  slidingIndicator: {
    position: "absolute",
    top: 0,
    width: INDICATOR_WIDTH,
    height: 3,
    borderRadius: 2,
  },
});
