import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import { WhiteboardAction, WhiteboardPlan } from "./types";
import {
  formatWhiteboardLatexForDisplay,
  getWhiteboardActionText,
  getWhiteboardCanvasSize,
} from "./utils";

type SkiaWhiteboardRendererProps = {
  plan: WhiteboardPlan | null;
  autoPlay?: boolean;
  width?: number;
  height?: number;
  onComplete?: () => void;
};

type RenderedAction = {
  id: string;
  type: WhiteboardAction["type"];
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  color: string;
  opacity: number;
  progress: number;
  raw: WhiteboardAction;
};

type SkiaModule = typeof import("@shopify/react-native-skia");

const loadSkiaModule = (): SkiaModule | null => {
  try {
    return require("@shopify/react-native-skia") as SkiaModule;
  } catch {
    return null;
  }
};

const estimateTextMetrics = (text: string, fontSize: number) => ({
  width: Math.max(48, text.length * fontSize * 0.58),
  height: fontSize + 10,
});

const waitForDuration = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), Math.max(durationMs, 0));
  });

export const SkiaWhiteboardRenderer: React.FC<SkiaWhiteboardRendererProps> = ({
  plan,
  autoPlay = true,
  width,
  height = 360,
  onComplete,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [renderedActions, setRenderedActions] = useState<RenderedAction[]>([]);
  const [replayKey, setReplayKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pausedRef = useRef(false);
  const completedRef = useRef(false);
  const actionMapRef = useRef<Record<string, RenderedAction>>({});
  const skiaModule = useMemo(() => loadSkiaModule(), []);

  const canvas = useMemo(() => getWhiteboardCanvasSize(plan), [plan]);
  const canvasWidth = width || Math.min(canvas.width, 960);
  const canvasHeight = height || canvas.height;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!plan || !autoPlay || !skiaModule) return;

    let mounted = true;
    completedRef.current = false;
    actionMapRef.current = {};
    setRenderedActions([]);
    setError(null);

    const animatePauseAware = async (durationMs: number) => {
      const started = Date.now();
      while (mounted && Date.now() - started < durationMs) {
        if (pausedRef.current) {
          await waitForDuration(40);
          continue;
        }
        await waitForDuration(16);
      }
    };

    const animateAction = async (rendered: RenderedAction, durationMs: number) =>
      new Promise<void>((resolve) => {
        const started = Date.now();
        const tick = () => {
          if (!mounted) {
            resolve();
            return;
          }
          if (pausedRef.current) {
            setTimeout(tick, 40);
            return;
          }
          const progress = Math.min((Date.now() - started) / Math.max(durationMs, 1), 1);
          setRenderedActions((current) =>
            current.map((item) =>
              item.id === rendered.id
                ? {
                    ...item,
                    progress,
                    opacity: rendered.type === "highlight" ? 0.18 + progress * 0.22 : 1,
                  }
                : item,
            ),
          );
          if (progress >= 1) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });

    const buildRenderedAction = (action: WhiteboardAction, previousY: number): RenderedAction | null => {
      const defaultColor =
        action.type === "highlight"
          ? "rgba(250, 204, 21, 0.35)"
          : action.type === "box"
            ? "#0F766E"
            : action.type === "cross_out"
              ? "#C2410C"
              : "#F8FAFC";
      const color = action.color || defaultColor;
      const text = getWhiteboardActionText(action);
      const fontSize = action.type === "write_math" ? 22 : 20;
      const metrics = estimateTextMetrics(text, fontSize);
      const x = typeof action.x === "number" ? action.x : 24;
      const y = typeof action.y === "number" ? action.y : Math.min(previousY + 50, canvasHeight - 40);
      const target = action.targetId ? actionMapRef.current[action.targetId] : undefined;
      const shapeX = target?.x ?? x;
      const shapeY = target?.y ?? y;
      const shapeWidth = target?.width ?? action.width ?? metrics.width;
      const shapeHeight = target?.height ?? action.height ?? metrics.height;

      if (action.type === "pause" || action.type === "clear") {
        return {
          id: action.id,
          type: action.type,
          x,
          y,
          width: 0,
          height: 0,
          color,
          opacity: 0,
          progress: 0,
          raw: action,
        };
      }

      if (action.type === "draw_line" || action.type === "draw_arrow") {
        const from = action.from || { x: 36, y };
        const to = action.to || { x: from.x + 180, y: from.y };
        return {
          id: action.id,
          type: action.type,
          x: from.x,
          y: from.y,
          width: Math.abs(to.x - from.x),
          height: Math.abs(to.y - from.y),
          from,
          to,
          color,
          opacity: 1,
          progress: 0,
          raw: action,
        };
      }

      return {
        id: action.id,
        type: action.type,
        text,
        x: shapeX,
        y: shapeY,
        width: shapeWidth,
        height: shapeHeight,
        color,
        opacity: action.type === "highlight" ? 0.25 : 1,
        progress: 0,
        raw: action,
      };
    };

    const run = async () => {
      let previousY = 10;
      try {
        for (const step of plan.steps || []) {
          for (const action of step.actions || []) {
            if (!mounted) return;
            if (action.delayMs) {
              await animatePauseAware(action.delayMs);
            }
            if (action.type === "clear") {
              actionMapRef.current = {};
              setRenderedActions([]);
              await animatePauseAware(action.durationMs || 180);
              previousY = 10;
              continue;
            }
            if (action.type === "pause") {
              await animatePauseAware(action.durationMs || 350);
              continue;
            }

            const rendered = buildRenderedAction(action, previousY);
            if (!rendered) continue;
            actionMapRef.current[action.id] = rendered;
            setRenderedActions((current) => [...current, rendered]);
            await animateAction(rendered, action.durationMs || 650);
            previousY =
              action.type === "write_text" || action.type === "write_math"
                ? rendered.y
                : Math.max(previousY, rendered.y + rendered.height);
          }
        }
        if (mounted && !completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      } catch {
        if (mounted) {
          setError("The Skia whiteboard could not finish rendering.");
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [autoPlay, canvasHeight, onComplete, plan, replayKey, skiaModule]);

  const handleReplay = () => {
    pausedRef.current = false;
    setPaused(false);
    setReplayKey((current) => current + 1);
  };

  const handlePauseToggle = () => {
    setPaused((current) => !current);
  };

  if (!plan || !plan.steps?.length) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Whiteboard plan unavailable</Text>
        <Text style={styles.emptyText}>No whiteboard plan is loaded for the Skia renderer yet.</Text>
      </View>
    );
  }

  if (!skiaModule) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>Skia renderer unavailable</Text>
        <Text style={styles.errorText}>
          Skia renderer requires a development build with @shopify/react-native-skia installed.
        </Text>
      </View>
    );
  }

  const { Canvas, Fill, Line, Rect, Circle, vec } = skiaModule;

  return (
    <View style={styles.container}>
      <View style={[styles.boardShell, width ? { width } : null, { height: canvasHeight }]}>
        <Canvas style={styles.canvas}>
          <Fill color="#0E1B31" />

          {Array.from({ length: Math.floor(canvasHeight / 36) }).map((_, index) => (
            <Line
              key={`grid-${index}`}
              p1={vec(0, (index + 1) * 36)}
              p2={vec(canvasWidth, (index + 1) * 36)}
              color="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          ))}

          {renderedActions.map((action) => {
            const progress = Math.max(0, Math.min(action.progress, 1));

            if (action.type === "draw_line" || action.type === "draw_arrow") {
              const from = action.from || { x: 0, y: 0 };
              const to = action.to || from;
              const currentX = from.x + (to.x - from.x) * progress;
              const currentY = from.y + (to.y - from.y) * progress;
              const angle = Math.atan2(to.y - from.y, to.x - from.x);
              const headLength = 12;

              return (
                <React.Fragment key={action.id}>
                  <Line
                    p1={vec(from.x, from.y)}
                    p2={vec(currentX, currentY)}
                    color={action.color}
                    strokeWidth={3}
                  />
                  {action.type === "draw_arrow" && progress > 0.94 ? (
                    <>
                      <Line
                        p1={vec(to.x, to.y)}
                        p2={vec(
                          to.x - headLength * Math.cos(angle - Math.PI / 6),
                          to.y - headLength * Math.sin(angle - Math.PI / 6),
                        )}
                        color={action.color}
                        strokeWidth={3}
                      />
                      <Line
                        p1={vec(to.x, to.y)}
                        p2={vec(
                          to.x - headLength * Math.cos(angle + Math.PI / 6),
                          to.y - headLength * Math.sin(angle + Math.PI / 6),
                        )}
                        color={action.color}
                        strokeWidth={3}
                      />
                    </>
                  ) : null}
                </React.Fragment>
              );
            }

            if (action.type === "highlight") {
              return (
                <Rect
                  key={action.id}
                  x={action.x - 8}
                  y={action.y + action.height * 0.55}
                  width={(action.width + 16) * progress}
                  height={action.height * 0.55}
                  color={action.color}
                  opacity={action.opacity}
                />
              );
            }

            if (action.type === "circle") {
              return (
                <Circle
                  key={action.id}
                  cx={action.x + action.width / 2}
                  cy={action.y + action.height / 2}
                  r={(Math.max(action.width, action.height) / 2 + 8) * progress}
                  color={action.color}
                  style="stroke"
                  strokeWidth={3}
                />
              );
            }

            if (action.type === "cross_out") {
              return (
                <Line
                  key={action.id}
                  p1={vec(action.x - 8, action.y - 8)}
                  p2={vec(
                    action.x - 8 + (action.width + 16) * progress,
                    action.y - 8 + (action.height + 16) * progress,
                  )}
                  color={action.color}
                  strokeWidth={3}
                />
              );
            }

            if (action.type === "box") {
              return (
                <Rect
                  key={action.id}
                  x={action.x - 10}
                  y={action.y - 8}
                  width={(action.width + 20) * progress}
                  height={action.height + 16}
                  color={action.color}
                  style="stroke"
                  strokeWidth={3}
                />
              );
            }

            return null;
          })}
        </Canvas>

        <View pointerEvents="none" style={styles.textOverlay}>
          {renderedActions.map((action) => {
            if (action.type !== "write_text" && action.type !== "write_math") {
              return null;
            }
            const fullText = action.text || "";
            const visibleChars = Math.max(1, Math.floor(fullText.length * Math.max(action.progress, 0)));
            return (
              <Text
                key={action.id}
                style={[
                  styles.whiteboardText,
                  action.type === "write_math" ? styles.whiteboardMathText : null,
                  {
                    color: action.color,
                    left: action.x,
                    top: action.y,
                  },
                ]}
              >
                {fullText.slice(0, visibleChars)}
              </Text>
            );
          })}
        </View>
      </View>

      <View style={styles.controlsRow}>
        <Pressable onPress={handleReplay} style={styles.controlButton}>
          <Text style={styles.controlButtonText}>Replay</Text>
        </Pressable>
        <Pressable onPress={handlePauseToggle} style={styles.controlButton}>
          <Text style={styles.controlButtonText}>{paused ? "Resume" : "Pause"}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Skia renderer fallback</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.legendCard}>
        <Text style={styles.legendTitle}>Skia renderer note</Text>
        <Text style={styles.legendText}>
          Math is shown with a lightweight readable formatter for now, for example{" "}
          {formatWhiteboardLatexForDisplay(String.raw`\frac{1}{\sqrt{x} + 2}`)}.
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    container: {
      gap: 10,
    },
    boardShell: {
      width: "100%",
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "#0E1B31",
      position: "relative",
    },
    canvas: {
      flex: 1,
    },
    textOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    whiteboardText: {
      ...typography.body,
      position: "absolute",
      fontSize: 20,
      lineHeight: 28,
      fontWeight: "600",
    },
    whiteboardMathText: {
      fontSize: 22,
      lineHeight: 30,
      fontWeight: "700",
    },
    controlsRow: {
      flexDirection: "row",
      gap: 10,
    },
    controlButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    controlButtonText: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    errorCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 6,
    },
    errorTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    errorText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    legendCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      padding: 12,
      gap: 4,
    },
    legendTitle: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    legendText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 17,
    },
    emptyCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 6,
    },
    emptyTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    emptyText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
