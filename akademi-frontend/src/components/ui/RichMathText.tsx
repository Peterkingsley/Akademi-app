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
    // Close blank-line gaps between consecutive markdown table rows so a table the AI
    // emitted with spacing between rows still arrives at the block parser as ONE table.
    .replace(/(\|)[ \t]*\n(?:[ \t]*\n)+(?=[ \t]*\|)/g, "$1\n")
    .trim();

const isBulletLine = (line: string) => /^(?:\u2022|[-*])\s+/.test(line);
const explicitDisplayMathPattern = /^\\\[(.*)\\\]$/s;
const explicitInlineMathPattern = /^\\\((.*)\\\)$/s;

const MATH_SIGNALS =
  /\\[a-zA-Z]+|[=<>+\-*/^√∫∑π∞≈≤≥]|[A-Za-z]\s*_[A-Za-z0-9]+|[A-Za-z]\s*\^|\d+\s*[A-Za-z]|[A-Za-z]\([^)]+\)/;

// LaTeX command names (\frac, \sqrt, \pm...) are symbolic vocabulary, not prose - without
// excluding them, a genuine equation with several named commands (e.g. the quadratic formula,
// which has frac/pm/sqrt) reads as "too many words" and gets left as unrendered raw text.
const countProseWords = (value: string) => {
  const commandNames = new Set((value.match(/\\([a-zA-Z]+)/g) || []).map((match) => match.slice(1).toLowerCase()));
  return (value.match(/[A-Za-z]{2,}/g) || []).filter((word) => !commandNames.has(word.toLowerCase())).length;
};

const looksLikeStandaloneMath = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isBulletLine(trimmed)) return false;
  if (/^\d+\.\s/.test(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;

  // Count every 2+ letter word, not just long ones - short connector words ("is", "we", "by",
  // "to"...) are exactly what mark a real sentence, and a length->=3 filter let them slip
  // through uncounted, letting whole sentences get wrapped as display math and fail to parse.
  return trimmed.length <= 120 && MATH_SIGNALS.test(trimmed) && countProseWords(trimmed) <= 3;
};

const wrapDisplayMath = (line: string) => `\\[${line.trim()}\\]`;

// `$...$` / `$$...$$` count as explicit delimiters too. AI answers routinely arrive with
// dollar-delimited math ("(e) $n(x) = \sin x$"), and wrapping such a line in our own
// \[...\] puts a literal $ inside math mode - a KaTeX parse error, which throwOnError:false
// then paints as raw red error text. Lines that already carry any delimiter must be left
// as plain paragraphs for KaTeX's auto-render to process in place.
const containsExplicitMathDelimiter = (line: string) =>
  /\\\(|\\\[/.test(line) || /\$\$[^$]+\$\$/.test(line) || /\$[^$\n]+\$/.test(line);

// "---" / "***" / "___" markdown dividers: without special handling, "---" carries a math
// signal (the minus), gets wrapped as display math, and KaTeX draws it as three minus signs.
const isHorizontalRuleLine = (line: string) => /^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim());

const isTableRowLine = (line: string) => /^\|.*\|$/.test(line.trim());
const isTableSeparatorLine = (line: string) => /^\|(?:\s*:?-{2,}:?\s*\|)+$/.test(line.trim());

// Markdown tables ("| Function | Injective |" + "| :--- | :--- |" rows) become real HTML
// tables. Previously each row rendered as a raw pipe-filled paragraph, and the separator
// row - all dashes - got wrapped as display math and rendered as "- - -" garbage.
const renderTableBlock = (tableLines: string[]) => {
  const hasHeader = tableLines.length > 1 && isTableSeparatorLine(tableLines[1]);
  const rows = tableLines
    .filter((line) => !isTableSeparatorLine(line))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => escapeHtml(cell.trim()))
    );

  if (rows.length === 0) return "";

  const renderRow = (cells: string[], tag: "th" | "td") =>
    `<tr>${cells.map((cell) => `<${tag}>${cell}</${tag}>`).join("")}</tr>`;

  const headerHtml = hasHeader ? `<thead>${renderRow(rows[0], "th")}</thead>` : "";
  const bodyRows = hasHeader ? rows.slice(1) : rows;
  const bodyHtml = bodyRows.length
    ? `<tbody>${bodyRows.map((cells) => renderRow(cells, "td")).join("")}</tbody>`
    : "";

  return `<div class="table-wrap"><table>${headerHtml}${bodyHtml}</table></div>`;
};

// Matches a leading instruction like "Solve", "Find", "Solve for x", "Simplify" at the start of
// a question. When the rest of the line is pure math with no other prose, split the instruction
// out as plain text and wrap only the equation - otherwise the whole line (instruction word
// included) gets wrapped as one display-math block, and KaTeX's math mode collapses the space
// between the instruction and the equation, rendering "Solve" flush against "2x^2" with no gap.
const INSTRUCTION_VERB_PATTERN =
  /^((?:solve|find|simplify|calculate|evaluate|differentiate|integrate|factorize|factor|expand|determine|compute|verify|show|prove|sketch|plot|graph|rearrange|convert|estimate|round|reduce|resolve|derive|state|write|express|obtain)(?:\s+for\s+\w+)?)\s*[:,]?\s+(.+)$/i;

const splitInstructionPrefixMath = (trimmed: string) => {
  if (trimmed.length > 120 || /[.!?]$/.test(trimmed)) return null;

  const match = trimmed.match(INSTRUCTION_VERB_PATTERN);
  if (!match) return null;

  const [, instructionPart, remainder] = match;
  // Strict: the remainder must be PURE math - zero leftover prose words - otherwise this is a
  // real sentence ("Find the derivative of f(x)...") that the normal prose/math heuristic
  // already classifies correctly on its own without any splitting.
  if (countProseWords(remainder) > 0 || !MATH_SIGNALS.test(remainder)) return null;

  return { instructionPart: instructionPart.trim(), remainder: remainder.trim() };
};

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

  const instructionSplit = splitInstructionPrefixMath(trimmed);
  if (instructionSplit) {
    return `<div class="paragraph">${escapeHtml(instructionSplit.instructionPart)} \\(${escapeHtml(instructionSplit.remainder)}\\)</div>`;
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

      // Walk the block grouping runs of table rows and bullets, so a block can mix
      // prose, a table, and a divider without any of them corrupting the others.
      const pieces: string[] = [];
      let index = 0;
      while (index < lines.length) {
        const line = lines[index];

        if (isHorizontalRuleLine(line)) {
          pieces.push('<hr class="divider" />');
          index += 1;
          continue;
        }

        if (isTableRowLine(line)) {
          const tableLines: string[] = [];
          while (index < lines.length && isTableRowLine(lines[index])) {
            tableLines.push(lines[index]);
            index += 1;
          }
          pieces.push(renderTableBlock(tableLines));
          continue;
        }

        if (isBulletLine(line)) {
          const items: string[] = [];
          while (index < lines.length && isBulletLine(lines[index])) {
            const itemText = lines[index].replace(/^(?:\u2022|[-*])\s+/, "");
            const itemContent = !containsExplicitMathDelimiter(itemText) && looksLikeStandaloneMath(itemText)
              ? wrapDisplayMath(escapeHtml(itemText))
              : escapeHtml(itemText);
            items.push(`<li>${itemContent}</li>`);
            index += 1;
          }
          pieces.push(`<ul>${items.join("")}</ul>`);
          continue;
        }

        pieces.push(getRenderedLine(line));
        index += 1;
      }

      return pieces.join("");
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
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" onerror="window.loadFallbackKatexAssets && window.loadFallbackKatexAssets()">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js" onerror="window.loadFallbackKatexAssets && window.loadFallbackKatexAssets()"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js" onerror="window.loadFallbackKatexAssets && window.loadFallbackKatexAssets()"></script>
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
      hr.divider {
        border: none;
        border-top: 1px solid rgba(148, 163, 184, 0.35);
        margin: 0.9em 0;
      }
      .table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        margin: 0 0 0.8em 0;
      }
      table {
        border-collapse: collapse;
        min-width: 100%;
      }
      th, td {
        border: 1px solid rgba(148, 163, 184, 0.45);
        padding: 6px 10px;
        text-align: left;
        font-size: 0.95em;
        white-space: nowrap;
      }
      th {
        font-weight: 600;
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
              errorColor: '${textColor}',
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

      let triedFallbackKatexCdn = false;

      // The primary CDN (jsdelivr) can be slow or unreachable on a poor connection - with
      // no fallback, renderMathInElement never becomes available and the student is left
      // staring at raw "$f(x) = ...$" source text with no math ever rendered. This swaps
      // in a second CDN mirror if the primary errors outright, or hasn't come through
      // within a couple of seconds.
      window.loadFallbackKatexAssets = function () {
        if (triedFallbackKatexCdn) return;
        triedFallbackKatexCdn = true;

        var fallbackCss = document.createElement('link');
        fallbackCss.rel = 'stylesheet';
        fallbackCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.10/katex.min.css';
        document.head.appendChild(fallbackCss);

        var fallbackJs = document.createElement('script');
        fallbackJs.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.10/katex.min.js';
        fallbackJs.onload = function () {
          var autoRenderJs = document.createElement('script');
          autoRenderJs.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.10/contrib/auto-render.min.js';
          // Event-driven backstop: render the moment the fallback is actually ready,
          // whenever that is, instead of depending on the poll loop's ceiling below.
          autoRenderJs.onload = function () { render(); };
          document.head.appendChild(autoRenderJs);
        };
        document.head.appendChild(fallbackJs);
      };

      function waitForMathRenderer(attempt) {
        if (window.renderMathInElement) {
          render();
          return;
        }

        // ~2s in, the primary CDN clearly isn't coming through fast enough - try the
        // fallback mirror instead of just continuing to wait on it.
        if (attempt === 25) {
          window.loadFallbackKatexAssets();
        }

        if (attempt >= 60) {
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
