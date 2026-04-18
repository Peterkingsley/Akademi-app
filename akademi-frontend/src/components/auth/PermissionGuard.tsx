import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAuthStore } from "../../store/useAuthStore";
import { useTheme } from "../../theme/ThemeContext";
import { Lock } from "lucide-react-native";
import { Button } from "../ui/Button";
import { useNavigation } from "@react-navigation/native";

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredRole = 'SUPER_ADMIN'
}) => {
  const { user } = useAuthStore();
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation();

  const hasPermission = user?.admin_role === requiredRole;

  if (!hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
          <Lock size={48} color={colors.textMuted} />
        </View>
        <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xl, textAlign: 'center' }]}>
          Restricted Access
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center', paddingHorizontal: 40 }]}>
          You do not have the required permissions to view this section. This area is restricted to {requiredRole.replace('_', ' ')}s only.
        </Text>
        <Button
          title="Go Back"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing.xl, width: 160 }}
        />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
});
