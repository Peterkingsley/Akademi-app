import React from "react";
import { AntDesign } from "@expo/vector-icons";

import { Button } from "../ui/Button";
import { useTheme } from "../../theme/ThemeContext";

interface GoogleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  label?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onPress,
  loading = false,
  label = "Continue with Google",
}) => {
  const { colors } = useTheme();

  return (
    <Button
      label={label}
      onPress={onPress}
      loading={loading}
      disabled={loading}
      variant="outline"
      icon={<AntDesign name="google" size={18} color={colors.primary} />}
    />
  );
};
