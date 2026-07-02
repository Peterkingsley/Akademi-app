import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import { GraphSpec } from "./types";
import {
  computePaddedDomain,
  createLinearScale,
  describePieSlice,
  formatAxisNumber,
  getCategoricalColor,
  MARKER_COLOR,
} from "./utils";

interface GraphRendererProps {
  spec: GraphSpec;
}

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 220;
const PLOT = { left: 42, right: 14, top: 14, bottom: 30 };
const PLOT_WIDTH = CANVAS_WIDTH - PLOT.left - PLOT.right;
const PLOT_HEIGHT = CANVAS_HEIGHT - PLOT.top - PLOT.bottom;

const CHART_SURFACE = "#151515";
const AXIS_COLOR = "#383835";
const GRID_COLOR = "#2c2c2a";
const INK_PRIMARY = "#FFFFFF";
const INK_SECONDARY = "#C3C2B7";
const INK_MUTED = "#898781";

function CartesianFrame({
  xTicks,
  yTicks,
  xScale,
  yScale,
  xAxisLabel,
  yAxisLabel,
}: {
  xTicks: number[];
  yTicks: number[];
  xScale: (v: number) => number;
  yScale: (v: number) => number;
  xAxisLabel?: string;
  yAxisLabel?: string;
}) {
  return (
    <G>
      {yTicks.map((tick) => (
        <G key={`y-${tick}`}>
          <Line
            x1={PLOT.left}
            x2={CANVAS_WIDTH - PLOT.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke={GRID_COLOR}
            strokeWidth={1}
          />
          <SvgText x={PLOT.left - 6} y={yScale(tick) + 3} fill={INK_MUTED} fontSize={8} textAnchor="end">
            {formatAxisNumber(tick)}
          </SvgText>
        </G>
      ))}
      {xTicks.map((tick) => (
        <SvgText
          key={`x-${tick}`}
          x={xScale(tick)}
          y={CANVAS_HEIGHT - PLOT.bottom + 14}
          fill={INK_MUTED}
          fontSize={8}
          textAnchor="middle"
        >
          {formatAxisNumber(tick)}
        </SvgText>
      ))}
      <Line
        x1={PLOT.left}
        x2={CANVAS_WIDTH - PLOT.right}
        y1={CANVAS_HEIGHT - PLOT.bottom}
        y2={CANVAS_HEIGHT - PLOT.bottom}
        stroke={AXIS_COLOR}
        strokeWidth={1.5}
      />
      <Line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={CANVAS_HEIGHT - PLOT.bottom} stroke={AXIS_COLOR} strokeWidth={1.5} />
      {xAxisLabel ? (
        <SvgText x={CANVAS_WIDTH - PLOT.right} y={CANVAS_HEIGHT - 4} fill={INK_SECONDARY} fontSize={8} textAnchor="end">
          {xAxisLabel}
        </SvgText>
      ) : null}
      {yAxisLabel ? (
        <SvgText x={4} y={PLOT.top + 4} fill={INK_SECONDARY} fontSize={8}>
          {yAxisLabel}
        </SvgText>
      ) : null}
    </G>
  );
}

function buildTicks(domain: [number, number], count = 4) {
  const [min, max] = domain;
  const step = (max - min) / count;
  const ticks: number[] = [];
  for (let index = 0; index <= count; index += 1) {
    ticks.push(min + step * index);
  }
  return ticks;
}

function FunctionOrLineChart({ spec }: { spec: GraphSpec }) {
  const series = spec.series || [];
  const allPoints = series.flatMap((entry) => entry.points);

  const xDomain: [number, number] = spec.x_axis?.min !== undefined && spec.x_axis?.max !== undefined
    ? [spec.x_axis.min, spec.x_axis.max]
    : computePaddedDomain(allPoints.map((point) => point.x));
  const yDomain = computePaddedDomain(allPoints.map((point) => point.y));

  const xScale = createLinearScale(xDomain, [PLOT.left, CANVAS_WIDTH - PLOT.right]);
  const yScale = createLinearScale(yDomain, [CANVAS_HEIGHT - PLOT.bottom, PLOT.top]);

  const isScatter = spec.kind === "scatter_plot";

  return (
    <G>
      <CartesianFrame
        xTicks={buildTicks(xDomain)}
        yTicks={buildTicks(yDomain)}
        xScale={xScale}
        yScale={yScale}
        xAxisLabel={spec.x_axis?.label}
        yAxisLabel={spec.y_axis?.label}
      />
      {yDomain[0] < 0 && yDomain[1] > 0 ? (
        <Line
          x1={PLOT.left}
          x2={CANVAS_WIDTH - PLOT.right}
          y1={yScale(0)}
          y2={yScale(0)}
          stroke={AXIS_COLOR}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      ) : null}
      {series.map((entry, index) => {
        const color = getCategoricalColor(index);
        if (isScatter) {
          return (
            <G key={entry.label}>
              {entry.points.map((point, pointIndex) => (
                <Circle
                  key={pointIndex}
                  cx={xScale(point.x)}
                  cy={yScale(point.y)}
                  r={3.5}
                  fill={color}
                />
              ))}
            </G>
          );
        }
        const pathPoints = entry.points.map((point) => `${xScale(point.x)},${yScale(point.y)}`).join(" ");
        return <Polyline key={entry.label} points={pathPoints} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
      })}
      {(spec.markers || []).map((marker, index) => (
        <G key={`marker-${index}`}>
          <Circle cx={xScale(marker.x)} cy={yScale(marker.y)} r={4} fill={CHART_SURFACE} stroke={MARKER_COLOR} strokeWidth={1.5} />
        </G>
      ))}
    </G>
  );
}

function BarChart({ spec }: { spec: GraphSpec }) {
  const segments = spec.segments || [];
  const maxValue = Math.max(...segments.map((segment) => segment.value), 1);
  const yDomain: [number, number] = [0, maxValue * 1.15];
  const yScale = createLinearScale(yDomain, [CANVAS_HEIGHT - PLOT.bottom, PLOT.top]);

  const barGap = 10;
  const barWidth = Math.max((PLOT_WIDTH - barGap * (segments.length + 1)) / Math.max(segments.length, 1), 8);

  return (
    <G>
      {buildTicks(yDomain).map((tick) => (
        <G key={tick}>
          <Line x1={PLOT.left} x2={CANVAS_WIDTH - PLOT.right} y1={yScale(tick)} y2={yScale(tick)} stroke={GRID_COLOR} strokeWidth={1} />
          <SvgText x={PLOT.left - 6} y={yScale(tick) + 3} fill={INK_MUTED} fontSize={8} textAnchor="end">
            {formatAxisNumber(tick)}
          </SvgText>
        </G>
      ))}
      <Line x1={PLOT.left} x2={CANVAS_WIDTH - PLOT.right} y1={CANVAS_HEIGHT - PLOT.bottom} y2={CANVAS_HEIGHT - PLOT.bottom} stroke={AXIS_COLOR} strokeWidth={1.5} />
      {segments.map((segment, index) => {
        const x = PLOT.left + barGap + index * (barWidth + barGap);
        const barTop = yScale(segment.value);
        const height = CANVAS_HEIGHT - PLOT.bottom - barTop;
        const color = getCategoricalColor(index);
        return (
          <G key={segment.label}>
            <Rect x={x} y={barTop} width={barWidth} height={Math.max(height, 0)} fill={color} rx={3} />
            <SvgText x={x + barWidth / 2} y={barTop - 4} fill={INK_PRIMARY} fontSize={8} textAnchor="middle">
              {formatAxisNumber(segment.value)}
            </SvgText>
            <SvgText
              x={x + barWidth / 2}
              y={CANVAS_HEIGHT - PLOT.bottom + 12}
              fill={INK_SECONDARY}
              fontSize={7.5}
              textAnchor="middle"
            >
              {segment.label.length > 10 ? `${segment.label.slice(0, 9)}…` : segment.label}
            </SvgText>
          </G>
        );
      })}
    </G>
  );
}

function PieChart({ spec }: { spec: GraphSpec }) {
  const segments = spec.segments || [];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const cx = CANVAS_WIDTH / 2 - 40;
  const cy = CANVAS_HEIGHT / 2;
  const radius = 68;

  let angleCursor = -Math.PI / 2;

  return (
    <G>
      {segments.map((segment, index) => {
        const sliceAngle = (segment.value / total) * Math.PI * 2;
        const startAngle = angleCursor;
        const endAngle = angleCursor + sliceAngle;
        angleCursor = endAngle;
        const color = getCategoricalColor(index);
        const midAngle = (startAngle + endAngle) / 2;
        const labelRadius = radius * 0.68;
        const percentage = Math.round((segment.value / total) * 100);
        const showInlineLabel = sliceAngle > 0.35;

        return (
          <G key={segment.label}>
            <Path d={describePieSlice(cx, cy, radius, startAngle, endAngle)} fill={color} stroke={CHART_SURFACE} strokeWidth={2} />
            {showInlineLabel ? (
              <SvgText
                x={cx + labelRadius * Math.cos(midAngle)}
                y={cy + labelRadius * Math.sin(midAngle)}
                fill={INK_PRIMARY}
                fontSize={9}
                fontWeight="700"
                textAnchor="middle"
              >
                {`${percentage}%`}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </G>
  );
}

function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  if (items.length < 2 && !items.some((item) => item.value)) return null;

  return (
    <View style={styles.legendWrap}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
          <Text style={styles.legendText} numberOfLines={1}>
            {item.label}
            {item.value ? ` — ${item.value}` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const GraphRenderer: React.FC<GraphRendererProps> = ({ spec }) => {
  const { colors } = useTheme();

  const legendItems = useMemo(() => {
    if (spec.kind === "pie_chart" || spec.kind === "bar_chart") {
      const total = (spec.segments || []).reduce((sum, segment) => sum + segment.value, 0) || 1;
      return (spec.segments || []).map((segment, index) => ({
        label: segment.label,
        color: getCategoricalColor(index),
        value: spec.kind === "pie_chart" ? `${Math.round((segment.value / total) * 100)}%` : formatAxisNumber(segment.value),
      }));
    }
    if (spec.kind === "line_chart" || spec.kind === "scatter_plot") {
      return (spec.series || []).map((entry, index) => ({ label: entry.label, color: getCategoricalColor(index) }));
    }
    if (spec.kind === "function_plot") {
      const markerLegend = (spec.markers || []).length > 0
        ? [{ label: "Key points", color: MARKER_COLOR }]
        : [];
      return [{ label: `y = ${spec.series?.[0]?.label || "f(x)"}`, color: getCategoricalColor(0) }, ...markerLegend];
    }
    return [];
  }, [spec]);

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <Text style={styles.title} numberOfLines={2}>{spec.title}</Text>
      <View style={styles.canvasShell}>
        <Svg width="100%" height={(CANVAS_HEIGHT / CANVAS_WIDTH) * 100 + "%"} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
          <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={CHART_SURFACE} rx={10} />
          {spec.kind === "pie_chart" ? <PieChart spec={spec} /> : null}
          {spec.kind === "bar_chart" ? <BarChart spec={spec} /> : null}
          {(spec.kind === "function_plot" || spec.kind === "line_chart" || spec.kind === "scatter_plot") ? (
            <FunctionOrLineChart spec={spec} />
          ) : null}
        </Svg>
      </View>
      <Legend items={legendItems} />
      {spec.kind === "function_plot" && (spec.markers || []).length > 0 ? (
        <View style={styles.markerList}>
          {(spec.markers || []).map((marker, index) => (
            <Text key={index} style={styles.markerText}>
              {marker.label}: ({formatAxisNumber(marker.x)}, {formatAxisNumber(marker.y)})
            </Text>
          ))}
        </View>
      ) : null}
      {spec.caption ? <Text style={styles.caption}>{spec.caption}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#101010",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  title: {
    ...typography.h4,
    color: INK_PRIMARY,
  },
  canvasShell: {
    width: "100%",
    aspectRatio: CANVAS_WIDTH / CANVAS_HEIGHT,
    borderRadius: 10,
    overflow: "hidden",
  },
  legendWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  legendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  legendText: {
    ...typography.caption,
    color: INK_SECONDARY,
    fontSize: 10,
  },
  markerList: {
    gap: 3,
  },
  markerText: {
    ...typography.caption,
    color: INK_SECONDARY,
    fontSize: 10,
  },
  caption: {
    ...typography.bodySmall,
    color: INK_SECONDARY,
    lineHeight: 16,
  },
});
