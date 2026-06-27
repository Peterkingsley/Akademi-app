import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import { WhiteboardPlan } from "./types";

type WebViewWhiteboardRendererProps = {
  plan: WhiteboardPlan | null;
  autoPlay?: boolean;
  width?: number;
  height?: number;
  onComplete?: () => void;
};

type WebViewEventPayload =
  | { type: "ready" }
  | { type: "complete" }
  | { type: "progress"; stepId?: string; actionId?: string }
  | { type: "error"; message?: string };

const escapeForTemplate = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");

const buildWhiteboardHtml = (plan: WhiteboardPlan, autoPlay: boolean) => {
  const serializedPlan = escapeForTemplate(JSON.stringify(plan));

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #08111f;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
        background: linear-gradient(180deg, #0b1327 0%, #0f1d34 100%);
      }
    </style>
  </head>
  <body>
    <canvas id="board"></canvas>
    <script>
      const plan = JSON.parse(\`${serializedPlan}\`);
      const shouldAutoPlay = ${autoPlay ? "true" : "false"};
      const canvas = document.getElementById("board");
      const ctx = canvas.getContext("2d");
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      const actionPositions = {};
      const state = {
        running: false,
        paused: false,
        stepIndex: 0,
        actionIndex: 0,
      };

      function post(payload) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function resize() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBoardBackground();
      }

      function drawBoardBackground() {
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = (plan.canvas && plan.canvas.backgroundColor) || "#0e1b31";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        for (let y = 36; y < height; y += 36) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      function latexToReadable(input) {
        if (!input) return "";
        let output = String(input);
        output = output.replace(/\\\\frac\\{([^{}]+)\\}\\{([^{}]+)\\}/g, "($1)/($2)");
        output = output.replace(/\\\\sqrt\\{([^{}]+)\\}/g, "√($1)");
        output = output.replace(/\\\\lim_\\{([^{}]+)\\\\to\\s*([^{}]+)\\}/g, "lim $1→$2");
        output = output.replace(/\\\\to/g, "→");
        output = output.replace(/\\\\times/g, "×");
        output = output.replace(/\\\\cdot/g, "·");
        output = output.replace(/_/g, " ");
        output = output.replace(/\\^/g, "");
        output = output.replace(/[{}]/g, "");
        output = output.replace(/\\\\/g, "");
        return output.trim();
      }

      function getActionPlacement(action, previousY) {
        const width = canvas.width / dpr;
        const x = typeof action.x === "number" ? action.x : 24;
        const y = typeof action.y === "number" ? action.y : Math.min(previousY + 52, Math.max(48, width));
        return { x, y };
      }

      function getActionText(action) {
        if (action.type === "write_math") {
          return latexToReadable(action.latex || action.text || "");
        }
        return String(action.text || action.latex || "");
      }

      function strokeAnimation(drawFrame, durationMs) {
        return new Promise((resolve) => {
          const started = performance.now();
          function tick(now) {
            if (state.paused) {
              requestAnimationFrame(tick);
              return;
            }
            const progress = Math.min((now - started) / Math.max(durationMs, 1), 1);
            drawFrame(progress);
            if (progress < 1) {
              requestAnimationFrame(tick);
              return;
            }
            resolve();
          }
          requestAnimationFrame(tick);
        });
      }

      function wait(durationMs) {
        return new Promise((resolve) => {
          const started = performance.now();
          function tick(now) {
            if (state.paused) {
              requestAnimationFrame(tick);
              return;
            }
            if (now - started >= durationMs) {
              resolve();
              return;
            }
            requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      }

      async function animateWrite(action, previousY) {
        const placement = getActionPlacement(action, previousY);
        const text = getActionText(action);
        const fontSize = action.type === "write_math" ? 24 : 22;
        const lineHeight = fontSize + 8;
        const color = action.color || "#f8fafc";
        ctx.font = \`600 \${fontSize}px "Segoe UI", Arial, sans-serif\`;
        ctx.textBaseline = "top";
        actionPositions[action.id] = {
          x: placement.x,
          y: placement.y,
          width: Math.max(ctx.measureText(text).width, 48),
          height: lineHeight,
        };
        await strokeAnimation((progress) => {
          const visibleCount = Math.max(1, Math.floor(text.length * progress));
          drawBoardBackground();
          redrawCommitted();
          ctx.fillStyle = color;
          ctx.fillText(text.slice(0, visibleCount), placement.x, placement.y);
        }, action.durationMs || 800);
        commitAction(action);
        return placement.y;
      }

      async function animateLineLike(action, previousY, kind) {
        const defaultY = previousY + 36;
        const from = action.from || { x: 36, y: defaultY };
        const to = action.to || { x: from.x + 180, y: from.y };
        const color = action.color || (kind === "highlight" ? "rgba(250, 204, 21, 0.45)" : "#f8fafc");
        await strokeAnimation((progress) => {
          drawBoardBackground();
          redrawCommitted();
          ctx.strokeStyle = color;
          ctx.lineWidth = kind === "highlight" ? 14 : 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress);
          ctx.stroke();
          if (kind === "arrow" && progress > 0.92) {
            drawArrowHead(from, to, color);
          }
        }, action.durationMs || 500);
        commitAction(action);
        return Math.max(previousY, to.y);
      }

      function drawArrowHead(from, to, color) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLength = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }

      async function animateShapeAroundTarget(action, type) {
        const target = action.targetId ? actionPositions[action.targetId] : null;
        const rect = target || {
          x: typeof action.x === "number" ? action.x : 48,
          y: typeof action.y === "number" ? action.y : 48,
          width: typeof action.width === "number" ? action.width : 140,
          height: typeof action.height === "number" ? action.height : 44,
        };
        const padding = 8;
        const color = action.color || (type === "highlight" ? "rgba(250, 204, 21, 0.4)" : "#38bdf8");
        await strokeAnimation((progress) => {
          drawBoardBackground();
          redrawCommitted();
          if (type === "highlight") {
            ctx.fillStyle = color;
            ctx.fillRect(rect.x - padding, rect.y + rect.height * 0.55, (rect.width + padding * 2) * progress, rect.height * 0.5);
            return;
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = type === "cross_out" ? 3 : 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          if (type === "circle") {
            ctx.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, (rect.width / 2 + padding) * progress, rect.height / 2 + padding, 0, 0, Math.PI * 2);
          } else if (type === "cross_out") {
            ctx.moveTo(rect.x - padding, rect.y - padding);
            ctx.lineTo(rect.x - padding + (rect.width + padding * 2) * progress, rect.y - padding + (rect.height + padding * 2) * progress);
          } else {
            const width = rect.width + padding * 2;
            const height = rect.height + padding * 2;
            const x = rect.x - padding;
            const y = rect.y - padding;
            ctx.rect(x, y, width * progress, height);
          }
          ctx.stroke();
        }, action.durationMs || 500);
        commitAction(action);
      }

      async function animatePause(action) {
        await wait(action.durationMs || 400);
        commitAction(action);
      }

      async function animateClear(action) {
        drawBoardBackground();
        committedActions.length = 0;
        for (const key in actionPositions) {
          delete actionPositions[key];
        }
        await wait(action.durationMs || 250);
        commitAction(action);
      }

      const committedActions = [];

      function commitAction(action) {
        committedActions.push(action);
      }

      function redrawCommitted() {
        let previousY = 36;
        for (const action of committedActions) {
          previousY = drawCommittedAction(action, previousY);
        }
      }

      function drawCommittedAction(action, previousY) {
        const placement = getActionPlacement(action, previousY);
        const text = getActionText(action);
        if (action.type === "write_text" || action.type === "write_math") {
          const fontSize = action.type === "write_math" ? 24 : 22;
          ctx.font = \`600 \${fontSize}px "Segoe UI", Arial, sans-serif\`;
          ctx.textBaseline = "top";
          ctx.fillStyle = action.color || "#f8fafc";
          ctx.fillText(text, placement.x, placement.y);
          actionPositions[action.id] = {
            x: placement.x,
            y: placement.y,
            width: Math.max(ctx.measureText(text).width, 48),
            height: fontSize + 8,
          };
          return placement.y;
        }
        if (action.type === "draw_line" || action.type === "draw_arrow" || action.type === "highlight") {
          const from = action.from || { x: 36, y: previousY + 36 };
          const to = action.to || { x: from.x + 180, y: from.y };
          ctx.strokeStyle = action.color || (action.type === "highlight" ? "rgba(250, 204, 21, 0.45)" : "#f8fafc");
          ctx.lineWidth = action.type === "highlight" ? 14 : 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
          if (action.type === "draw_arrow") {
            drawArrowHead(from, to, action.color || "#f8fafc");
          }
          return Math.max(previousY, to.y);
        }
        if (action.type === "circle" || action.type === "cross_out" || action.type === "box") {
          const target = action.targetId ? actionPositions[action.targetId] : null;
          const rect = target || {
            x: typeof action.x === "number" ? action.x : 48,
            y: typeof action.y === "number" ? action.y : previousY + 24,
            width: typeof action.width === "number" ? action.width : 140,
            height: typeof action.height === "number" ? action.height : 44,
          };
          const padding = 8;
          ctx.strokeStyle = action.color || "#38bdf8";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          if (action.type === "circle") {
            ctx.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2 + padding, rect.height / 2 + padding, 0, 0, Math.PI * 2);
          } else if (action.type === "cross_out") {
            ctx.moveTo(rect.x - padding, rect.y - padding);
            ctx.lineTo(rect.x + rect.width + padding, rect.y + rect.height + padding);
          } else {
            ctx.rect(rect.x - padding, rect.y - padding, rect.width + padding * 2, rect.height + padding * 2);
          }
          ctx.stroke();
          return rect.y + rect.height;
        }
        return previousY;
      }

      async function runPlan() {
        if (state.running) return;
        state.running = true;
        state.paused = false;
        drawBoardBackground();
        committedActions.length = 0;
        for (const key in actionPositions) {
          delete actionPositions[key];
        }
        let previousY = 36;
        try {
          for (const step of plan.steps || []) {
            for (const action of step.actions || []) {
              post({ type: "progress", stepId: step.id, actionId: action.id });
              if (action.delayMs) {
                await wait(action.delayMs);
              }
              if (action.type === "write_text" || action.type === "write_math") {
                previousY = await animateWrite(action, previousY);
              } else if (action.type === "draw_line") {
                previousY = await animateLineLike(action, previousY, "line");
              } else if (action.type === "draw_arrow") {
                previousY = await animateLineLike(action, previousY, "arrow");
              } else if (action.type === "highlight") {
                if (action.targetId) {
                  await animateShapeAroundTarget(action, "highlight");
                } else {
                  previousY = await animateLineLike(action, previousY, "highlight");
                }
              } else if (action.type === "circle" || action.type === "cross_out" || action.type === "box") {
                await animateShapeAroundTarget(action, action.type);
              } else if (action.type === "pause") {
                await animatePause(action);
              } else if (action.type === "clear") {
                await animateClear(action);
              }
            }
          }
          post({ type: "complete" });
        } catch (error) {
          post({ type: "error", message: String(error && error.message ? error.message : error) });
        } finally {
          state.running = false;
        }
      }

      window.addEventListener("message", function(event) {
        try {
          const payload = JSON.parse(event.data || "{}");
          if (payload.type === "replay") {
            runPlan();
          }
          if (payload.type === "pause") {
            state.paused = true;
          }
          if (payload.type === "resume") {
            state.paused = false;
          }
        } catch (error) {
          post({ type: "error", message: String(error && error.message ? error.message : error) });
        }
      });

      window.addEventListener("resize", resize);
      resize();
      post({ type: "ready" });
      if (shouldAutoPlay) {
        runPlan();
      }
    </script>
  </body>
</html>`;
};

export const WebViewWhiteboardRenderer: React.FC<WebViewWhiteboardRendererProps> = ({
  plan,
  autoPlay = true,
  width,
  height = 360,
  onComplete,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [replayKey, setReplayKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const webViewRef = React.useRef<WebView>(null);

  const html = useMemo(() => {
    if (!plan) return null;
    return buildWhiteboardHtml(plan, autoPlay);
  }, [plan, autoPlay, replayKey]);

  const handleReplay = () => {
    setPaused(false);
    if (!ready || !webViewRef.current) {
      setReplayKey((current) => current + 1);
      return;
    }
    webViewRef.current.postMessage(JSON.stringify({ type: "replay" }));
  };

  const handlePauseToggle = () => {
    if (!webViewRef.current || !ready) return;
    const nextPaused = !paused;
    setPaused(nextPaused);
    webViewRef.current.postMessage(JSON.stringify({ type: nextPaused ? "pause" : "resume" }));
  };

  if (!plan || !html) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Whiteboard plan unavailable</Text>
        <Text style={styles.emptyText}>No whiteboard plan is loaded for the WebView renderer yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.webviewShell, width ? { width } : null, { height }]}>
        <WebView
          key={`${plan.id}-${replayKey}`}
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html }}
          style={styles.webview}
          javaScriptEnabled
          scrollEnabled={false}
          onError={() => setLoadError("The animated whiteboard could not load.")}
          onMessage={(event) => {
            try {
              const payload = JSON.parse(event.nativeEvent.data || "{}") as WebViewEventPayload;
              if (payload.type === "ready") {
                setReady(true);
                setLoadError(null);
              }
              if (payload.type === "complete") {
                setPaused(false);
                onComplete?.();
              }
              if (payload.type === "error") {
                setLoadError(payload.message || "Whiteboard renderer error.");
              }
            } catch {
              setLoadError("Whiteboard renderer sent an unreadable message.");
            }
          }}
        />
      </View>

      <View style={styles.controlsRow}>
        <Pressable onPress={handleReplay} style={styles.controlButton}>
          <Text style={styles.controlButtonText}>Replay</Text>
        </Pressable>
        <Pressable onPress={handlePauseToggle} style={[styles.controlButton, !ready ? styles.controlButtonDisabled : null]} disabled={!ready}>
          <Text style={styles.controlButtonText}>{paused ? "Resume" : "Pause"}</Text>
        </Pressable>
      </View>

      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>WebView renderer fallback</Text>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) =>
  StyleSheet.create({
    container: {
      gap: 10,
    },
    webviewShell: {
      width: "100%",
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "#08111f",
    },
    webview: {
      flex: 1,
      backgroundColor: "transparent",
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
    controlButtonDisabled: {
      opacity: 0.5,
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
