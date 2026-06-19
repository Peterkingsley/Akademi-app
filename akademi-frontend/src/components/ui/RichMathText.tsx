import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

interface RichMathTextProps {
  content: string;
  textColor?: string;
  backgroundColor?: string;
  fontSize?: number;
  lineHeight?: number;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeText = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

const isBulletLine = (line: string) => /^(?:\u2022|[-*])\s+/.test(line);

const looksLikeStandaloneMath = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isBulletLine(trimmed)) return false;
  if (/^\d+\.\s/.test(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;

  const mathSignals =
    /\\[a-zA-Z]+|[=<>+\-*/^√∫∑π∞≈≤≥]|[A-Za-z]\s*_[A-Za-z0-9]+|[A-Za-z]\s*\^|\d+\s*[A-Za-z]|[A-Za-z]\([^)]+\)/;
  const wordMatches = trimmed.match(/[A-Za-z]{3,}/g) || [];

  return trimmed.length <= 120 && mathSignals.test(trimmed) && wordMatches.length <= 6;
};

const wrapDisplayMath = (line: string) => `\\[${line.trim()}\\]`;

const buildHtmlContent = (content: string) => {
  const blocks = normalizeText(content).split(/\n{2,}/);

  return blocks
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) return "";

      if (lines.every(isBulletLine)) {
        const items = lines
          .map((line) => {
            const itemText = line.replace(/^(?:\u2022|[-*])\s+/, "");
            const itemContent = looksLikeStandaloneMath(itemText)
              ? wrapDisplayMath(escapeHtml(itemText))
              : escapeHtml(itemText);
            return `<li>${itemContent}</li>`;
          })
          .join("");

        return `<ul>${items}</ul>`;
      }

      return lines
        .map((line) => {
          const safeLine = escapeHtml(line);
          if (looksLikeStandaloneMath(line)) {
            return `<div class="math-line">${wrapDisplayMath(safeLine)}</div>`;
          }
          return `<div class="paragraph">${safeLine}</div>`;
        })
        .join("");
    })
    .join("");
};

export const RichMathText: React.FC<RichMathTextProps> = ({
  content,
  textColor = "#F7FAFC",
  backgroundColor = "transparent",
  fontSize = 16,
  lineHeight = 1.6,
}) => {
  const [height, setHeight] = useState(64);

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
        font-size: ${fontSize}px;
        line-height: ${lineHeight};
      }
      #content {
        width: 100%;
      }
      .paragraph {
        margin: 0 0 0.6em 0;
        word-break: break-word;
      }
      .math-line {
        margin: 0.2em 0 0.45em 0;
      }
      ul {
        margin: 0 0 0.7em 1.1em;
        padding: 0;
      }
      li {
        margin: 0 0 0.35em 0;
      }
      .katex {
        color: ${textColor};
        font-size: 1em;
      }
      .katex-display {
        margin: 0.2em 0;
        overflow-x: auto;
        overflow-y: hidden;
      }
    </style>
  </head>
  <body>
    <div id="content">${buildHtmlContent(content)}</div>
    <script>
      function render() {
        try {
          if (window.renderMathInElement) {
            renderMathInElement(document.getElementById('content'), {
              throwOnError: false,
              strict: 'ignore',
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\\\[', right: '\\\\]', display: true },
                { left: '\\\\(', right: '\\\\)', display: false },
                { left: '$', right: '$', display: false }
              ]
            });
          }
        } catch (error) {}

        const nextHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          32
        );
        window.ReactNativeWebView.postMessage(String(nextHeight));
      }
      document.addEventListener('DOMContentLoaded', render);
      window.addEventListener('load', render);
      setTimeout(render, 120);
    </script>
  </body>
</html>`,
    [backgroundColor, content, fontSize, lineHeight, textColor]
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
            setHeight(Math.min(Math.max(nextHeight + 4, 32), 4000));
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
