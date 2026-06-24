import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from "react-native";
import { X, Download, CheckCircle2, ClipboardList, BookOpen, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { useNavigation, useRoute } from "@react-navigation/native";
import { sessionService, Message } from "../../services/session";
import { materialService, Material, offlineService } from "../../services/material";
import { SelectableText } from "../../components/ui/SelectableText";
import { AskAkademiModal } from "../../components/ui/AskAkademiModal";
import { Skeleton } from "../../components/ui/Skeleton";
import { PdfSelectableViewer } from "../../components/ui/PdfSelectableViewer";

const formatStudyContent = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

interface ReaderPage {
  id: string;
  chapterTitle: string;
  pageTitle: string;
  content: string;
  pageNumber: number;
  pageCountInChapter: number;
  blocks?: ReaderBlock[];
}

interface ReaderBlock {
  id: string;
  type: "text" | "image";
  text?: string;
  src?: string;
  alt?: string;
  caption?: string;
  description?: string;
}

interface ReaderStructure {
  version: number;
  generated_at: string;
  pages: ReaderPage[];
}

interface ReaderSection {
  id: string;
  title: string;
  blocks: ReaderBlock[];
}

const isMajorSectionTitle = (title: string) =>
  /^(chapter|unit|part|section)\s+\d+/i.test(title.trim()) ||
  /^\d+\.\s+[A-Z]/.test(title.trim());

const BOOK_PAGE_TARGET_CHARS = 3500;
const PAGE_FILL_MIN_RATIO = 0.4;

const HEADING_PATTERNS = [
  /^chapter\s+\d+/i,
  /^section\s+\d+/i,
  /^unit\s+\d+/i,
  /^\d+(\.\d+)*\s+[A-Z]/,
];

const SOFT_HEADING_PATTERNS = [
  /^slide\s+\d+/i,
];

const HARD_HEADING_PATTERNS = [
  /^chapter\s+\d+/i,
  /^unit\s+\d+/i,
  /^part\s+\d+/i,
];

const isLikelyHeading = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (HEADING_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;
  if (SOFT_HEADING_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;
  const words = trimmed.split(/\s+/);
  const uppercaseWords = words.filter((word) => /[A-Z]/.test(word) && word === word.toUpperCase()).length;
  return words.length <= 10 && uppercaseWords >= Math.max(1, Math.floor(words.length * 0.6));
};

const isSoftHeading = (line: string) => SOFT_HEADING_PATTERNS.some((pattern) => pattern.test(line.trim()));
const isHardHeading = (line: string) => HARD_HEADING_PATTERNS.some((pattern) => pattern.test(line.trim()));

const chunkSection = (sectionTitle: string, body: string, maxChars = BOOK_PAGE_TARGET_CHARS): ReaderPage[] => {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  paragraphs.forEach((paragraph) => {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  });

  if (current) chunks.push(current);
  if (!chunks.length && body.trim()) chunks.push(body.trim());

  return chunks.map((chunk, index) => ({
    id: `${sectionTitle}-${index + 1}`,
    chapterTitle: sectionTitle,
    pageTitle: chunks.length > 1 ? `${sectionTitle} | Page ${index + 1}` : sectionTitle,
    content: chunk,
    pageNumber: index + 1,
    pageCountInChapter: chunks.length,
  }));
};

const repaginateStructuredPages = (pages: ReaderPage[]): ReaderPage[] => {
  if (!pages.length) return pages;

  const mergedPages: ReaderPage[] = [];
  let currentTitle = "";
  let currentContent = "";
  let currentStartTitle = "";

  const flushCurrent = () => {
    if (!currentContent.trim()) return;
    const title = currentStartTitle || currentTitle || "Reading";
    mergedPages.push(...chunkSection(title, currentContent.trim(), BOOK_PAGE_TARGET_CHARS));
    currentTitle = "";
    currentContent = "";
    currentStartTitle = "";
  };

  pages.forEach((page) => {
    const title = page.chapterTitle || page.pageTitle || "Reading";
    const renderedSection = title && title !== "Reading"
      ? `${title}\n\n${page.content.trim()}`
      : page.content.trim();

    if (!renderedSection) return;

    if (isHardHeading(title)) {
      flushCurrent();
      currentStartTitle = title;
      currentTitle = title;
      currentContent = page.content.trim();
      return;
    }

    if (!currentContent) {
      currentStartTitle = title;
      currentTitle = title;
      currentContent = renderedSection;
      return;
    }

    const candidate = `${currentContent}\n\n${renderedSection}`.trim();
    const hasEnoughFill = currentContent.length >= BOOK_PAGE_TARGET_CHARS * PAGE_FILL_MIN_RATIO;
    if (candidate.length > BOOK_PAGE_TARGET_CHARS && hasEnoughFill) {
      flushCurrent();
      currentStartTitle = title;
      currentTitle = title;
      currentContent = renderedSection;
      return;
    }

    currentContent = candidate;
    currentTitle = title;
  });

  flushCurrent();

  return mergedPages.length ? mergedPages : pages;
};

const buildReaderPages = (rawContent: string): ReaderPage[] => {
  const normalized = formatStudyContent(rawContent);
  if (!normalized) {
    return [{
      id: "empty-1",
      chapterTitle: "Reading",
      pageTitle: "Reading",
      content: "No content available.",
      pageNumber: 1,
      pageCountInChapter: 1,
    }];
  }

  const lines = normalized.split("\n").map((line) => line.trimEnd());
  const sections: Array<{ title: string; body: string[] }> = [];
  let activeTitle = "Introduction";
  let activeBody: string[] = [];

  const flushSection = () => {
    const bodyText = activeBody.join("\n").trim();
    if (bodyText) {
      sections.push({ title: activeTitle, body: [bodyText] });
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      activeBody.push("");
      return;
    }

    if (isLikelyHeading(trimmed)) {
      flushSection();
      activeTitle = trimmed.replace(/^#+\s*/, "");
      activeBody = [];
      return;
    }

    activeBody.push(trimmed);
  });

  flushSection();

  if (!sections.length) {
    return chunkSection("Reading", normalized);
  }

  return sections.flatMap((section) => chunkSection(section.title, section.body.join("\n")));
};

const normalizeReaderStructure = (value: Material["reader_structure"]): ReaderStructure | null => {
  if (!value || !Array.isArray(value.pages) || value.pages.length === 0) return null;
  const pages = value.pages
    .map((page): ReaderPage => ({
      id: String(page.id || ""),
      chapterTitle: String(page.chapterTitle || "Reading"),
      pageTitle: String(page.pageTitle || page.chapterTitle || "Reading"),
      content: String(page.content || "").trim(),
      pageNumber: Number(page.pageNumber || 1),
      pageCountInChapter: Number(page.pageCountInChapter || 1),
      blocks: Array.isArray(page.blocks)
        ? page.blocks
            .map((block: any): ReaderBlock => ({
              id: String(block.id || ""),
              type: block.type === "image" ? "image" : "text",
              text: block.text ? String(block.text) : undefined,
              src: block.src ? String(block.src) : undefined,
              alt: block.alt ? String(block.alt) : undefined,
              caption: block.caption ? String(block.caption) : undefined,
              description: block.description ? String(block.description) : undefined,
            }))
            .filter((block) => (block.type === "image" ? !!block.src : !!block.text))
        : undefined,
      }))
      .filter((page) => page.content);

  if (!pages.length) return null;
  const hasStructuredBlocks = pages.some((page) => Array.isArray(page.blocks) && page.blocks.length > 0);
  return {
    version: Number(value.version || 1),
    generated_at: String(value.generated_at || ""),
    pages: hasStructuredBlocks ? pages : repaginateStructuredPages(pages),
  };
};

export const StudyModeScreen: React.FC = () => {
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId, materialId, autoOpenTutor } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [material, setMaterial] = useState<Material | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [isAskModalVisible, setIsAskModalVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectedPassage, setSelectedPassage] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [hasReachedMaterialEnd, setHasReachedMaterialEnd] = useState(false);
  const [hasAutoOpenedTutor, setHasAutoOpenedTutor] = useState(false);
  const skeletonOpacity = useRef(new Animated.Value(0)).current;
  const extractionProgress = useRef(new Animated.Value(0)).current;
  const courseCode = material?.course_code || "General";
  const hasExtractedContent = Boolean(content.trim()) && content !== "No text content available for this material.";
  const displayContent = formatStudyContent(content || "No content available.");
  const backendReaderStructure = normalizeReaderStructure(material?.reader_structure);
  const readerPages = backendReaderStructure?.pages || buildReaderPages(displayContent);
  const currentPage = readerPages[Math.min(currentPageIndex, Math.max(readerPages.length - 1, 0))];
  const isLastPage = currentPageIndex === readerPages.length - 1;
  const currentImageBlocks = currentPage?.blocks?.filter((block) => block.type === "image" && !!block.src) || [];
  const hasImagePage = currentImageBlocks.length > 0;
  const pageTextLength = (currentPage?.content || "").trim().length;
  const pageSurfaceMinHeight = hasImagePage
    ? Math.max(520, Math.floor(windowHeight * 0.62))
    : Math.max(320, Math.min(460, 180 + Math.floor(pageTextLength * 0.42)));
  const embeddedImageHeight = hasImagePage
    ? Math.max(280, Math.floor(windowHeight * 0.32))
    : 220;
  const pdfViewerHeight = Math.max(windowHeight * 0.74, 560);
  const isPdfMaterial = material?.file_type === "PDF";
  const isDocMaterial = material?.file_type === "DOC";
  const showOriginalPdf = Boolean(material) && isPdfMaterial;
  const showOriginalDoc = Boolean(material) && isDocMaterial;
  const materialContext = material
    ? [
        `Material title: ${material.title}`,
        `Course: ${courseCode}`,
        `University: ${material.university}`,
        `Department: ${material.department}`,
        `Level: ${material.level}L`,
        material.content ? `Extracted text:\n${material.content}` : "Extracted text is not available yet.",
      ].join("\n")
    : content;
  const roadmapSections = Array.from(
    new Set(
      readerPages
        .map((page) => page.chapterTitle?.trim())
        .filter(Boolean) as string[],
    ),
  );
  useEffect(() => {
    Animated.timing(skeletonOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [skeletonOpacity]);

  useEffect(() => {
    if (!isExtracting) {
      extractionProgress.stopAnimation();
      extractionProgress.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(extractionProgress, {
          toValue: 0.85,
          duration: 2400,
          useNativeDriver: false,
        }),
        Animated.timing(extractionProgress, {
          toValue: 0.2,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      extractionProgress.stopAnimation();
    };
  }, [isExtracting, extractionProgress]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchContent = async (polling = false) => {
      try {
        if (!polling) {
          setLoading(true);
        }
        setLoadError(null);

        if (sessionId) {
          const messages = await sessionService.listMessages(sessionId);
          if (cancelled) return;
          const aiMsg = [...messages].reverse().find((m: Message) => m.role === "AI");
          setContent(aiMsg?.content || "");
          setIsExtracting(false);
          return;
        }

        if (materialId) {
          const data = await materialService.getMaterialDetails(materialId);
          if (cancelled) return;
          setMaterial(data);
          const hasContent = typeof data.content === "string" && data.content.trim().length > 0;
          setContent(hasContent ? data.content! : "No text content available for this material.");
          setIsExtracting(!hasContent);
          const downloaded = await offlineService.isDownloaded(materialId);
          if (cancelled) return;
          setIsDownloaded(downloaded);

          if (!hasContent) {
            pollTimer = setTimeout(() => {
              void fetchContent(true);
            }, 10000);
          }
        }
      } catch (error: any) {
        if (cancelled) return;
        console.error("Failed to fetch content:", error);
        setLoadError(error?.response?.data?.message || error?.message || "This material could not be loaded. Please try again.");
        setIsExtracting(false);
      } finally {
        if (!cancelled && !polling) {
          setLoading(false);
        }
      }
    };

    void fetchContent();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [sessionId, materialId, retryTick]);

  useEffect(() => {
    let cancelled = false;

    const loadOriginalDocument = async () => {
      if (!material || (material.file_type !== "PDF" && material.file_type !== "DOC")) {
        setPdfData(null);
        setDocumentUrl(null);
        setPdfLoadError(null);
        setPdfLoading(false);
        return;
      }

      setPdfLoading(true);
      setPdfLoadError(null);

      try {
        let base64Data = "";
        let resolvedDocumentUrl: string | null = null;

        if (material.file_type === "PDF" && material.file_ref?.startsWith("file://")) {
          base64Data = await FileSystem.readAsStringAsync(material.file_ref, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          const { url } = await materialService.getMaterialDownloadUrl(material.id);
          if (cancelled) return;

          if (material.file_type === "PDF") {
            const cacheUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${material.id}-viewer.pdf`;
            const downloadResult = await FileSystem.downloadAsync(url, cacheUri);
            if (cancelled) return;

            if (downloadResult.status !== 200) {
              throw new Error(`PDF download failed with status ${downloadResult.status}`);
            }

            base64Data = await FileSystem.readAsStringAsync(downloadResult.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } else {
            resolvedDocumentUrl = url;
          }
        }

        if (cancelled) return;
        setPdfData(base64Data);
        setDocumentUrl(resolvedDocumentUrl);
      } catch (error) {
        console.error("Failed to load original document:", error);
        if (cancelled) return;
        setPdfLoadError("We couldn't open the original file right now.");
      } finally {
        if (!cancelled) {
          setPdfLoading(false);
        }
      }
    };

    void loadOriginalDocument();

    return () => {
      cancelled = true;
    };
  }, [material?.id, material?.file_type, material?.file_ref]);

  useEffect(() => {
    setCurrentPageIndex(0);
  }, [content, materialId, sessionId]);

  useEffect(() => {
    setHasReachedMaterialEnd(false);
  }, [material?.id, material?.file_type, pdfData, documentUrl]);

  useEffect(() => {
    setHasAutoOpenedTutor(false);
  }, [materialId, sessionId]);

  useEffect(() => {
    if (!autoOpenTutor || hasAutoOpenedTutor || loading || !material) return;

    const tutorContext = [
      `Material title: ${material.title}`,
      `Course: ${courseCode}`,
      `University: ${material.university}`,
      `Department: ${material.department}`,
      `Level: ${material.level}L`,
      material.content ? `Extracted text:\n${material.content}` : "Extracted text is not available yet.",
    ].join("\n");

    setSelectedPassage(material.title);
    setSelectedText(tutorContext);
    setIsAskModalVisible(true);
    setHasAutoOpenedTutor(true);
  }, [autoOpenTutor, hasAutoOpenedTutor, loading, material, courseCode]);

  const handleAskAkademi = (text: string) => {
    const focusedPassage = text?.trim() || "";
    const surroundingPassage = currentPage?.content?.trim() || "";
    const focusedContext = [
      material?.title ? `Material: ${material.title}` : "",
      currentPage?.chapterTitle ? `Chapter: ${currentPage.chapterTitle}` : "",
      currentPage?.pageTitle && currentPage?.pageTitle !== currentPage?.chapterTitle
        ? `Page: ${currentPage.pageTitle}`
        : "",
      "Selected passage:",
      focusedPassage || surroundingPassage || materialContext,
      "",
      "Surrounding passage:",
      surroundingPassage,
      "",
      backendReaderStructure ? "Structured material context:" : "Full material context:",
      materialContext,
    ].filter(Boolean).join("\n");

    setSelectedPassage(focusedPassage);
    setSelectedText(focusedContext);
    setIsAskModalVisible(true);
  };

  const handleHighlight = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setHighlights((current) => current.includes(trimmed) ? current : [...current, trimmed]);
  };

  const handleAskAboutImage = (block: ReaderBlock) => {
    const imageFocus = block.caption || block.description || block.alt || "Embedded image from this material.";
    const imageContext = [
      material?.title ? `Material: ${material.title}` : "",
      currentPage?.chapterTitle ? `Chapter: ${currentPage.chapterTitle}` : "",
      currentPage?.pageTitle && currentPage.pageTitle !== currentPage.chapterTitle
        ? `Page: ${currentPage.pageTitle}`
        : "",
      "Selected image:",
      imageFocus,
      "",
      "Image details:",
      block.description || "",
      block.caption ? `Caption: ${block.caption}` : "",
      block.alt ? `Alt text: ${block.alt}` : "",
      "",
      "Surrounding passage:",
      currentPage?.content || materialContext,
      "",
      "Full material context:",
      materialContext,
    ].filter(Boolean).join("\n");

    setSelectedPassage(imageFocus);
    setSelectedText(imageContext);
    setIsAskModalVisible(true);
  };

  const handleDownload = async () => {
    if (!material) return;
    setDownloading(true);
    try {
      await offlineService.downloadMaterial(material);
      setIsDownloaded(true);
      Alert.alert("Success", "Material downloaded for offline use.");
    } catch (error) {
      console.error("Download failed:", error);
      Alert.alert("Error", "Failed to download material.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDocumentScroll = (event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const reachedEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
    setHasReachedMaterialEnd(reachedEnd);
  };

  if (loading) {
    return (
      <Screen style={styles.screen} hideHeader={true}>
        <Animated.ScrollView
          style={{ opacity: skeletonOpacity }}
          contentContainerStyle={styles.skeletonContainer}
          showsVerticalScrollIndicator={false}
        >
          {[0, 1, 2].map((section) => (
            <View key={section} style={styles.skeletonSection}>
              <Skeleton height={24} width="60%" borderRadius={8} style={styles.skeletonTitle} />
              {[0, 1, 2, 3, 4].map((line) => (
                <Skeleton key={line} height={14} width="100%" borderRadius={6} style={styles.skeletonLine} />
              ))}
              <Skeleton height={14} width="75%" borderRadius={6} style={styles.skeletonShortLine} />
            </View>
          ))}
        </Animated.ScrollView>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen style={styles.screen} hideHeader={true}>
        <View style={styles.statusContainer}>
          <AlertCircle size={34} color={colors.error} />
          <Text style={styles.statusTitle}>Failed to load material</Text>
          <Text style={styles.statusText}>{loadError || "This material could not be loaded. Please try again."}</Text>
          <Button
            label="Retry"
            onPress={() => {
              setLoadError(null);
              setMaterial(null);
              setContent("");
              setLoading(true);
              setRetryTick((value) => value + 1);
            }}
            style={styles.statusPrimaryButton}
          />
          <Button
            label="Go Back"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.statusSecondaryButton}
          />
        </View>
      </Screen>
    );
  }

  if (isExtracting && material) {
    const progressWidth = extractionProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    });

    return (
      <Screen style={styles.screen} hideHeader={true}>
        <View style={styles.statusContainer}>
          <BookOpen size={34} color={colors.primary} />
          <Text style={styles.statusTitle}>Preparing your material</Text>
          <Text style={styles.statusText}>
            We're extracting and processing this file. This usually takes 30 seconds to 2 minutes depending on file size.
          </Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressHint}>We’ll keep checking automatically.</Text>
        </View>
      </Screen>
    );
  }

  const goToPreviousPage = () => setCurrentPageIndex((index) => Math.max(index - 1, 0));
  const goToNextPage = () => setCurrentPageIndex((index) => Math.min(index + 1, readerPages.length - 1));

  return (
    <Screen style={styles.screen} hideHeader={true}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
          style={styles.headerBtn}
        >
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.h3]}>
          {material ? "Reading Material" : "Study Mode"}
        </Text>
        <View style={styles.headerRight}>
          {material && (
            <TouchableOpacity
              onPress={handleDownload}
              disabled={downloading || isDownloaded}
              style={styles.headerIconBtn}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : isDownloaded ? (
                <CheckCircle2 size={20} color={colors.success} />
              ) : (
                <Download size={20} color={colors.textPrimary} />
              )}
            </TouchableOpacity>
          )}
          <Badge label={material ? "Material" : "Study session"} variant="purple" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, (showOriginalPdf || showOriginalDoc) && styles.scrollContentPdf]}
        scrollEnabled={!(showOriginalPdf || showOriginalDoc)}
      >
        {material?.diagnostics?.warnings?.length ? (
          <View style={styles.diagnosticBanner}>
            <Text style={[styles.diagnosticTitle, typography.bodySmall]}>
              Material processing warning
            </Text>
            {material.diagnostics.warnings.map((warning, index) => (
              <View key={`${warning.code}-${index}`} style={styles.diagnosticItem}>
                <Text style={[styles.diagnosticMessage, typography.bodySmall]}>{warning.message}</Text>
                {warning.detail ? (
                  <Text style={[styles.diagnosticDetail, typography.caption]}>{warning.detail}</Text>
                ) : null}
              </View>
            ))}
            <Text style={[styles.diagnosticMeta, typography.caption]}>
              File type: {material.diagnostics.fileType || "Unknown"} | Pages: {material.diagnostics.pageCount} | Images found: {material.diagnostics.imageBlockCount}
            </Text>
          </View>
        ) : null}

        <View style={material ? [styles.documentSurface, (showOriginalPdf || showOriginalDoc) && styles.documentSurfacePdf] : undefined}>
        <Card
          noPadding={Boolean(material)}
          style={
            material
              ? ((showOriginalPdf || showOriginalDoc)
                  ? { ...styles.documentCard, ...styles.documentCardPdf }
                  : styles.documentCard)
              : { ...styles.studyCard, minHeight: pageSurfaceMinHeight }
          }
        >
          {!material && (
            <View style={styles.aiHeader}>
              <Avatar size={32} name="Scholar" />
              <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700", marginLeft: 12 }]}>
                Akademi Study Mode
              </Text>
            </View>
          )}

          {material && !hasExtractedContent ? (
            <View style={styles.extractionPending}>
              <BookOpen size={24} color={colors.warning} style={styles.pendingIcon} />
              <Text style={styles.pendingTitle}>Text extraction is still pending</Text>
              <Text style={styles.pendingText}>
                You can still ask Akademi about this material using its title and course details while the uploaded file is being processed.
              </Text>
              <Button
                label="Ask Akademi"
                variant="secondary"
                onPress={() => handleAskAkademi(materialContext)}
                style={styles.pendingAskBtn}
              />
            </View>
          ) : material ? (
            <View style={styles.documentFlow}>
              <Text style={[styles.documentTitle, typography.h1]}>{material.title}</Text>
              <Text style={styles.documentMeta}>
                {[courseCode, material.university, `${material.level}L`].filter(Boolean).join(" / ")}
              </Text>
              {showOriginalPdf ? (
                <View style={styles.pdfViewerShell}>
                  {pdfLoading ? (
                    <View style={[styles.pdfStatus, { height: pdfViewerHeight }]}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.pdfStatusText}>Opening original PDF...</Text>
                    </View>
                  ) : pdfLoadError ? (
                    <View style={[styles.pdfStatus, { height: pdfViewerHeight }]}>
                      <AlertCircle size={20} color={colors.warning} />
                      <Text style={styles.pdfStatusText}>{pdfLoadError}</Text>
                    </View>
                  ) : pdfData ? (
                    <PdfSelectableViewer
                      pdfBase64={pdfData}
                      height={pdfViewerHeight}
                      onAskAkademi={handleAskAkademi}
                      onHighlight={handleHighlight}
                      onReachEndChange={setHasReachedMaterialEnd}
                    />
                  ) : (
                    <View style={[styles.pdfStatus, { height: pdfViewerHeight }]}>
                      <Text style={styles.pdfStatusText}>Original PDF is not ready yet.</Text>
                    </View>
                  )}
                </View>
              ) : showOriginalDoc ? (
                <View style={styles.pdfViewerShell}>
                  {pdfLoading ? (
                    <View style={[styles.pdfStatus, { height: pdfViewerHeight }]}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.pdfStatusText}>Opening original document...</Text>
                    </View>
                  ) : pdfLoadError ? (
                    <View style={[styles.pdfStatus, { height: pdfViewerHeight }]}>
                      <AlertCircle size={20} color={colors.warning} />
                      <Text style={styles.pdfStatusText}>{pdfLoadError}</Text>
                    </View>
                  ) : documentUrl ? (
                    <WebView
                      source={{
                        uri: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentUrl)}`,
                      }}
                      style={[styles.pdfViewer, { height: pdfViewerHeight }]}
                      originWhitelist={["*"]}
                      startInLoadingState
                      nestedScrollEnabled
                      onScroll={handleDocumentScroll}
                      scrollEventThrottle={16}
                      renderLoading={() => (
                        <View style={[styles.pdfStatus, { height: pdfViewerHeight }]}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={styles.pdfStatusText}>Opening original document...</Text>
                        </View>
                      )}
                    />
                  ) : (
                    <View style={[styles.pdfStatus, { height: pdfViewerHeight }]}>
                      <Text style={styles.pdfStatusText}>Original document is not ready yet.</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.pdfStatus, { height: 240 }]}>
                  <Text style={styles.pdfStatusText}>This file format is not supported for in-app document view yet.</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={hasImagePage ? styles.pageContentWithImage : undefined}>
              {material && currentPage.pageTitle !== currentPage.chapterTitle ? (
                <Text style={[styles.pageTitle, typography.bodySmall]}>{currentPage.pageTitle}</Text>
              ) : null}
              {material && currentPage.blocks?.length ? (
                <View style={[styles.readerBlocks, hasImagePage && styles.readerBlocksWithImage]}>
                  {currentPage.blocks.map((block) =>
                    block.type === "image" && block.src ? (
                      <TouchableOpacity
                        key={block.id}
                        activeOpacity={0.92}
                        style={[styles.imageBlock, hasImagePage && styles.imageBlockExpanded]}
                        onPress={() => handleAskAboutImage(block)}
                      >
                        <Image source={{ uri: block.src }} style={[styles.embeddedImage, { height: embeddedImageHeight }]} resizeMode="contain" />
                        <Text style={[styles.imageHint, typography.caption]}>
                          Tap image to ask Akademi about it
                        </Text>
                        {block.caption ? (
                          <Text style={[styles.imageCaption, typography.bodySmall]}>{block.caption}</Text>
                        ) : null}
                        {block.description ? (
                          <Text style={[styles.imageDescription, typography.caption]} numberOfLines={3}>
                            {block.description}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ) : (
                      <SelectableText
                        key={block.id}
                        content={block.text || ""}
                        onAskAkademi={handleAskAkademi}
                        onHighlight={handleHighlight}
                      />
                    )
                  )}
                </View>
              ) : (
                <SelectableText
                  content={material ? currentPage.content : displayContent}
                  onAskAkademi={handleAskAkademi}
                  onHighlight={handleHighlight}
                />
              )}
            </View>
          )}
        </Card>
        </View>

        {!material && readerPages.length > 1 && (
          <View style={styles.pageNavigator}>
            <TouchableOpacity
              style={[styles.pageNavButton, currentPageIndex === 0 && styles.pageNavButtonDisabled]}
              onPress={goToPreviousPage}
              disabled={currentPageIndex === 0}
            >
              <ChevronLeft size={18} color={currentPageIndex === 0 ? colors.textMuted : colors.textPrimary} />
              <Text style={[styles.pageNavText, currentPageIndex === 0 && styles.pageNavTextDisabled]}>Previous</Text>
            </TouchableOpacity>
            <View style={styles.pageDots}>
              {readerPages.slice(0, Math.min(readerPages.length, 8)).map((page, index) => (
                <View
                  key={page.id}
                  style={[styles.pageDot, index === currentPageIndex && styles.pageDotActive]}
                />
              ))}
            </View>
            <TouchableOpacity
              style={[styles.pageNavButton, currentPageIndex === readerPages.length - 1 && styles.pageNavButtonDisabled]}
              onPress={goToNextPage}
              disabled={currentPageIndex === readerPages.length - 1}
            >
              <Text style={[styles.pageNavText, currentPageIndex === readerPages.length - 1 && styles.pageNavTextDisabled]}>Next</Text>
              <ChevronRight size={18} color={currentPageIndex === readerPages.length - 1 ? colors.textMuted : colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {highlights.length > 0 && (
          <View style={styles.highlightSummary}>
            <Text style={[styles.highlightTitle, typography.bodySmall]}>
              {highlights.length} highlight{highlights.length === 1 ? "" : "s"} saved for this study session
            </Text>
            <Text style={[styles.highlightText, typography.caption]} numberOfLines={2}>
              {highlights[highlights.length - 1]}
            </Text>
          </View>
        )}

        {((material && hasReachedMaterialEnd) || (!material && isLastPage)) && (
          <View style={[styles.bottomBar, material && styles.bottomBarDocument]}>
            {material && (
              <Button
                label="Practice CBT"
                icon={<ClipboardList size={18} color="#FFFFFF" />}
                onPress={() => navigation.navigate("MaterialPractice", { materialId: material.id, title: material.title })}
                style={styles.practiceBtn}
              />
            )}
            <Button
              label="Finish Study"
              variant="secondary"
              onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
              style={styles.finishBtn}
            />
          </View>
        )}
      </ScrollView>

      <AskAkademiModal
        visible={isAskModalVisible}
        onClose={() => setIsAskModalVisible(false)}
        contextText={selectedText}
        courseCode={courseCode}
        materialId={material?.id}
        materialTitle={material?.title}
        selectedPassage={selectedPassage || undefined}
        surroundingPassage={currentPage?.content || undefined}
        chapterTitle={currentPage?.chapterTitle}
        pageTitle={currentPage?.pageTitle}
        materialContext={materialContext}
        roadmapSections={roadmapSections}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  skeletonContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  skeletonSection: {
    marginBottom: 28,
  },
  skeletonTitle: {
    marginBottom: 16,
  },
  skeletonLine: {
    marginBottom: 10,
  },
  skeletonShortLine: {
    marginBottom: 24,
  },
  statusContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  statusTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 10,
  },
  statusText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 18,
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  progressHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statusPrimaryButton: {
    marginTop: 6,
  },
  statusSecondaryButton: {
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerBtn: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  scrollContentPdf: {
    paddingHorizontal: 0,
  },
  studyCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 20,
    padding: 18,
    minHeight: 520,
  },
  documentSurface: {
    marginBottom: 20,
  },
  documentSurfacePdf: {
    marginBottom: 0,
  },
  documentCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 12,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  documentCardPdf: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  diagnosticBanner: {
    backgroundColor: "#2A1606",
    borderColor: "#7C4A10",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  diagnosticTitle: {
    color: "#FBBF24",
    fontWeight: "700",
    marginBottom: 8,
  },
  diagnosticItem: {
    marginBottom: 8,
  },
  diagnosticMessage: {
    color: colors.textPrimary,
    marginBottom: 2,
  },
  diagnosticDetail: {
    color: colors.textSecondary,
    lineHeight: 16,
  },
  diagnosticMeta: {
    color: "#FCD34D",
    marginTop: 4,
  },
  pageTitle: {
    color: colors.primary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  documentFlow: {
    gap: 0,
  },
  documentTitle: {
    color: "#D6E4FF",
    lineHeight: 46,
    marginBottom: 10,
  },
  documentMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 22,
  },
  readerModeSwitch: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  readerModeButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  readerModeButtonActive: {
    backgroundColor: colors.primary,
  },
  readerModeLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  readerModeLabelActive: {
    color: "#04130A",
  },
  pdfViewerShell: {
    overflow: "hidden",
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "#0F1115",
    marginBottom: 0,
  },
  pdfViewer: {
    width: "100%",
    backgroundColor: "#0F1115",
  },
  pdfStatus: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  pdfStatusText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  pdfFallbackButton: {
    marginTop: 6,
  },
  documentSection: {
    gap: 10,
  },
  documentSectionSpacing: {
    marginBottom: 20,
    marginTop: 20,
  },
  documentHeading: {
    color: "#D6E4FF",
    fontWeight: "700",
    lineHeight: 34,
    marginTop: 6,
  },
  documentLeadHeading: {
    color: "#E5E7EB",
    fontStyle: "italic",
    fontWeight: "400",
    lineHeight: 34,
  },
  documentSectionContent: {
    gap: 10,
  },
  documentImageWrap: {
    gap: 8,
    marginVertical: 2,
  },
  documentImage: {
    width: "100%",
    height: 250,
    backgroundColor: "#FFFFFF",
  },
  documentCaption: {
    color: "#E5E7EB",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 24,
  },
  documentDivider: {
    height: 1,
    backgroundColor: "#5D6B85",
    opacity: 0.65,
    marginTop: 12,
  },
  pageContentWithImage: {
    flex: 1,
    justifyContent: "space-between",
  },
  readerBlocks: {
    gap: 18,
  },
  readerBlocksWithImage: {
    flex: 1,
    justifyContent: "center",
  },
  imageBlock: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageBlockExpanded: {
    flexGrow: 1,
    justifyContent: "center",
  },
  embeddedImage: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    backgroundColor: "#050505",
    marginBottom: 10,
  },
  imageHint: {
    color: colors.primary,
    marginBottom: 6,
  },
  imageCaption: {
    color: colors.textPrimary,
    marginBottom: 6,
  },
  imageDescription: {
    color: colors.textSecondary,
    lineHeight: 18,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  aiName: {
    color: "#FFFFFF",
  },
  pageNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -4,
    marginBottom: 20,
    gap: 12,
  },
  pageNavButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pageNavButtonDisabled: {
    opacity: 0.5,
  },
  pageNavText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  pageNavTextDisabled: {
    color: colors.textMuted,
  },
  pageDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  pageDotActive: {
    width: 18,
    backgroundColor: colors.primary,
  },
  extractionPending: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  pendingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  pendingIcon: {
    marginBottom: 12,
  },
  pendingAskBtn: {
    marginTop: 16,
  },
  highlightSummary: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    marginTop: -12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primary + "55",
  },
  highlightTitle: {
    color: colors.primary,
    fontWeight: "700",
    marginBottom: 6,
  },
  highlightText: {
    color: colors.textSecondary,
    lineHeight: 16,
  },
  bottomBar: {
    flexDirection: "row",
    gap: 12,
  },
  bottomBarDocument: {
    marginTop: 4,
  },
  backBtn: {
    flex: 1,
  },
  practiceBtn: {
    flex: 1,
  },
  finishBtn: {
    flex: 1,
  },
});
