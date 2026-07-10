import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { MathFormula } from "../ui/MathFormula";
import { RichMathText } from "../ui/RichMathText";
import { BoardStep, isRenderableMath, PHASE_LABELS } from "./boardTypes";

interface BoardStepCardProps {
  step: BoardStep;
  index: number;
}

export const BoardStepCard: React.FC<BoardStepCardProps> = ({ step, index }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const phaseLabel = step.phase ? PHASE_LABELS[step.phase] : "";

  return (
    <View style={styles.stepBlock}>
      {!!phaseLabel && <Text style={styles.phaseLabel}>{phaseLabel.toUpperCase()}</Text>}
      <Text style={styles.stepIndex}>Step {index + 1}</Text>
      {!!step.text && (
        <RichMathText content={step.text} textColor={colors.textPrimary} fontSize={16} lineHeight={1.45} />
      )}
      {isRenderableMath(step.math) && (
        <View style={styles.mathBlock}>
          <MathFormula latex={step.math!} textColor={colors.textPrimary} fontSize={17} />
        </View>
      )}
      {!!step.note && (
        <RichMathText content={step.note} textColor={colors.textSecondary} fontSize={14} lineHeight={1.35} />
      )}
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    stepBlock: {
      marginBottom: 18,
    },
    phaseLabel: {
      ...typography.caption,
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    stepIndex: {
      ...typography.caption,
      color: colors.textMuted,
      marginBottom: 6,
    },
    mathBlock: {
      marginTop: 8,
      minHeight: 32,
    },
  });
