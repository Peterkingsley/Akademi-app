export type GraphKind = 'function_plot' | 'pie_chart' | 'bar_chart' | 'line_chart' | 'scatter_plot';

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphMarker extends GraphPoint {
  label: string;
}

export interface GraphSeries {
  label: string;
  points: GraphPoint[];
}

export interface GraphSegment {
  label: string;
  value: number;
}

export interface GraphAxis {
  label?: string;
  min?: number;
  max?: number;
}

export interface GraphSpec {
  kind: GraphKind;
  title: string;
  x_axis?: GraphAxis;
  y_axis?: GraphAxis;
  series?: GraphSeries[];
  segments?: GraphSegment[];
  markers?: GraphMarker[];
  caption?: string;
}

// What the model is allowed to hand back. For function_plot it must NOT include computed
// points/roots/etc - only the expression and domain, so the server computes the real numbers
// instead of trusting the model's arithmetic. For data-driven chart kinds (the values come from
// the question itself, not from evaluating a formula) it supplies the labeled values directly.
export interface RawGraphResponse {
  eligible: boolean;
  kind?: GraphKind;
  title?: string;
  x_axis_label?: string;
  y_axis_label?: string;
  expression?: string;
  domain_min?: number;
  domain_max?: number;
  segments?: { label?: string; value?: number }[];
  series?: { label?: string; points?: { x?: number; y?: number }[] }[];
  caption?: string;
}
