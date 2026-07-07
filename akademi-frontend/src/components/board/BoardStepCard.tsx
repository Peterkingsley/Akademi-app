import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { typography } from "../../theme/typography";
import { MathFormula } from "../ui/MathFormula";
import { RichMathText } from "../ui/RichMathText";
import { BoardStep, isRenderableMath, PHASE_LABELS } from "./boardTypes";

interface BoardStepCardProps {
  step: BoardStep;
  index: number;
}

export const BoardStepCard: React.FC<BoardStepCardProps> = ({ step, index }) => {
  const phaseLabel = step.phase ? PHASE_LABELS[step.phase] : "";

  return (
    <View
      style={[
        styles.stepCard,
        step.type === "highlight" && styles.highlightStepCard,
        step.type === "answer" && styles.answerStepCard,
      ]}
    >
      {!!phaseLabel && <Text style={styles.phaseLabel}>{phaseLabel.toUpperCase()}</Text>}
      <Text style={styles.stepIndex}>Step {index + 1}</Text>
      {!!step.text && (
        <RichMathText content={step.text} textColor="#F7FAFC" fontSize={16} lineHeight={1.45} />
      )}
      {isRenderableMath(step.math) && (
        <View style={styles.mathBlock}>
          <MathFormula latex={step.math!} fontSize={17} />
        </View>
      )}
      {!!step.note && (
        <RichMathText
          content={step.note}
          textColor="rgba(247,250,252,0.76)"
          fontSize={14}
          lineHeight={1.35}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stepCard: {
    backgroundColor: "rgba(7, 15, 9, 0.45)",
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  highlightStepCard: {
    borderColor: "rgba(34,197,94,0.45)",
  },
  answerStepCard: {
    backgroundColor: "rgba(34,197,94,0.16)",
    borderColor: "rgba(34,197,94,0.55)",
  },
  phaseLabel: {
    ...typography.caption,
    color: "rgba(154,230,180,0.7)",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  stepIndex: {
    ...typography.caption,
    color: "#9AE6B4",
    marginBottom: 6,
  },
  mathBlock: {
    marginTop: 8,
    minHeight: 32,
  },
});
