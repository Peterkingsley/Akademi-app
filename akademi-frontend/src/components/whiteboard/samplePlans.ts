import { WhiteboardPlan } from "./types";

export const sampleLimitWhiteboardPlan: WhiteboardPlan = {
  id: "sample-limit-rationalization",
  title: "Limit Rationalization Test",
  subject: "mathematics",
  topic: "Limit by conjugate",
  canvas: {
    width: 960,
    height: 640,
    backgroundColor: "#FFFDF7",
  },
  steps: [
    {
      id: "step-1",
      title: "Write the limit",
      narration: "Start with the limit expression.",
      actions: [
        {
          id: "write-limit",
          type: "write_math",
          latex: String.raw`\lim_{x \to 4} \frac{\sqrt{x} - 2}{x - 4}`,
          x: 48,
          y: 60,
          durationMs: 900,
        },
      ],
    },
    {
      id: "step-2",
      title: "Multiply by the conjugate",
      narration: "Use the conjugate to simplify the numerator.",
      actions: [
        {
          id: "write-conjugate-text",
          type: "write_text",
          text: "Multiply top and bottom by the conjugate:",
          x: 48,
          y: 140,
          durationMs: 800,
        },
        {
          id: "write-conjugate",
          type: "write_math",
          latex: String.raw`\frac{\sqrt{x} - 2}{x - 4} \times \frac{\sqrt{x} + 2}{\sqrt{x} + 2}`,
          x: 48,
          y: 190,
          durationMs: 900,
        },
      ],
    },
    {
      id: "step-3",
      title: "Cancel the common factor",
      narration: "After simplification, cancel the common term.",
      actions: [
        {
          id: "write-simplified",
          type: "write_math",
          latex: String.raw`\frac{x - 4}{(x - 4)(\sqrt{x} + 2)}`,
          x: 48,
          y: 290,
          durationMs: 900,
        },
        {
          id: "cross-out-cancel",
          type: "cross_out",
          targetId: "write-simplified",
          color: "#C2410C",
          durationMs: 500,
        },
        {
          id: "write-after-cancel",
          type: "write_math",
          latex: String.raw`\frac{1}{\sqrt{x} + 2}`,
          x: 48,
          y: 360,
          durationMs: 900,
        },
      ],
    },
    {
      id: "step-4",
      title: "Substitute and box the answer",
      narration: "Now substitute x equals four and simplify.",
      actions: [
        {
          id: "substitute-x",
          type: "write_text",
          text: "Substitute x = 4",
          x: 48,
          y: 430,
          durationMs: 700,
        },
        {
          id: "write-final",
          type: "write_math",
          latex: String.raw`\frac{1}{\sqrt{4} + 2} = \frac{1}{4}`,
          x: 48,
          y: 480,
          durationMs: 900,
        },
        {
          id: "box-answer",
          type: "box",
          targetId: "write-final",
          color: "#0F766E",
          durationMs: 400,
        },
      ],
    },
  ],
};
