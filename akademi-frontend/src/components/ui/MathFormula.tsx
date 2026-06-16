import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from "react-native";
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
  fontSize = 22,
  block = true,
}) => {
  const [height, setHeight] = useState(block ? 92 : 52);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
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
        overflow-x: hidden;
        overflow-y: hidden;
      }
      body {
        font-family: Inter, Arial, sans-serif;
        padding: 0;
      }
      #formula {
        display: inline-flex;
        justify-content: ${block ? "flex-start" : "center"};
        align-items: center;
        min-height: 24px;
        min-width: max-content;
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
        const width = Math.max(
          document.body.scrollWidth,
          document.documentElement.scrollWidth,
          document.getElementById('formula')?.scrollWidth || 0,
          24
        );
        window.ReactNativeWebView.postMessage(JSON.stringify({ height, width }));
      }
      document.addEventListener('DOMContentLoaded', render);
      window.addEventListener('load', render);
      setTimeout(render, 120);
    </script>
  </body>
</html>`,
    [backgroundColor, block, displayMode, fontSize, latex, textColor]
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== containerWidth) {
      setContainerWidth(nextWidth);
    }
  };

  const viewportWidth = Math.max(containerWidth, 1);
  const webViewWidth = Math.max(viewportWidth, contentWidth || 0);

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      <ScrollView
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator
        contentContainerStyle={[styles.scrollContent, { minWidth: viewportWidth }]}
      >
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          scrollEnabled={false}
          javaScriptEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={[styles.webview, { height, width: webViewWidth, backgroundColor }]}
          containerStyle={{ backgroundColor }}
          onMessage={(event) => {
            try {
              const parsed = JSON.parse(event.nativeEvent.data);
              const nextHeight = Number(parsed?.height);
              const nextWidth = Number(parsed?.width);

              if (Number.isFinite(nextHeight) && nextHeight > 0) {
                setHeight(Math.min(Math.max(nextHeight + 8, block ? 44 : 28), 220));
              }

              if (Number.isFinite(nextWidth) && nextWidth > 0) {
                setContentWidth(nextWidth + 24);
              }
            } catch {
              const nextHeight = Number(event.nativeEvent.data);
              if (Number.isFinite(nextHeight) && nextHeight > 0) {
                setHeight(Math.min(Math.max(nextHeight + 8, block ? 44 : 28), 220));
              }
            }
          }}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  scrollContent: {
    alignItems: "stretch",
  },
  webview: {
    backgroundColor: "transparent",
  },
});
