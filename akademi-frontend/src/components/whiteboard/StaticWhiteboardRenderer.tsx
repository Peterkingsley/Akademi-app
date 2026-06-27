import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { RichMathText } from "../ui/RichMathText";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import { WhiteboardAction, WhiteboardPlan } from "./types";

type StaticWhiteboardRendererProps = {
  plan: WhiteboardPlan | null;
};

const describeAction = (action: WhiteboardAction) => {
  switch (action.type) {
    case "write_text":
      return action.text?.trim() || "Write text";
    case "write_math":
      return action.latex?.trim() || action.text?.trim() || "Write math";
    case "draw_line":
      return "Draw line";
    case "draw_arrow":
      return "Draw arrow";
    case "highlight":
      return action.targetId ? `Highlight ${action.targetId}` : "Highlight";
    case "circle":
      return action.targetId ? `Circle ${action.targetId}` : "Circle";
    case "cross_out":
      return action.targetId ? `Cross out ${action.targetId}` : "Cross out";
    case "box":
      return action.targetId ? `Box ${action.targetId}` : "Box";
    case "pause":
      return "Pause";
    case "clear":
      return "Clear board";
    default:
      return "Whiteboard action";
  }
};

export const StaticWhiteboardRenderer: React.FC<StaticWhiteboardRendererProps> = ({ plan }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!plan || !plan.steps?.length) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Whiteboard plan unavailable</Text>
        <Text style={styles.emptyText}>No whiteboard plan is loaded for this experiment yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{plan.title || "Whiteboard Test"}</Text>
        <Text style={styles.subtitle}>
          {[plan.subject, plan.topic].filter(Boolean).join(" • ") || "Experimental static renderer"}
        </Text>
      </View>

      {plan.steps.map((step, stepIndex) => (
        <View key={step.id || `step-${stepIndex}`} style={styles.stepCard}>
          <Text style={styles.stepTitle}>
            Step {stepIndex + 1}
            {step.title ? ` • ${step.title}` : ""}
          </Text>
          {step.narration ? <Text style={styles.narration}>{step.narration}</Text> : null}
          <View style={styles.actionList}>
            {(step.actions || []).map((action, actionIndex) => (
              <View key={action.id || `action-${actionIndex}`} style={styles.actionRow}>
                <Text style={styles.actionLabel}>{action.type.replace(/_/g, " ")}</Text>
                {action.latex ? (
                  <View style={styles.mathBlock}>
                    <RichMathText
                      content={`\\(${action.latex}\\)`}
                      textColor={colors.textPrimary}
                      backgroundColor="transparent"
                      fontSize={14}
                      lineHeight={1.5}
                    />
                  </View>
                ) : null}
                {action.text ? <Text style={styles.actionText}>{action.text}</Text> : null}
                {!action.text && !action.latex ? (
                  <Text style={styles.actionText}>{describeAction(action)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    container: {
      gap: 12,
    },
    header: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
    },
    title: {
      ...typography.h4,
      color: colors.textPrimary,
      fontSize: 16,
    },
    subtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    stepCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      padding: 14,
      gap: 8,
    },
    stepTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    narration: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    actionList: {
      gap: 10,
    },
    actionRow: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 10,
      gap: 6,
    },
    actionLabel: {
      ...typography.bodySmall,
      color: colors.primary,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    actionText: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 19,
    },
    mathBlock: {
      minHeight: 28,
    },
    emptyCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 6,
    },
    emptyTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    emptyText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
