import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import { Copy, Highlighter, MessageSquare } from "lucide-react-native";

interface SelectableTextProps {
  content: string;
  onAskAkademi: (selectedText: string) => void;
  onHighlight?: (selectedText: string) => void;
  fixedHeight?: number;
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
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const isBulletLine = (line: string) => /^(?:\u2022|[-*])\s+/.test(line);
const explicitDisplayMathPattern = /^\\\[(.*)\\\]$/s;
const explicitInlineMathPattern = /^\\\((.*)\\\)$/s;

const looksLikeStandaloneMath = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isBulletLine(trimmed)) return false;
  if (/^\d+\.\s/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 15) return false;

  const mathSignals =
    /\\[a-zA-Z]+|[=<>+\-*/^√∫∑π∞≈≤≥×÷]|[A-Za-z]\s*_[A-Za-z0-9]+|[A-Za-z]\s*\^|n\([^)]+\)|[A-Z]\s*=\s*[A-Z0-9]|[0-9]+\s*[A-Za-z]\s*[=×]|[A-Za-z]\([^)]+\)\s*=|²|³|μ|λ|θ|α|β|γ|δ|ω|σ/;
  const wordMatches = trimmed.match(/[A-Za-z]{4,}/g) || [];

  return trimmed.length <= 150 && mathSignals.test(trimmed) && wordMatches.length <= 8;
};

const wrapDisplayMath = (line: string) => `\\[${line.trim()}\\]`;

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
            const itemContent = looksLikeStandaloneMath(itemText)
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

type WebMessage =
  | { type: "height"; value: number }
  | { type: "selection"; value: string };

const contentHasMath = (content: string) => {
  const normalized = normalizeText(content);
  if (!normalized) return false;

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .some(
      (line) =>
        explicitDisplayMathPattern.test(line) ||
        explicitInlineMathPattern.test(line) ||
        looksLikeStandaloneMath(line),
    );
};

export const SelectableText: React.FC<SelectableTextProps> = ({
  content,
  onAskAkademi,
  onHighlight,
  fixedHeight,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.max(windowWidth - 32, 240);
  const shouldLoadKatex = useMemo(() => contentHasMath(content), [content]);
  const webViewRef = useRef<WebView>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [height, setHeight] = useState(64);

  useEffect(() => {
    if (fixedHeight) {
      setHeight(fixedHeight);
      return;
    }

    setHeight(64);
  }, [content, fixedHeight]);

  const html = useMemo(
    () => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    ${shouldLoadKatex ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">' : ""}
    ${shouldLoadKatex ? '<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>' : ""}
    ${shouldLoadKatex ? '<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>' : ""}
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        color: #FFFFFF;
        overflow: hidden;
      }
      body {
        font-family: Inter, Arial, sans-serif;
        font-size: 16px;
        line-height: 1.6;
        -webkit-user-select: text;
        user-select: text;
      }
      #content {
        width: ${contentWidth}px;
        max-width: 100%;
        box-sizing: border-box;
        word-break: break-word;
        overflow-wrap: break-word;
        white-space: normal;
      }
      .paragraph {
        width: 100%;
        display: block;
        margin: 0 0 0.6em 0;
        word-break: break-word;
        overflow-wrap: break-word;
        white-space: normal;
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
        color: inherit;
        font-size: 1.05em;
      }
      .katex-display {
        margin: 0.6em 0;
        overflow-x: auto;
        overflow-y: hidden;
      }
      ::selection {
        background: rgba(34, 197, 94, 0.32);
      }
    </style>
  </head>
  <body>
    <div id="content">${buildHtmlContent(content)}</div>
    <script>
      function post(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function postFinalHeight() {
        const nextHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          32
        );
        post({ type: 'height', value: nextHeight });
      }

      function updateSelection() {
        const selection = window.getSelection();
        const text = selection ? selection.toString().replace(/\\s{2,}/g, ' ').trim() : '';
        post({ type: 'selection', value: text });
      }

      let hasRenderedMath = false;

      function renderMath() {
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
        if (!${shouldLoadKatex ? "true" : "false"}) {
          postFinalHeight();
          return;
        }

        if (window.renderMathInElement) {
          renderMath();
          return;
        }

        if (attempt >= 20) {
          postFinalHeight();
          return;
        }

        setTimeout(function () {
          waitForMathRenderer(attempt + 1);
        }, 80);
      }

      window.clearNativeSelection = function () {
        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
        post({ type: 'selection', value: '' });
      };

      document.addEventListener('selectionchange', function () {
        setTimeout(updateSelection, 20);
      });
      document.addEventListener('click', function () {
        setTimeout(updateSelection, 20);
      });
      if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(function () {
          postFinalHeight();
        });
        resizeObserver.observe(document.body);
      }
      if (window.MutationObserver) {
        const mutationObserver = new MutationObserver(function () {
          postFinalHeight();
        });
        mutationObserver.observe(document.getElementById('content'), {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
      let heightPollCount = 0;
      const heightPoller = setInterval(function () {
        postFinalHeight();
        heightPollCount += 1;
        if (heightPollCount >= 8) {
          clearInterval(heightPoller);
        }
      }, 250);
      window.addEventListener('load', function () { waitForMathRenderer(0); });
      document.addEventListener('DOMContentLoaded', function () {
        postFinalHeight();
        waitForMathRenderer(0);
      });
    </script>
  </body>
</html>`,
    [content, contentWidth, shouldLoadKatex]
  );

  const clearSelection = () => {
    webViewRef.current?.injectJavaScript("window.clearNativeSelection && window.clearNativeSelection(); true;");
    setSelectedText("");
    setMenuVisible(false);
  };

  const handleCopy = async () => {
    if (!selectedText) {
      clearSelection();
      return;
    }
    await Clipboard.setStringAsync(selectedText);
    Alert.alert("Copied", "Selected text copied to clipboard.");
    clearSelection();
  };

  const handleHighlightAction = () => {
    if (selectedText && onHighlight) onHighlight(selectedText);
    clearSelection();
  };

  const handleAskAction = () => {
    if (selectedText) onAskAkademi(selectedText);
    clearSelection();
  };

  if (!shouldLoadKatex) {
    return (
      <View style={styles.container}>
        <Text
          selectable
          selectionColor="rgba(34, 197, 94, 0.32)"
          style={styles.nativeText}
          onLongPress={() => {
            const trimmed = normalizeText(content);
            if (!trimmed) return;
            setSelectedText(trimmed);
            setMenuVisible(true);
          }}
        >
          {normalizeText(content)}
        </Text>

        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={clearSelection}
        >
          <TouchableWithoutFeedback onPress={clearSelection}>
            <View style={styles.modalOverlay}>
              <View style={styles.menuContainer}>
                <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                  <Copy size={18} color="#FFFFFF" />
                  <Text style={styles.menuText}>Copy</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleHighlightAction}>
                  <Highlighter size={18} color="#FFFFFF" />
                  <Text style={styles.menuText}>Highlight</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleAskAction}>
                  <MessageSquare size={18} color="#FFFFFF" />
                  <Text style={styles.menuText}>Ask Akademi</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html }}
        scrollEnabled={false}
        javaScriptEnabled
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={[styles.webview, { width: contentWidth, height: fixedHeight ?? height }]}
        containerStyle={styles.webviewContainer}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data) as WebMessage;
            if (!fixedHeight && payload.type === "height" && Number.isFinite(payload.value) && payload.value > 0) {
              const nextHeight = Math.min(Math.max(payload.value + 4, 32), 5000);
              setHeight((currentHeight) => (nextHeight > currentHeight ? nextHeight : currentHeight));
              return;
            }

            if (payload.type === "selection") {
              const nextSelected = String(payload.value || "").trim();
              setSelectedText(nextSelected);
              setMenuVisible(nextSelected.length > 0);
            }
          } catch (error) {
            console.error("SelectableText bridge parse error:", error);
          }
        }}
      />

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={clearSelection}
      >
        <TouchableWithoutFeedback onPress={clearSelection}>
          <View style={styles.modalOverlay}>
            <View style={styles.menuContainer}>
              <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                <Copy size={18} color="#FFFFFF" />
                <Text style={styles.menuText}>Copy</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleHighlightAction}>
                <Highlighter size={18} color="#FFFFFF" />
                <Text style={styles.menuText}>Highlight</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleAskAction}>
                <MessageSquare size={18} color="#FFFFFF" />
                <Text style={styles.menuText}>Ask Akademi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  nativeText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 26,
  },
  webviewContainer: {
    backgroundColor: "transparent",
  },
  webview: {
    backgroundColor: "transparent",
    width: "100%",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  menuContainer: {
    flexDirection: "row",
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  menuText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    width: 1,
    height: "100%",
    backgroundColor: "#48484A",
    marginHorizontal: 4,
  },
});
