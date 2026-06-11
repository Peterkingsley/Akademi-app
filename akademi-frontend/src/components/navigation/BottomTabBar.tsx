import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { BarChart3, Clock3, House, Camera, Library, User } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import * as Haptics from "expo-haptics";

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
    <View style={styles.container}>
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
            {isFocused && <View style={styles.indicator} />}
            {getIcon(route.name, isFocused ? activeColor : inactiveColor)}
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
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  indicator: {
    position: "absolute",
    top: 10,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
