import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Bot,
  BookOpen,
  Camera,
  Home,
  User,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";

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

  const getIcon = (name: string, color: string) => {
    switch (name) {
      case "Home":
        return <Home size={23} color={color} />;
      case "Solve":
        return <Camera size={23} color={color} />;
      case "AskAI":
        return <Bot size={22} color={color} />;
      case "Library":
        return <BookOpen size={23} color={color} />;
      case "Profile":
        return <User size={23} color={color} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const isFocused = state.index === index;
          const activeColor = colors.primary;
          const inactiveColor = colors.textMuted;
          const isAskAi = route.name === "AskAI";

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

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.88}
              style={[styles.tabItem, isAskAi && styles.askAiTabItem]}
            >
              {isAskAi ? (
                <>
                  <View
                    style={[
                      styles.askAiButton,
                      {
                        backgroundColor: isFocused ? colors.primary : colors.surfaceElevated,
                        borderColor: isFocused ? "rgba(255,255,255,0.18)" : colors.border,
                      },
                    ]}
                  >
                    {getIcon(route.name, isFocused ? "#FFFFFF" : colors.textPrimary)}
                  </View>
                  <Text
                    style={[
                      styles.label,
                      typography.caption,
                      { color: isFocused ? activeColor : inactiveColor },
                    ]}
                  >
                    {label}
                  </Text>
                </>
              ) : (
                <>
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
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "transparent",
    paddingBottom: Platform.OS === "ios" ? 16 : 10,
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  container: {
    alignItems: "flex-end",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    height: Platform.OS === "ios" ? 84 : 72,
    paddingBottom: Platform.OS === "ios" ? 18 : 10,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  askAiTabItem: {
    justifyContent: "space-between",
    marginTop: -24,
  },
  askAiButton: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    elevation: 6,
    height: 56,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    width: 56,
  },
  label: {
    marginTop: 5,
  },
});
