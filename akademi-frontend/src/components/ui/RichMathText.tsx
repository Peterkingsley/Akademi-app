import React, { useEffect, useMemo, useRef, useState } from "react";
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
const explicitDisplayMathPattern = /^\\\[(.*)\\\]$/s;
const explicitInlineMathPattern = /^\\\((.*)\\\)$/s;

const looksLikeStandaloneMath = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isBulletLine(trimmed)) return false;
  if (/^\d+\.\s/.test(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;

  const mathSignals =
    /\\[a-zA-Z]+|[=<>+\-*/^√∫∑π∞≈≤≥]|[A-Za-z]\s*_[A-Za-z0-9]+|[A-Za-z]\s*\^|\d+\s*[A-Za-z]|[A-Za-z]\([^)]+\)/;
  // Count every 2+ letter word, not just long ones - short connector words ("is", "we", "by",
  // "to"...) are exactly what mark a real sentence, and a length->=3 filter let them slip
  // through uncounted, letting whole sentences get wrapped as display math and fail to parse.
  // LaTeX command names (\frac, \sqrt, \pm...) are symbolic vocabulary, not prose - without
  // excluding them, a genuine equation with several named commands (e.g. the quadratic formula,
  // which has frac/pm/sqrt) reads as "too many words" and gets left as unrendered raw text.
  const commandNames = new Set((trimmed.match(/\\([a-zA-Z]+)/g) || []).map((match) => match.slice(1).toLowerCase()));
  const wordMatches = (trimmed.match(/[A-Za-z]{2,}/g) || []).filter((word) => !commandNames.has(word.toLowerCase()));

  return trimmed.length <= 120 && mathSignals.test(trimmed) && wordMatches.length <= 3;
};

const wrapDisplayMath = (line: string) => `\\[${line.trim()}\\]`;
const containsExplicitMathDelimiter = (line: string) => /\\\(|\\\[/.test(line);

const getRenderedLine = (line: string) => {
  const trimmed = line.trim();
  const explicitDisplay = trimmed.match(explicitDisplayMathPattern);
  const explicitInline = trimmed.match(explicitInlineMathPattern);
  const explicitMatch = explicitDisplay || explicitInline;

  if (explicitMatch) {
    const inner = explicitMatch[1]?.trim() || "";
    if (looksLikeStandaloneMath(inner)) {
      return `<div class="math-line">${escapeHtml(trimmed)}</div>`;
    }
    return `<div class="paragraph">${escapeHtml(inner)}</div>`;
  }

  // A line can carry an explicit \(...\) or \[...\] delimiter as part of a longer sentence
  // rather than as the whole line. Wrapping the whole thing in our own \[...\] on top of that
  // already-delimited fragment is what caused mixed sentences to be swallowed whole and fail
  // to parse. Leave it as plain text and let KaTeX's auto-render handle the delimited part.
  if (containsExplicitMathDelimiter(trimmed)) {
    return `<div class="paragraph">${escapeHtml(trimmed)}</div>`;
  }

  const safeLine = escapeHtml(trimmed);
  if (looksLikeStandaloneMath(trimmed)) {
    return `<div class="math-line">${wrapDisplayMath(safeLine)}</div>`;
  }
  return `<div class="paragraph">${safeLine}</div>`;
};

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
            const itemContent = !containsExplicitMathDelimiter(itemText) && looksLikeStandaloneMath(itemText)
              ? wrapDisplayMath(escapeHtml(itemText))
              : escapeHtml(itemText);
            return `<li>${itemContent}</li>`;
          })
          .join("");

        return `<ul>${items}</ul>`;
      }

      return lines.map(getRenderedLine).join("");
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
  const heightRef = useRef(64);
  const isHeightLockedRef = useRef(false);

  useEffect(() => {
    heightRef.current = 64;
    isHeightLockedRef.current = false;
    setHeight(64);
  }, [content, backgroundColor, fontSize, lineHeight, textColor]);

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
      let hasRenderedMath = false;

      function postFinalHeight() {
        const nextHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          32
        );
        window.ReactNativeWebView.postMessage(String(nextHeight));
      }

      function render() {
        if (hasRenderedMath) return;

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
        hasRenderedMath = true;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            setTimeout(postFinalHeight, 80);
          });
        });
      }

      function waitForMathRenderer(attempt) {
        if (window.renderMathInElement) {
          render();
          return;
        }

        if (attempt >= 20) {
          render();
          return;
        }

        setTimeout(function () {
          waitForMathRenderer(attempt + 1);
        }, 80);
      }

      document.addEventListener('DOMContentLoaded', function () { waitForMathRenderer(0); });
      window.addEventListener('load', function () { waitForMathRenderer(0); });
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
          if (isHeightLockedRef.current) return;
          const nextHeight = Number(event.nativeEvent.data);
          if (Number.isFinite(nextHeight) && nextHeight > 0) {
            const boundedHeight = Math.min(Math.max(nextHeight + 4, 32), 4000);
            heightRef.current = boundedHeight;
            isHeightLockedRef.current = true;
            setHeight(boundedHeight);
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
