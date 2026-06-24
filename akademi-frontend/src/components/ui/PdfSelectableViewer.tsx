import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import { Copy, Highlighter, MessageSquare } from "lucide-react-native";

interface PdfSelectableViewerProps {
  pdfBase64: string;
  height: number;
  onAskAkademi: (selectedText: string) => void;
  onHighlight?: (selectedText: string) => void;
}

type WebMessage =
  | { type: "ready" }
  | { type: "error"; value: string }
  | { type: "selection"; value: string };

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const PdfSelectableViewer: React.FC<PdfSelectableViewerProps> = ({
  pdfBase64,
  height,
  onAskAkademi,
  onHighlight,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const html = useMemo(
    () => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #0b0b0b;
        color: #ffffff;
        font-family: Inter, Arial, sans-serif;
      }
      #status {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #a1a1aa;
        font-size: 15px;
      }
      #viewer {
        padding: 0;
      }
      .page-shell {
        width: 100%;
        margin: 0 0 16px 0;
        background: #171717;
      }
      .page {
        position: relative;
        margin: 0 auto;
        background: white;
        box-shadow: none;
      }
      .canvasWrapper, .textLayer {
        position: absolute;
        inset: 0;
      }
      .textLayer {
        overflow: hidden;
        line-height: 1;
        opacity: 1;
      }
      .textLayer > span {
        color: transparent;
        position: absolute;
        white-space: pre;
        cursor: text;
        transform-origin: 0% 0%;
      }
      .textLayer ::selection {
        background: rgba(34, 197, 94, 0.35);
      }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  </head>
  <body>
    <div id="status">Opening PDF...</div>
    <div id="viewer"></div>
    <script>
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const pdfBase64 = "${escapeHtml(pdfBase64)}";
      const statusEl = document.getElementById('status');
      const viewerEl = document.getElementById('viewer');

      function post(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function updateSelection() {
        const selection = window.getSelection();
        const text = selection ? selection.toString().replace(/\\s{2,}/g, ' ').trim() : '';
        post({ type: 'selection', value: text });
      }

      function renderTextLayer(textLayerDiv, textContent, viewport) {
        textLayerDiv.innerHTML = '';

        textContent.items.forEach(function (item) {
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
          const angle = Math.atan2(tx[1], tx[0]);
          const span = document.createElement('span');

          span.textContent = item.str;
          span.style.left = tx[4] + 'px';
          span.style.top = (tx[5] - fontHeight) + 'px';
          span.style.fontSize = fontHeight + 'px';
          span.style.fontFamily = item.fontName || 'sans-serif';
          span.style.transform = 'rotate(' + angle + 'rad)';
          span.style.transformOrigin = 'left bottom';
          span.style.color = 'transparent';
          span.style.position = 'absolute';
          span.style.whiteSpace = 'pre';

          textLayerDiv.appendChild(span);
        });
      }

      async function renderPdf() {
        try {
          if (!pdfjsLib) {
            throw new Error('PDF engine failed to load');
          }

          const binary = atob(pdfBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }

          const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
          statusEl.style.display = 'none';

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
            const page = await pdf.getPage(pageNum);
            const baseViewport = page.getViewport({ scale: 1 });
            const availableWidth = Math.max(window.innerWidth, 320);
            const scale = availableWidth / baseViewport.width;
            const viewport = page.getViewport({ scale });
            const dpr = Math.max(window.devicePixelRatio || 1, 1);

            const shell = document.createElement('div');
            shell.className = 'page-shell';
            shell.style.height = viewport.height + 'px';

            const pageEl = document.createElement('div');
            pageEl.className = 'page';
            pageEl.style.width = viewport.width + 'px';
            pageEl.style.height = viewport.height + 'px';

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.height = Math.floor(viewport.height * dpr);
            canvas.style.width = viewport.width + 'px';
            canvas.style.height = viewport.height + 'px';

            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'canvasWrapper';
            canvasWrapper.appendChild(canvas);

            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';

            pageEl.appendChild(canvasWrapper);
            pageEl.appendChild(textLayerDiv);
            shell.appendChild(pageEl);
            viewerEl.appendChild(shell);

            await page.render({
              canvasContext: context,
              viewport,
              transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
            }).promise;

            const textContent = await page.getTextContent();
            renderTextLayer(textLayerDiv, textContent, viewport);
          }

          post({ type: 'ready' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to render PDF';
          statusEl.textContent = message;
          post({ type: 'error', value: message });
        }
      }

      document.addEventListener('selectionchange', function () {
        setTimeout(updateSelection, 20);
      });
      document.addEventListener('click', function () {
        setTimeout(updateSelection, 20);
      });
      window.clearNativeSelection = function () {
        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
        post({ type: 'selection', value: '' });
      };

      renderPdf();
    </script>
  </body>
</html>`,
    [pdfBase64],
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

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={[styles.webview, { height }]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data) as WebMessage;
            if (payload.type === "selection") {
              const nextSelected = String(payload.value || "").trim();
              setSelectedText(nextSelected);
              setMenuVisible(nextSelected.length > 0);
              return;
            }

            if (payload.type === "error") {
              setLoadError(payload.value || "Failed to render PDF");
            }
          } catch (error) {
            console.error("PdfSelectableViewer bridge parse error:", error);
          }
        }}
      />

      {loadError ? (
        <View style={styles.errorBadge}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}

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
  webview: {
    width: "100%",
    backgroundColor: "#0B0B0B",
  },
  errorBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#2A1606",
  },
  errorText: {
    color: "#FBBF24",
    fontSize: 13,
    lineHeight: 18,
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
