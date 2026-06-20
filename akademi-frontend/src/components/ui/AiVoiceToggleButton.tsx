import React from "react";
import { StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Volume2, VolumeX } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";

interface AiVoiceToggleButtonProps {
  enabled: boolean;
  onPress: () => void | Promise<void>;
  style?: ViewStyle;
}

export const AiVoiceToggleButton: React.FC<AiVoiceToggleButtonProps> = ({
  enabled,
  onPress,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      style={[
        styles.button,
        {
          backgroundColor: enabled ? `${colors.primary}22` : colors.surfaceElevated,
          borderColor: enabled ? colors.primary : colors.border,
        },
        style,
      ]}
      onPress={onPress}
    >
      {enabled ? <Volume2 size={18} color={colors.primary} /> : <VolumeX size={18} color={colors.textSecondary} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
