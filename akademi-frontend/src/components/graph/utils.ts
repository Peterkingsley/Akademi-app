import { GraphPoint } from "./types";

// Fixed-order categorical palette validated for a dark surface (~#1A1A1A) via the dataviz
// skill's validator. Never generate a hue on the fly - always index into this in order, and
// fold anything past slot 8 into direct labels rather than adding a 9th color.
export const CATEGORICAL_COLORS = [
  "#3987e5", // blue
  "#199e70", // aqua
  "#c98500", // yellow
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
  "#d55181", // magenta
  "#d95926", // orange
];

export const getCategoricalColor = (index: number) => CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];

export const MARKER_COLOR = "#FFFFFF";

export interface Scale {
  (value: number): number;
  domain: [number, number];
  range: [number, number];
}

export function createLinearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;

  const scale = ((value: number) => r0 + ((value - d0) / span) * (r1 - r0)) as Scale;
  scale.domain = domain;
  scale.range = range;
  return scale;
}

export function computePaddedDomain(values: number[], paddingRatio = 0.12): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const span = max - min;
  return [min - span * paddingRatio, max + span * paddingRatio];
}

export function buildPolylinePath(points: GraphPoint[], xScale: Scale, yScale: Scale) {
  return points.map((point) => `${xScale(point.x)},${yScale(point.y)}`).join(" ");
}

export function formatAxisNumber(value: number) {
  if (Math.abs(value) < 0.0001) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function describePieSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const toXY = (angle: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  });

  const start = toXY(startAngle);
  const end = toXY(endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}
