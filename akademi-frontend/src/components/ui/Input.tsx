import React, { useMemo, useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardTypeOptions,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useVoiceComposer } from "../../hooks/useVoiceComposer";
import { appendTranscript } from "../../services/voice";
import { VoiceInputButton } from "./VoiceInputButton";

interface InputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  labelAccessory?: React.ReactNode;
  enableVoiceInput?: boolean;
  maxLength?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry,
  keyboardType = "default",
  autoCapitalize = "none",
  leftIcon,
  style,
  labelStyle,
  labelAccessory,
  enableVoiceInput,
  maxLength,
}) => {
  const { colors, controlSize, radius, typeScale } = useTheme();
  const styles = useMemo(() => createStyles(colors, controlSize, radius), [colors, controlSize, radius]);
  const reduceMotion = useReducedMotion();
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);
  const focusProgress = useSharedValue(0);

  const focusStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [colors.surfaceElevated, colors.brand.subtle],
    ),
    borderColor: interpolateColor(focusProgress.value, [0, 1], [colors.border, colors.primary]),
  }));
  // Voice is opt-in. Generic forms, search fields, and profile inputs should
  // not show a microphone merely because they use the shared Input component.
  const voiceEnabled = enableVoiceInput === true && !secureTextEntry;
  const { isRecording, isTranscribing, toggleRecording } = useVoiceComposer({
    onTranscript: (transcript) => onChangeText(appendTranscript(value, transcript)),
    recordingName: "input-voice.m4a",
    permissionMessage: "Allow microphone access so Akademi can write what you say here.",
  });

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, typeScale.label, labelStyle]}>{label}</Text>
          {labelAccessory}
        </View>
      ) : null}
      <Animated.View
        style={[
          styles.inputContainer,
          focusStyle,
          !!error && styles.inputError,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, typography.body]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            focusProgress.value = withTiming(1, { duration: reduceMotion ? 0 : 160 });
          }}
          onBlur={() => {
            focusProgress.value = withTiming(0, { duration: reduceMotion ? 0 : 160 });
          }}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          accessibilityLabel={label || placeholder}
        />
        {voiceEnabled && (
          <VoiceInputButton
            onPress={toggleRecording}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            style={styles.voiceButton}
          />
        )}
        {secureTextEntry && (
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            style={styles.iconRight}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
            accessibilityState={{ expanded: isPasswordVisible }}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color={colors.textSecondary} />
            ) : (
              <Eye size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        )}
      </Animated.View>
      {!!error && (
        <Text style={[styles.errorText, typeScale.caption]} accessibilityLiveRegion="polite">{error}</Text>
      )}
    </View>
  );
};

const createStyles = (
  colors: typeof import("../../theme/colors").darkPalette,
  controlSize: typeof import("../../theme/foundations").controlSize,
  radius: typeof import("../../theme/foundations").radius,
) => StyleSheet.create({
  container: {
    marginBottom: 20,
    width: "100%",
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: controlSize.inputMinHeight,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
  },
  iconLeft: {
    marginRight: 12,
  },
  iconRight: {
    alignItems: "center",
    height: controlSize.minTouch,
    justifyContent: "center",
    marginLeft: 12,
    width: controlSize.minTouch,
  },
  voiceButton: {
    marginLeft: 8,
  },
  errorText: {
    color: colors.error,
    marginTop: 4,
  },
});
