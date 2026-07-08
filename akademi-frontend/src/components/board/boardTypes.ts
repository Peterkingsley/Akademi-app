export type BoardStepPhase = "understand" | "method" | "work" | "verify";

export type BoardStep = {
  id: string;
  type: "write" | "highlight" | "answer";
  phase?: BoardStepPhase;
  text: string;
  math?: string;
  note: string;
};

export const PHASE_LABELS: Record<BoardStepPhase, string> = {
  understand: "Understand the problem",
  method: "Choose the method",
  work: "",
  verify: "Verify & interpret",
};

// Defense in depth: even if a malformed LaTeX fragment slips through the backend, never show its raw
// broken source to the student - KaTeX renders unbalanced braces as visible red error text.
export const hasBalancedBraces = (value: string) => {
  let depth = 0;
  for (const char of value) {
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
};

export const isRenderableMath = (value?: string) => !!value && !!value.trim() && hasBalancedBraces(value);

export const isMeaningfulStep = (step: BoardStep) =>
  !!step.text.trim() || isRenderableMath(step.math) || !!step.note.trim();
