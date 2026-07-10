import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { typography } from "../../theme/typography";
import { useTheme } from "../../theme/ThemeContext";
import { MathFormula } from "../ui/MathFormula";
import { RichMathText } from "../ui/RichMathText";
import { isRenderableMath } from "./boardTypes";

interface BoardFinalAnswerCardProps {
  finalAnswer: string;
  finalAnswerMath?: string;
  summary?: string;
}

export const BoardFinalAnswerCard: React.FC<BoardFinalAnswerCardProps> = ({
  finalAnswer,
  finalAnswerMath,
  summary,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.answerBlock}>
      <Text style={styles.answerLabel}>Answer</Text>
      {isRenderableMath(finalAnswerMath) ? (
        <View style={styles.finalMathBlock}>
          <MathFormula latex={finalAnswerMath!} textColor={colors.textPrimary} fontSize={21} />
        </View>
      ) : (
        <RichMathText content={finalAnswer} textColor={colors.textPrimary} fontSize={22} lineHeight={1.4} />
      )}
      {!!finalAnswer && finalAnswerMath && (
        <RichMathText content={finalAnswer} textColor={colors.textSecondary} fontSize={14} lineHeight={1.4} />
      )}
      {!!summary && <RichMathText content={summary} textColor={colors.textSecondary} fontSize={14} lineHeight={1.45} />}
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    answerBlock: {
      gap: 8,
    },
    answerLabel: {
      ...typography.label,
      color: colors.primary,
      marginBottom: 2,
    },
    finalMathBlock: {
      marginTop: 2,
      minHeight: 40,
    },
  });
