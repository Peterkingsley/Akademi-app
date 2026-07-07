export type BoardStep = {
  id: string;
  type: "write" | "highlight" | "answer";
  text: string;
  math?: string;
  note: string;
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
