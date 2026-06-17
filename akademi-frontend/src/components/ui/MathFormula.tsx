import React, { useMemo, useState } from "react";
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
  const [height, setHeight] = useState(block ? 92 : 52);
  const displayMode = block ? "block" : "inline";

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
        overflow: hidden;
      }
      body {
        font-family: Inter, Arial, sans-serif;
        padding: 0;
      }
      #formula {
        display: flex;
        justify-content: ${block ? "flex-start" : "center"};
        align-items: center;
        min-height: 24px;
        font-size: ${fontSize}px;
        line-height: 1.4;
      }
      .katex-display {
        margin: 0.15em 0 0;
      }
      .katex {
        color: ${textColor};
      }
    </style>
  </head>
  <body>
    <div id="formula"></div>
    <script>
      function render() {
        try {
          katex.render(String.raw\`${escapeHtml(latex)}\`, document.getElementById('formula'), {
            throwOnError: false,
            displayMode: ${displayMode === "block" ? "true" : "false"},
            trust: false
          });
        } catch (error) {
          document.getElementById('formula').textContent = ${JSON.stringify(latex)};
        }
        const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 24);
        window.ReactNativeWebView.postMessage(String(height));
      }
      document.addEventListener('DOMContentLoaded', render);
      window.addEventListener('load', render);
      setTimeout(render, 120);
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
        scrollEnabled={false}
        javaScriptEnabled
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={[styles.webview, { height, backgroundColor }]}
        containerStyle={{ backgroundColor }}
        onMessage={(event) => {
          const nextHeight = Number(event.nativeEvent.data);
          if (Number.isFinite(nextHeight) && nextHeight > 0) {
            setHeight(Math.min(Math.max(nextHeight + 8, block ? 44 : 28), 220));
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
