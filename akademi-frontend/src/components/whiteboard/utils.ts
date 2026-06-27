import { WhiteboardAction, WhiteboardPlan } from "./types";

export const formatWhiteboardLatexForDisplay = (latex: string) => {
  if (!latex) return "";

  let output = String(latex);
  output = output.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  output = output.replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)");
  output = output.replace(/\\lim_\{([^{}]+)\\to\s*([^{}]+)\}/g, "lim $1->$2");
  output = output.replace(/\\to/g, "->");
  output = output.replace(/\\times/g, " x ");
  output = output.replace(/\\cdot/g, " . ");
  output = output.replace(/\\left|\\right/g, "");
  output = output.replace(/[{}]/g, "");
  output = output.replace(/\\,/g, " ");
  output = output.replace(/\\/g, "");
  output = output.replace(/\s{2,}/g, " ").trim();
  return output;
};

export const getWhiteboardActionText = (action: WhiteboardAction) => {
  if (action.type === "write_math") {
    return formatWhiteboardLatexForDisplay(action.latex || action.text || "");
  }

  return String(action.text || action.latex || "").trim();
};

export const getWhiteboardCanvasSize = (
  plan: WhiteboardPlan | null,
  fallbackWidth = 960,
  fallbackHeight = 600,
) => ({
  width: plan?.canvas?.width || fallbackWidth,
  height: plan?.canvas?.height || fallbackHeight,
});
