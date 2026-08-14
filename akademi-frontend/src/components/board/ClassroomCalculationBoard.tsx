import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { MathFormula } from "../ui/MathFormula";
import { RichMathText } from "../ui/RichMathText";
import { BoardStep, isRenderableMath, PHASE_LABELS } from "./boardTypes";

const BOARD = "#FBFAF4";
const INK = "#9F1239";
const INK_DARK = "#701A35";
const ACCENT = "#6D28D9";
const MUTED = "#6B5B66";

interface ClassroomCalculationBoardProps {
  steps: BoardStep[];
  totalSteps: number;
  finalAnswer?: string;
  finalAnswerMath?: string;
  summary?: string;
  complete: boolean;
}

export const ClassroomCalculationBoard: React.FC<ClassroomCalculationBoardProps> = ({
  steps,
  totalSteps,
  finalAnswer,
  finalAnswerMath,
  summary,
  complete,
}) => (
  <View style={styles.shell}>
    <View style={styles.boardTop}>
      <View>
        <Text style={styles.boardEyebrow}>AKADEMI WORKING BOARD</Text>
        <Text style={styles.boardTitle}>Let&apos;s solve it line by line</Text>
      </View>
      <Text style={styles.progress}>{steps.length}/{totalSteps}</Text>
    </View>

    <View style={styles.rule} />

    {steps.length === 0 ? (
      <Text style={styles.placeholder}>Writing the first line…</Text>
    ) : (
      steps.map((step, index) => {
        const phaseLabel = step.phase ? PHASE_LABELS[step.phase] : "";
        return (
          <View key={step.id} style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
            <View style={styles.stepContent}>
              {!!phaseLabel && <Text style={styles.phase}>{phaseLabel}</Text>}
              {!!step.text && (
                <RichMathText content={step.text} textColor={INK_DARK} fontSize={15} lineHeight={1.42} />
              )}
              {isRenderableMath(step.math) && (
                <View style={styles.equation}>
                  <MathFormula latex={step.math!} textColor={INK} backgroundColor={BOARD} fontSize={19} />
                </View>
              )}
              {!!step.note && (
                <View style={styles.noteRow}>
                  <View style={styles.noteDash} />
                  <RichMathText content={step.note} textColor={MUTED} fontSize={13} lineHeight={1.35} />
                </View>
              )}
            </View>
          </View>
        );
      })
    )}

    {complete && (
      <View style={styles.answerBox}>
        <Text style={styles.answerLabel}>FINAL ANSWER</Text>
        {isRenderableMath(finalAnswerMath) ? (
          <MathFormula latex={finalAnswerMath!} textColor={INK_DARK} backgroundColor={BOARD} fontSize={22} />
        ) : (
          <RichMathText content={finalAnswer || ""} textColor={INK_DARK} fontSize={19} lineHeight={1.4} />
        )}
        {!!finalAnswer && !!finalAnswerMath && (
          <RichMathText content={finalAnswer} textColor={MUTED} fontSize={13} lineHeight={1.4} />
        )}
      </View>
    )}

    {complete && !!summary && (
      <View style={styles.selfCheck}>
        <Text style={styles.selfCheckLabel}>QUICK CHECK</Text>
        <RichMathText content={summary} textColor={MUTED} fontSize={13} lineHeight={1.4} />
      </View>
    )}

    <View style={styles.tray}>
      <View style={[styles.marker, { backgroundColor: INK }]} />
      <View style={[styles.marker, { backgroundColor: ACCENT }]} />
      <View style={styles.eraser} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  shell: {
    backgroundColor: BOARD,
    borderColor: "#D8D4C8",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 3,
    minHeight: 430,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  boardTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  boardEyebrow: { color: ACCENT, fontFamily: "SpaceMono_400Regular", fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  boardTitle: { color: INK_DARK, fontFamily: "SpaceMono_400Regular", fontSize: 16, marginTop: 3 },
  progress: { color: MUTED, fontFamily: "SpaceMono_400Regular", fontSize: 11 },
  rule: { backgroundColor: "rgba(159,18,57,0.22)", height: 1, marginBottom: 18, marginTop: 13 },
  placeholder: { color: MUTED, fontFamily: "SpaceMono_400Regular", fontSize: 14, paddingVertical: 30 },
  step: { alignItems: "flex-start", flexDirection: "row", marginBottom: 18 },
  stepNumber: { alignItems: "center", borderColor: INK, borderRadius: 14, borderWidth: 1.5, height: 27, justifyContent: "center", marginRight: 10, marginTop: 1, width: 27 },
  stepNumberText: { color: INK, fontFamily: "SpaceMono_400Regular", fontSize: 11, fontWeight: "700" },
  stepContent: { flex: 1 },
  phase: { color: ACCENT, fontFamily: "SpaceMono_400Regular", fontSize: 9, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" },
  equation: { borderLeftColor: "rgba(159,18,57,0.28)", borderLeftWidth: 2, marginTop: 8, minHeight: 34, paddingLeft: 10 },
  noteRow: { alignItems: "flex-start", flexDirection: "row", marginTop: 6 },
  noteDash: { backgroundColor: ACCENT, height: 2, marginRight: 7, marginTop: 9, width: 11 },
  answerBox: { borderColor: INK, borderRadius: 8, borderWidth: 2, marginBottom: 14, marginLeft: 36, padding: 13 },
  answerLabel: { color: INK, fontFamily: "SpaceMono_400Regular", fontSize: 9, fontWeight: "700", letterSpacing: 0.7, marginBottom: 6 },
  selfCheck: { borderTopColor: "rgba(109,40,217,0.22)", borderTopWidth: 1, marginBottom: 16, marginLeft: 36, paddingTop: 11 },
  selfCheckLabel: { color: ACCENT, fontFamily: "SpaceMono_400Regular", fontSize: 9, fontWeight: "700", letterSpacing: 0.7, marginBottom: 4 },
  tray: { alignItems: "center", borderTopColor: "#D8D4C8", borderTopWidth: 3, flexDirection: "row", height: 24, justifyContent: "flex-end", marginHorizontal: -18, marginTop: 4, paddingHorizontal: 16 },
  marker: { borderRadius: 3, height: 5, marginLeft: 7, width: 37 },
  eraser: { backgroundColor: "#B8B2A6", borderRadius: 3, height: 8, marginLeft: 9, width: 24 },
});
