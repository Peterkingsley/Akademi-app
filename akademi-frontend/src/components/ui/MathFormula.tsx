import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

interface MathFormulaProps {
  latex: string;
  textColor?: string;
  backgroundColor?: string;
  fontSize?: number;
  block?: boolean;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const MathFormula: React.FC<MathFormulaProps> = ({
  latex,
  textColor = "#F7FAFC",
  backgroundColor = "transparent",
  fontSize = 17,
  block = true,
}) => {
  const [height, setHeight] = useState(block ? 48 : 28);
  const isHeightLockedRef = useRef(false);
  const displayMode = block ? "block" : "inline";

  useEffect(() => {
    isHeightLockedRef.current = false;
    setHeight(block ? 48 : 28);
  }, [backgroundColor, block, fontSize, latex, textColor]);

  const html = useMemo(
    () => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: ${backgroundColor};
        color: ${textColor};
        overflow-y: hidden;
        overflow-x: auto;
      }
      body {
        font-family: Inter, Arial, sans-serif;
        padding: 0;
      }
      #scroll-shell {
        overflow-x: auto;
        overflow-y: hidden;
        width: 100%;
        -webkit-overflow-scrolling: touch;
      }
      #formula {
        display: flex;
        justify-content: ${block ? "flex-start" : "center"};
        align-items: flex-start;
        min-height: ${block ? "32px" : "24px"};
        min-width: max-content;
        font-size: ${fontSize}px;
        line-height: 1.4;
      }
      .katex-display {
        margin: 0.05em 0 0;
      }
      .katex {
        color: ${textColor};
      }
    </style>
  </head>
  <body>
    <div id="scroll-shell">
      <div id="formula"></div>
    </div>
    <script>
      let hasRendered = false;

      function postFinalHeight() {
        const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, ${block ? 32 : 24});
        window.ReactNativeWebView.postMessage(String(height));
      }

      function render() {
        if (hasRendered) return;
        try {
          katex.render(String.raw\`${escapeHtml(latex)}\`, document.getElementById('formula'), {
            throwOnError: false,
            errorColor: '${textColor}',
            displayMode: ${displayMode === "block" ? "true" : "false"},
            trust: false
          });
        } catch (error) {
          document.getElementById('formula').textContent = ${JSON.stringify(latex)};
        }
        hasRendered = true;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            setTimeout(postFinalHeight, 60);
          });
        });
      }

      function waitForKatex(attempt) {
        if (window.katex) {
          render();
          return;
        }

        if (attempt >= 20) {
          render();
          return;
        }

        setTimeout(function () {
          waitForKatex(attempt + 1);
        }, 60);
      }

      document.addEventListener('DOMContentLoaded', function () { waitForKatex(0); });
      window.addEventListener('load', function () { waitForKatex(0); });
    </script>
  </body>
</html>`,
    [backgroundColor, block, displayMode, fontSize, latex, textColor]
  );

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        scrollEnabled={block}
        javaScriptEnabled
        showsHorizontalScrollIndicator={block}
        showsVerticalScrollIndicator={false}
        style={[styles.webview, { height, backgroundColor }]}
        containerStyle={{ backgroundColor }}
        onMessage={(event) => {
          if (isHeightLockedRef.current) return;
          const nextHeight = Number(event.nativeEvent.data);
          if (Number.isFinite(nextHeight) && nextHeight > 0) {
            isHeightLockedRef.current = true;
            setHeight(Math.min(Math.max(nextHeight + 4, block ? 32 : 24), 220));
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  webview: {
    backgroundColor: "transparent",
    width: "100%",
  },
});
