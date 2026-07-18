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
  onReachEndChange?: (reachedEnd: boolean) => void;
}

type WebMessage =
  | { type: "ready" }
  | { type: "error"; value: string }
  | { type: "selection"; value: string }
  | { type: "endState"; value: boolean };

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
  onReachEndChange,
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
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5.0, user-scalable=yes" />
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
      #floating-nav {
        position: fixed;
        top: 50%;
        transform: translateY(-50%);
        right: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease-in-out, top 0.1s ease-out;
      }
      .nav-pill {
        background: rgba(30, 30, 30, 0.85);
        backdrop-filter: blur(8px);
        color: white;
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        pointer-events: auto;
      }
      .nav-circle {
        background: rgba(30, 30, 30, 0.85);
        backdrop-filter: blur(8px);
        width: 48px;
        height: 48px;
        border-radius: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        pointer-events: auto;
      }
      .nav-arrow {
        cursor: pointer;
        color: white;
        padding: 2px 10px;
      }
      .nav-arrow:active {
        opacity: 0.5;
      }
      .nav-arrow svg {
        width: 20px;
        height: 20px;
      }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  </head>
  <body>
    <div id="status">Opening PDF...</div>
    <div id="viewer"></div>
    <div id="floating-nav">
      <div class="nav-pill" id="page-indicator">1 / 1</div>
      <div class="nav-circle" id="nav-dragger">
        <div class="nav-arrow" onclick="scrollUp()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"></polyline></svg></div>
        <div class="nav-arrow" onclick="scrollDown()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg></div>
      </div>
    </div>
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

      function updateEndState() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const fullHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          viewportHeight
        );
        const reachedEnd = scrollTop + viewportHeight >= fullHeight - 48;
        post({ type: 'endState', value: reachedEnd });
      }

      function scrollUp() {
        showFloatingNav();
        window.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' });
      }

      function scrollDown() {
        showFloatingNav();
        window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
      }

      let totalPages = 1;
      let scrollTimeout;
      let isDragging = false;
      
      function showFloatingNav() {
        const nav = document.getElementById('floating-nav');
        nav.style.opacity = '1';
        nav.style.pointerEvents = 'auto';
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(function() {
          if (!isDragging) {
            nav.style.opacity = '0';
            nav.style.pointerEvents = 'none';
          }
        }, 2000);
      }

      function updateNavPosition() {
        if (isDragging) return;
        const maxScroll = Math.max(0, document.body.scrollHeight - window.innerHeight);
        if (maxScroll === 0) return;
        const percent = Math.max(0, Math.min(1, window.scrollY / maxScroll));
        const viewportHeight = window.innerHeight;
        const safeY = (viewportHeight * 0.15) + (percent * (viewportHeight * 0.7));
        const nav = document.getElementById('floating-nav');
        nav.style.top = safeY + 'px';
      }

      function updatePageIndicator() {
        const shells = document.querySelectorAll('.page-shell');
        let visiblePage = 1;
        let maxVisible = 0;
        const viewportHeight = window.innerHeight;
        
        for (let i = 0; i < shells.length; i++) {
          const rect = shells[i].getBoundingClientRect();
          const overlapTop = Math.max(0, rect.top);
          const overlapBottom = Math.min(viewportHeight, rect.bottom);
          const visibleHeight = Math.max(0, overlapBottom - overlapTop);
          if (visibleHeight > maxVisible) {
            maxVisible = visibleHeight;
            visiblePage = i + 1;
          }
        }
        document.getElementById('page-indicator').textContent = visiblePage + ' / ' + totalPages;
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
            
            // For razor sharp text on mobile, we render the canvas at a high resolution
            // (scale * devicePixelRatio) and then shrink it with CSS.
            const dpr = Math.max(window.devicePixelRatio || 2, 2);
            const renderViewport = page.getViewport({ scale: scale * dpr });

            const shell = document.createElement('div');
            shell.className = 'page-shell';
            shell.style.height = viewport.height + 'px';

            const pageEl = document.createElement('div');
            pageEl.className = 'page';
            pageEl.style.width = viewport.width + 'px';
            pageEl.style.height = viewport.height + 'px';

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = Math.floor(renderViewport.width);
            canvas.height = Math.floor(renderViewport.height);
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
              viewport: renderViewport,
            }).promise;

            const textContent = await page.getTextContent();
            renderTextLayer(textLayerDiv, textContent, viewport);
          }

          totalPages = pdf.numPages;
          updatePageIndicator();
          updateNavPosition();
          showFloatingNav();

          const dragger = document.getElementById('nav-dragger');
          const nav = document.getElementById('floating-nav');
          dragger.addEventListener('touchstart', function(e) {
            isDragging = true;
            clearTimeout(scrollTimeout);
            nav.style.opacity = '1';
            nav.style.transition = 'none'; // instant move during drag
          }, { passive: false });

          dragger.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
            const y = e.touches[0].clientY;
            const viewportHeight = window.innerHeight;
            const minY = viewportHeight * 0.15;
            const maxY = viewportHeight * 0.85;
            
            let percent = (y - minY) / (maxY - minY);
            percent = Math.max(0, Math.min(1, percent));
            
            const maxScroll = document.body.scrollHeight - viewportHeight;
            window.scrollTo(0, maxScroll * percent);
            nav.style.top = Math.max(minY, Math.min(maxY, y)) + 'px';
          }, { passive: false });

          dragger.addEventListener('touchend', function(e) {
            isDragging = false;
            nav.style.transition = 'opacity 0.3s ease-in-out, top 0.1s ease-out';
            showFloatingNav();
          });

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
      window.addEventListener('scroll', function () {
        updateEndState();
        updatePageIndicator();
        updateNavPosition();
        if (!isDragging) {
          showFloatingNav();
        }
      }, { passive: true });
      window.clearNativeSelection = function () {
        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
        post({ type: 'selection', value: '' });
      };

      renderPdf().then(function () {
        setTimeout(updateEndState, 60);
      });
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

            if (payload.type === "endState") {
              onReachEndChange?.(Boolean(payload.value));
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
