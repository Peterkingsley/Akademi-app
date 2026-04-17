import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

interface Tab {
  label: string;
  onPress: () => void;
  isActive: boolean;
}

interface TabSwitcherProps {
  tabs: Tab[];
}

export const TabSwitcher: React.FC<TabSwitcherProps> = ({ tabs }) => {
  const { colors, typography } = useTheme();

  return (
    <View
      style={[
        styles.tabSwitcher,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}
    >
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.tabItem,
            tab.isActive && { borderTopColor: colors.primary, borderTopWidth: 2 },
          ]}
          onPress={tab.onPress}
          disabled={tab.isActive}
        >
          <Text
            style={[
              typography.bodySmall,
              {
                color: tab.isActive ? colors.primary : colors.textMuted,
                fontWeight: "600",
              },
            ]}
          >
            {tab.label}
          </Text>
          {tab.isActive && (
            <View
              style={[
                styles.tabIndicator,
                { backgroundColor: colors.primary },
              ]}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  tabSwitcher: {
    flexDirection: "row",
    height: 60,
    borderTopWidth: 1,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIndicator: {
    position: "absolute",
    top: 0,
    width: 40,
    height: 2,
  },
});
