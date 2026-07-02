export type GraphKind = "function_plot" | "pie_chart" | "bar_chart" | "line_chart" | "scatter_plot";

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
