export type WhiteboardRendererMode =
  | "static"
  | "svg"
  | "webview"
  | "skia";

export type WhiteboardActionType =
  | "write_text"
  | "write_math"
  | "draw_line"
  | "draw_arrow"
  | "highlight"
  | "circle"
  | "cross_out"
  | "box"
  | "pause"
  | "clear";

export type WhiteboardAction = {
  id: string;
  type: WhiteboardActionType;
  text?: string;
  latex?: string;
  targetId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  color?: string;
  durationMs?: number;
  delayMs?: number;
};

export type WhiteboardStep = {
  id: string;
  title?: string;
  narration?: string;
  actions: WhiteboardAction[];
};

export type WhiteboardPlan = {
  id: string;
  title?: string;
  subject?: string;
  topic?: string;
  canvas?: {
    width: number;
    height: number;
    backgroundColor?: string;
  };
  steps: WhiteboardStep[];
};
