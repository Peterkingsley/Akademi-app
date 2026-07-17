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
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" onerror="window.loadFallbackKatexAssets && window.loadFallbackKatexAssets()">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js" onerror="window.loadFallbackKatexAssets && window.loadFallbackKatexAssets()"></script>
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

      let triedFallbackKatexCdn = false;

      // The primary CDN (jsdelivr) can be slow or unreachable on a poor connection - with
      // no fallback, window.katex never becomes available and the student is left staring
      // at raw LaTeX source with no formula ever rendered. This swaps in a second CDN
      // mirror if the primary errors outright, or hasn't come through within a second or so.
      window.loadFallbackKatexAssets = function () {
        if (triedFallbackKatexCdn) return;
        triedFallbackKatexCdn = true;

        var fallbackCss = document.createElement('link');
        fallbackCss.rel = 'stylesheet';
        fallbackCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.10/katex.min.css';
        document.head.appendChild(fallbackCss);

        var fallbackJs = document.createElement('script');
        fallbackJs.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.10/katex.min.js';
        // Event-driven backstop: render the moment the fallback is actually ready,
        // whenever that is, instead of depending on the poll loop's ceiling below.
        fallbackJs.onload = function () { render(); };
        document.head.appendChild(fallbackJs);
      };

      function waitForKatex(attempt) {
        if (window.katex) {
          render();
          return;
        }

        // ~1.2s in, the primary CDN clearly isn't coming through fast enough - try the
        // fallback mirror instead of just continuing to wait on it.
        if (attempt === 20) {
          window.loadFallbackKatexAssets();
        }

        if (attempt >= 45) {
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
