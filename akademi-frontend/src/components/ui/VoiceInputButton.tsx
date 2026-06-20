import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Mic, Square } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { colors as palette } from "../../theme/colors";

interface VoiceInputButtonProps {
  onPress: () => void | Promise<void>;
  isRecording: boolean;
  isTranscribing: boolean;
  style?: ViewStyle;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onPress,
  isRecording,
  isTranscribing,
  style,
}) => {
  const { colors } = useTheme();
  const disabled = isTranscribing;

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      style={[
        styles.button,
        { backgroundColor: isRecording ? `${palette.error}22` : colors.surfaceElevated, borderColor: isRecording ? palette.error : colors.border },
        style,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      {isTranscribing ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : isRecording ? (
        <Square size={16} color={palette.error} fill={palette.error} />
      ) : (
        <Mic size={16} color={colors.primary} />
      )}
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
