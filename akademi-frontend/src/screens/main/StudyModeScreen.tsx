import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
} from "react-native";
import { X, Download, CheckCircle2, ClipboardList, Headphones, BookOpen, ChevronLeft, ChevronRight, PanelRightOpen } from "lucide-react-native";
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
}

interface ReaderStructure {
  version: number;
  generated_at: string;
  pages: ReaderPage[];
}

const BOOK_PAGE_TARGET_CHARS = 1800;
const PAGE_FILL_MIN_RATIO = 0.68;

const HEADING_PATTERNS = [
  /^chapter\s+\d+/i,
  /^section\s+\d+/i,
  /^unit\s+\d+/i,
  /^\d+(\.\d+)*\s+[A-Z]/,
];

const SOFT_HEADING_PATTERNS = [
  /^slide\s+\d+/i,
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

    if (!isSoftHeading(title)) {
      flushCurrent();
      mergedPages.push(...chunkSection(title, page.content.trim(), BOOK_PAGE_TARGET_CHARS));
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
    .map((page) => ({
      id: String(page.id || ""),
      chapterTitle: String(page.chapterTitle || "Reading"),
      pageTitle: String(page.pageTitle || page.chapterTitle || "Reading"),
      content: String(page.content || "").trim(),
      pageNumber: Number(page.pageNumber || 1),
      pageCountInChapter: Number(page.pageCountInChapter || 1),
    }))
    .filter((page) => page.content);

  if (!pages.length) return null;
  return {
    version: Number(value.version || 1),
    generated_at: String(value.generated_at || ""),
    pages: repaginateStructuredPages(pages),
  };
};

export const StudyModeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId, materialId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [material, setMaterial] = useState<Material | null>(null);
  const [isAskModalVisible, setIsAskModalVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectedPassage, setSelectedPassage] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const courseCode = material?.course_code || "General";
  const hasExtractedContent = Boolean(content.trim()) && content !== "No text content available for this material.";
  const displayContent = formatStudyContent(content || "No content available.");
  const backendReaderStructure = normalizeReaderStructure(material?.reader_structure);
  const readerPages = backendReaderStructure?.pages || buildReaderPages(displayContent);
  const currentPage = readerPages[Math.min(currentPageIndex, Math.max(readerPages.length - 1, 0))];
  const isLastPage = currentPageIndex === readerPages.length - 1;
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

  useEffect(() => {
    const fetchContent = async () => {
      try {
        if (sessionId) {
          const messages = await sessionService.listMessages(sessionId);
          const aiMsg = [...messages].reverse().find((m: Message) => m.role === "AI");
          if (aiMsg) setContent(aiMsg.content);
        } else if (materialId) {
          const data = await materialService.getMaterialDetails(materialId);
          setMaterial(data);
          setContent(data.content || "No text content available for this material.");
          const downloaded = await offlineService.isDownloaded(materialId);
          setIsDownloaded(downloaded);
        }
      } catch (error) {
        console.error("Failed to fetch content:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [sessionId, materialId]);

  useEffect(() => {
    setCurrentPageIndex(0);
  }, [content, materialId, sessionId]);

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

  if (loading) {
    return (
      <Screen style={styles.screen} hideHeader={true}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {material && (
          <View style={styles.materialHeader}>
            <Text style={[styles.materialTitle, typography.h2]}>{material.title}</Text>
            <Text style={styles.materialMeta}>
              {[courseCode, material.university, `${material.level}L`].filter(Boolean).join(" / ")}
            </Text>
          </View>
        )}

        {material && (
          <View style={styles.readerStatusBand}>
            <View style={styles.readerStatusLeft}>
              <Text style={[styles.readerEyebrow, typography.label]}>Chapter View</Text>
              <Text style={[styles.readerChapterTitle, typography.h3]} numberOfLines={2}>
                {currentPage.chapterTitle}
              </Text>
              <Text style={styles.readerPageMeta}>
                Page {currentPageIndex + 1} of {readerPages.length}
                {currentPage.pageCountInChapter > 1 ? ` | Chapter page ${currentPage.pageNumber}/${currentPage.pageCountInChapter}` : ""}
              </Text>
            </View>
            <View style={styles.readerBadge}>
              <PanelRightOpen size={16} color={colors.primary} />
              <Text style={styles.readerBadgeText}>{readerPages.length} pages</Text>
            </View>
          </View>
        )}

        <Card style={styles.studyCard}>
          {!material && (
            <View style={styles.aiHeader}>
              <Avatar size={32} name="Scholar" />
              <Text style={[styles.aiName, typography.bodySmall, { fontWeight: "700", marginLeft: 12 }]}>
                Akademi AI Tutor
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
          ) : (
            <View>
              {material && currentPage.pageTitle !== currentPage.chapterTitle ? (
                <Text style={[styles.pageTitle, typography.bodySmall]}>{currentPage.pageTitle}</Text>
              ) : null}
              <SelectableText
                content={material ? currentPage.content : displayContent}
                onAskAkademi={handleAskAkademi}
                onHighlight={handleHighlight}
              />
            </View>
          )}
        </Card>

        {material && readerPages.length > 1 && (
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

        <TouchableOpacity
          style={styles.tutorBanner}
          onPress={() => navigation.navigate("LiveTutorEntry", {
            courseCode,
            topic: material?.title || courseCode,
            materialId: material?.id,
            materialTitle: material?.title,
            materialContext,
          })}
        >
          <View style={styles.tutorIcon}>
            <Headphones size={18} color={colors.primary} />
          </View>
          <View style={styles.tutorTextContainer}>
            <Text style={[styles.tutorText, typography.bodySmall]}>
              Still stuck on this page? Start a live tutor session from the exact passage you are reading.
            </Text>
            <Text style={styles.tutorLink}>Ask the Live Tutor</Text>
          </View>
        </TouchableOpacity>

        {isLastPage && (
          <View style={styles.bottomBar}>
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
        materialTitle={material?.title}
        selectedPassage={selectedPassage || undefined}
        surroundingPassage={currentPage?.content || undefined}
        chapterTitle={currentPage?.chapterTitle}
        pageTitle={currentPage?.pageTitle}
        materialContext={materialContext}
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
  materialHeader: {
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  materialTitle: {
    color: colors.textPrimary,
    lineHeight: 27,
    marginBottom: 6,
  },
  materialMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  studyCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 20,
    padding: 18,
    minHeight: 520,
  },
  readerStatusBand: {
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  readerStatusLeft: {
    flex: 1,
  },
  readerEyebrow: {
    color: colors.primary,
    marginBottom: 6,
  },
  readerChapterTitle: {
    color: colors.textPrimary,
    marginBottom: 4,
  },
  readerPageMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  readerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#0D1711",
    borderWidth: 1,
    borderColor: "#1D3528",
  },
  readerBadgeText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  pageTitle: {
    color: colors.primary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  aiName: {
    color: "#FFFFFF",
  },
  tutorBanner: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
    marginBottom: 28,
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
  tutorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + "18",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  tutorTextContainer: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  tutorText: {
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  tutorLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "600",
  },
  bottomBar: {
    gap: 16,
  },
  backBtn: {
    flex: 1,
  },
  practiceBtn: {
    marginBottom: 12,
  },
  finishBtn: {
  },
});
