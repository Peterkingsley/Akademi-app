import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { Button } from "./Button";
import { AlertTriangle, Info } from "lucide-react-native";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "info";
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "info",
}) => {
  const { colors, spacing, typography } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: type === "danger" ? "#EF444415" : colors.primary + "15" }]}>
              {type === "danger" ? (
                <AlertTriangle size={24} color="#EF4444" />
              ) : (
                <Info size={24} color={colors.primary} />
              )}
            </View>
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md }]}>{title}</Text>
          </View>

          <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl }]}>
            {message}
          </Text>

          <View style={styles.footer}>
            <Button
              title={cancelText}
              onPress={onCancel}
              variant="outline"
              style={{ flex: 1, marginRight: spacing.md }}
            />
            <Button
              title={confirmText}
              onPress={onConfirm}
              variant={type === "danger" ? "primary" : "primary"}
              style={{ flex: 1, backgroundColor: type === "danger" ? "#EF4444" : colors.primary }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    flexDirection: "row",
    width: "100%",
  },
});
