import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";

import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { sessionService } from "../../services/session";
import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";

type RawVisualCue = {
  id: string;
  visual_type: string;
  render_mode: string;
  start_ms: number;
  end_ms: number;
  payload?: any;
  image_url?: string | null;
  generation_status?: string | null;
  generation_error?: string | null;
};

type RawLessonSegment = {
  id: string;
  concept_title: string;
  script: string;
  caption_chunks?: Array<{
    id?: string;
    text?: string;
    duration_ms?: number;
  }>;
  order: number;
  estimated_duration_ms: number;
  visual_cues?: RawVisualCue[];
};

type CaptionChunk = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
};

type LessonSegment = {
  id: string;
  conceptTitle: string;
  script: string;
  captions: CaptionChunk[];
  visualCues: RawVisualCue[];
  estimatedDurationMs: number;
};

const MIN_SEGMENT_DURATION = 12000;

const safeText = (value: unknown, fallback = "") => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    return text || fallback;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate =
      record.label ??
      record.title ??
      record.name ??
      record.text ??
      record.value ??
      record.concept ??
      record.description;

    if (candidate !== undefined) {
      return safeText(candidate, fallback);
    }
  }

  return fallback;
};

const splitScriptIntoCaptions = (script: string, estimatedDurationMs: number): CaptionChunk[] => {
  const sentences = script
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks = sentences.length > 0 ? sentences : [script.trim()].filter(Boolean);
  const totalDuration = Math.max(estimatedDurationMs, MIN_SEGMENT_DURATION);
  const durationPerChunk = Math.max(Math.floor(totalDuration / Math.max(chunks.length, 1)), 2500);

  let cursor = 0;
  return chunks.map((text, index) => {
    const duration = index === chunks.length - 1 ? totalDuration - cursor : durationPerChunk;
    const chunk = {
      id: `caption-${index + 1}`,
      text,
      startMs: cursor,
      endMs: cursor + Math.max(duration, 1800),
    };
    cursor = chunk.endMs;
    return chunk;
  });
};

const normalizeSegment = (segment: RawLessonSegment): LessonSegment => {
  const script = safeText(segment.script, segment.concept_title);
  const generatedCaptions = splitScriptIntoCaptions(script, segment.estimated_duration_ms);
  let cursor = 0;
  const suppliedCaptions = Array.isArray(segment.caption_chunks)
    ? segment.caption_chunks
        .map((chunk, index) => {
          const text = safeText(chunk?.text);
          if (!text) return null;
          const duration = Math.max(Number(chunk?.duration_ms) || 0, 1800);
          const caption = {
            id: chunk?.id || `caption-${index + 1}`,
            text,
            startMs: cursor,
            endMs: cursor + duration,
          };
          cursor = caption.endMs;
          return caption;
        })
        .filter(Boolean) as CaptionChunk[]
    : [];

  const captions = suppliedCaptions.length > 0 ? suppliedCaptions : generatedCaptions;
  const estimatedDurationMs = Math.max(
    Number(segment.estimated_duration_ms) || 0,
    captions[captions.length - 1]?.endMs || 0,
    MIN_SEGMENT_DURATION,
  );

  return {
    id: segment.id,
    conceptTitle: safeText(segment.concept_title, "Tutor lesson"),
    script,
    captions,
    estimatedDurationMs,
    visualCues: Array.isArray(segment.visual_cues)
      ? segment.visual_cues
          .map((cue) => ({
            ...cue,
            visual_type: safeText(cue.visual_type, "bullet_card"),
            render_mode: safeText(cue.render_mode, "bullet_card"),
            start_ms: Math.max(Number(cue.start_ms) || 0, 0),
            end_ms: Math.max(Number(cue.end_ms) || 0, Number(cue.start_ms) || 0, 5000),
            payload: cue.payload || {},
            image_url: cue.image_url || null,
            generation_status: cue.generation_status || null,
            generation_error: cue.generation_error || null,
          }))
          .sort((a, b) => a.start_ms - b.start_ms)
      : [],
  };
};

const parseMermaidLabels = (source: string) => {
  const labels: string[] = [];
  const bracketMatches = source.matchAll(/\[([^\]]+)\]/g);
  for (const match of bracketMatches) {
    if (match[1]) labels.push(match[1].trim());
  }

  if (labels.length > 0) return Array.from(new Set(labels)).slice(0, 6);

  return source
    .replace(/flowchart\s+(LR|TD|TB|RL|BT)/gi, "")
    .split(/-->|---|;|\n/)
    .map((item) => item.replace(/[A-Z0-9_]+\s*/gi, "").replace(/[\[\](){}]/g, "").trim())
    .filter(Boolean)
    .slice(0, 6);
};

const compactVisualPhrase = (value: string, fallback = "Key idea") => {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/^now\s+teaching\s*/i, "")
    .trim();
  if (!cleaned) return fallback;

  const words = cleaned.split(" ").filter(Boolean);
  return words.slice(0, 6).join(" ");
};

export const WhiteboardTutorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params || {};
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [segments, setSegments] = useState<LessonSegment[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const baseElapsedRef = useRef(0);

  const activeSegment = segments[activeSegmentIndex] || null;
  const activeVisual = activeSegment?.visualCues.find(
    (cue) => elapsedMs >= cue.start_ms && elapsedMs < cue.end_ms,
  ) || activeSegment?.visualCues[0] || null;
  const progress = activeSegment
    ? Math.min(elapsedMs / Math.max(activeSegment.estimatedDurationMs, 1), 1)
    : 0;
  const pendingWhiteboardImageCount = useMemo(
    () =>
      segments.reduce((count, segment) => (
        count + segment.visualCues.filter((cue) => {
          if (cue.image_url) return false;
          const status = cue.generation_status || "PENDING";
          return status === "PENDING" || status === "PROCESSING";
        }).length
      ), 0),
    [segments],
  );

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startedAtRef.current = null;
  }, []);

  const pausePlayback = useCallback(async () => {
    stopTimer();
    setIsPlaying(false);
    await Speech.stop();
    baseElapsedRef.current = elapsedMs;
  }, [elapsedMs, stopTimer]);

  const goToSegment = useCallback(
    async (index: number, autoPlay = false) => {
      const nextIndex = Math.max(0, Math.min(index, segments.length - 1));
      await Speech.stop();
      stopTimer();
      setActiveSegmentIndex(nextIndex);
      setElapsedMs(0);
      baseElapsedRef.current = 0;
      setIsPlaying(false);
      if (autoPlay) {
        setTimeout(() => {
          setIsPlaying(true);
        }, 80);
      }
    },
    [segments.length, stopTimer],
  );

  const startPlayback = useCallback(async () => {
    if (!activeSegment) return;

    await Speech.stop();
    const startOffset = baseElapsedRef.current;
    startedAtRef.current = Date.now();
    setIsPlaying(true);

    intervalRef.current = setInterval(() => {
      const startedAt = startedAtRef.current || Date.now();
      const nextElapsed = Math.min(
        startOffset + (Date.now() - startedAt),
        activeSegment.estimatedDurationMs,
      );
      setElapsedMs(nextElapsed);

      if (nextElapsed >= activeSegment.estimatedDurationMs) {
        stopTimer();
        setIsPlaying(false);
        baseElapsedRef.current = 0;
      }
    }, 180);

    if (voiceEnabled) {
      Speech.speak(activeSegment.script, {
        rate: 0.92,
        pitch: 1,
        onDone: () => {
          stopTimer();
          setElapsedMs(activeSegment.estimatedDurationMs);
          baseElapsedRef.current = 0;
          setIsPlaying(false);
        },
        onStopped: () => undefined,
        onError: () => {
          stopTimer();
          setIsPlaying(false);
        },
      });
    }
  }, [activeSegment, stopTimer, voiceEnabled]);

  const loadLesson = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
        setError(null);
      }
      const rawLesson = await sessionService.getPlayableLesson(sessionId);
      const rawSegments = Array.isArray(rawLesson)
        ? rawLesson
        : Array.isArray(rawLesson?.segments)
          ? rawLesson.segments
          : [];
      const normalized = rawSegments
        .map(normalizeSegment)
        .filter((segment: LessonSegment) => segment.script.length > 0)
        .sort((a: LessonSegment, b: LessonSegment) => {
          const aOrder = Number((rawSegments.find((item: RawLessonSegment) => item.id === a.id) || {}).order) || 0;
          const bOrder = Number((rawSegments.find((item: RawLessonSegment) => item.id === b.id) || {}).order) || 0;
          return aOrder - bOrder;
        });

      if (normalized.length === 0) {
        throw new Error("No playable lesson is available yet.");
      }

      setSegments(normalized);
      if (!options?.silent) {
        setActiveSegmentIndex(0);
        setElapsedMs(0);
        baseElapsedRef.current = 0;
      }
    } catch (err: any) {
      console.error("Failed to load whiteboard lesson:", err);
      if (!options?.silent) {
        setError(err?.response?.data?.message || err?.message || "Could not load this whiteboard lesson.");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadLesson();
    return () => {
      stopTimer();
      void Speech.stop();
    };
  }, [sessionId, stopTimer]);

  useEffect(() => {
    if (isPlaying && !intervalRef.current) {
      void startPlayback();
    }
  }, [isPlaying, startPlayback]);

  useEffect(() => {
    if (!pendingWhiteboardImageCount) return undefined;

    const poller = setInterval(() => {
      void loadLesson({ silent: true });
    }, 4000);

    return () => clearInterval(poller);
  }, [pendingWhiteboardImageCount, sessionId]);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      await pausePlayback();
      return;
    }
    await startPlayback();
  };

  const handleRestart = async () => {
    await Speech.stop();
    stopTimer();
    setElapsedMs(0);
    baseElapsedRef.current = 0;
    setIsPlaying(false);
  };

  const renderTitleBoard = (payload: any) => (
    <View style={styles.centerBoard}>
      <Text style={styles.boardEyebrow}>NOW TEACHING</Text>
      <Text style={styles.boardTitle}>{safeText(payload?.title, activeSegment?.conceptTitle || "Tutor lesson")}</Text>
      {!!payload?.subtitle && <Text style={styles.boardSubtitle}>{payload.subtitle}</Text>}
    </View>
  );

  const renderBulletCard = (payload: any) => {
    const bullets = Array.isArray(payload?.bullets)
      ? payload.bullets.map((item: unknown) => safeText(item)).filter(Boolean)
      : [
          "Main concept",
          "How it connects",
          "What to remember",
        ];

    return (
      <View style={styles.bulletBoard}>
        <Text style={styles.boardTitleSmall}>{safeText(payload?.title, activeSegment?.conceptTitle || "Key idea")}</Text>
        {bullets.slice(0, 5).map((bullet: string, index: number) => (
          <View key={`${bullet}-${index}`} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderTable = (payload: any) => {
    const headers = Array.isArray(payload?.headers) ? payload.headers.map((item: unknown) => safeText(item)) : ["Idea", "Meaning"];
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];

    return (
      <View style={styles.tableBoard}>
        <View style={styles.tableRow}>
          {headers.slice(0, 3).map((header: string, index: number) => (
            <Text key={`${header}-${index}`} style={[styles.tableCell, styles.tableHeader]} numberOfLines={2}>
              {header}
            </Text>
          ))}
        </View>
        {rows.slice(0, 4).map((row: unknown, rowIndex: number) => {
          const cells = Array.isArray(row) ? row : Object.values((row || {}) as Record<string, unknown>);
          return (
            <View key={`row-${rowIndex}`} style={styles.tableRow}>
              {cells.slice(0, headers.length || 2).map((cell: unknown, cellIndex: number) => (
                <Text key={`cell-${rowIndex}-${cellIndex}`} style={styles.tableCell} numberOfLines={3}>
                  {safeText(cell)}
                </Text>
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  const renderFlow = (payload: any) => {
    const source = safeText(payload?.source || payload?.mermaid || payload?.diagram);
    const labels = Array.isArray(payload?.steps)
      ? payload.steps.map((item: unknown) => safeText(item)).filter(Boolean)
      : parseMermaidLabels(source);
    const items = labels.length > 0
      ? labels
      : [
          "Foundation",
          compactVisualPhrase(activeSegment?.conceptTitle || "", "Concept"),
          "Checkpoint",
        ];

    return (
      <View style={styles.flowBoard}>
        {items.slice(0, 5).map((label: string, index: number) => (
          <React.Fragment key={`${label}-${index}`}>
            <View style={styles.flowNode}>
              <Text style={styles.flowNodeText} numberOfLines={2}>{label}</Text>
            </View>
            {index < Math.min(items.length, 5) - 1 && <Text style={styles.flowArrow}>{"->"}</Text>}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const renderTimeline = (payload: any) => {
    const items = Array.isArray(payload?.items)
      ? payload.items.map((item: unknown) => typeof item === "string" ? { label: item } : item as any)
      : parseMermaidLabels(safeText(payload?.source || payload?.mermaid)).map((label) => ({ label }));
    const safeItems = (items.length > 0 ? items : [{ label: activeSegment?.conceptTitle || "Start" }, { label: "Checkpoint" }]).slice(0, 4);

    return (
      <View style={styles.timelineBoard}>
        <Svg width="100%" height={108} viewBox="0 0 320 108">
          <Line x1="38" y1="54" x2="282" y2="54" stroke={colors.primary} strokeWidth="3" />
          {safeItems.map((item: any, index: number) => {
            const x = 40 + index * (240 / Math.max(safeItems.length - 1, 1));
            return (
              <React.Fragment key={`timeline-${index}`}>
                <Circle cx={x} cy="54" r="10" fill={colors.primary} />
                <SvgText x={x} y={index % 2 === 0 ? 30 : 88} fill={colors.textPrimary} fontSize="10" textAnchor="middle">
                  {safeText(item.label || item.title, `Step ${index + 1}`).slice(0, 18)}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    );
  };

  const renderLabeledDiagram = (payload: any) => {
    const labels = Array.isArray(payload?.labels)
      ? payload.labels.map((item: unknown) => safeText(item)).filter(Boolean)
      : Array.isArray(payload?.parts)
        ? payload.parts.map((item: unknown) => safeText(item)).filter(Boolean)
        : [
            compactVisualPhrase(activeSegment?.conceptTitle || "", "Concept"),
            "Detail",
            "Example",
          ];

    const safeLabels = labels.slice(0, 4);

    return (
      <View style={styles.diagramBoard}>
        <Svg width="100%" height={220} viewBox="0 0 320 220">
          <Circle cx="160" cy="108" r="46" fill={`${colors.primary}22`} stroke={colors.primary} strokeWidth="3" />
          <Rect x="126" y="86" width="68" height="44" rx="10" fill={colors.surfaceElevated} stroke={colors.border} strokeWidth="2" />
          <SvgText x="160" y="112" fill={colors.textPrimary} fontSize="11" fontWeight="700" textAnchor="middle">
            {compactVisualPhrase(safeText(payload?.center || activeSegment?.conceptTitle), "Core").slice(0, 16)}
          </SvgText>
          {safeLabels.map((label: string, index: number) => {
            const positions = [
              { x1: 122, y1: 78, x2: 56, y2: 44, tx: 54, ty: 34, anchor: "start" },
              { x1: 198, y1: 78, x2: 264, y2: 44, tx: 266, ty: 34, anchor: "end" },
              { x1: 122, y1: 140, x2: 56, y2: 178, tx: 54, ty: 198, anchor: "start" },
              { x1: 198, y1: 140, x2: 264, y2: 178, tx: 266, ty: 198, anchor: "end" },
            ][index];
            return (
              <React.Fragment key={`${label}-${index}`}>
                <Line x1={positions.x1} y1={positions.y1} x2={positions.x2} y2={positions.y2} stroke={colors.primary} strokeWidth="2" />
                <Circle cx={positions.x2} cy={positions.y2} r="4" fill={colors.primary} />
                <SvgText x={positions.tx} y={positions.ty} fill={colors.textPrimary} fontSize="10" textAnchor={positions.anchor as any}>
                  {compactVisualPhrase(label).slice(0, 20)}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    );
  };

  const renderConceptMap = (payload: any) => {
    const nodes = Array.isArray(payload?.nodes)
      ? payload.nodes.map((item: unknown) => safeText(item)).filter(Boolean)
      : [
          "Prerequisite",
          compactVisualPhrase(activeSegment?.conceptTitle || "", "Topic"),
          "Application",
          "Check",
        ];

    return (
      <View style={styles.conceptMapBoard}>
        <View style={styles.conceptCenter}>
          <Lightbulb size={22} color={colors.background} />
          <Text style={styles.conceptCenterText} numberOfLines={2}>
            {compactVisualPhrase(activeSegment?.conceptTitle || "", "Core idea")}
          </Text>
        </View>
        <View style={styles.conceptGrid}>
          {nodes.slice(0, 4).map((node: string, index: number) => (
            <View key={`${node}-${index}`} style={styles.conceptNode}>
              <Text style={styles.conceptNodeText} numberOfLines={2}>{compactVisualPhrase(node)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderGraph = (payload: any) => (
    <View style={styles.graphBoard}>
      <Svg width="100%" height={170} viewBox="0 0 320 170">
        <Line x1="38" y1="132" x2="286" y2="132" stroke={colors.textSecondary} strokeWidth="2" />
        <Line x1="38" y1="132" x2="38" y2="24" stroke={colors.textSecondary} strokeWidth="2" />
        <Line x1="58" y1="112" x2="268" y2="42" stroke={colors.primary} strokeWidth="4" />
        <Circle cx="58" cy="112" r="5" fill={colors.primary} />
        <Circle cx="268" cy="42" r="5" fill={colors.primary} />
        <SvgText x="170" y="158" fill={colors.textSecondary} fontSize="11" textAnchor="middle">
          {safeText(payload?.x_label, "Input")}
        </SvgText>
        <SvgText x="8" y="78" fill={colors.textSecondary} fontSize="11" rotation="-90" origin="8,78" textAnchor="middle">
          {safeText(payload?.y_label, "Output")}
        </SvgText>
      </Svg>
      <Text style={styles.graphCaption}>{safeText(payload?.title, activeSegment?.conceptTitle || "Relationship")}</Text>
    </View>
  );

  const renderVisual = () => {
    const cue = activeVisual;
    const visualType = cue?.visual_type || "bullet_card";
    const payload = cue?.payload || {};

    if (cue?.image_url) {
      return (
        <View style={styles.generatedImageBoard}>
          <Image source={{ uri: cue.image_url }} style={styles.generatedImage} resizeMode="contain" />
        </View>
      );
    }

    if (visualType === "title_board" || cue?.render_mode === "title_board") return renderTitleBoard(payload);
    if (visualType.includes("table") || cue?.render_mode === "table") return renderTable(payload);
    if (visualType.includes("timeline")) return renderTimeline(payload);
    if (visualType.includes("graph")) return renderGraph(payload);
    if (visualType.includes("label") || visualType.includes("diagram") || visualType.includes("system")) return renderLabeledDiagram(payload);
    if (visualType.includes("concept") || visualType.includes("analogy") || visualType.includes("sketch")) return renderConceptMap(payload);
    if (visualType.includes("flow") || visualType.includes("chain") || visualType.includes("hierarchy") || cue?.render_mode === "mermaid") return renderFlow(payload);
    return renderBulletCard(payload);
  };

  if (loading) {
    return (
      <Screen hideHeader style={styles.screen}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Preparing whiteboard lesson...</Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen hideHeader style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Whiteboard Tutor</Text>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Lesson unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Try again" onPress={loadLesson} style={styles.retryButton} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen hideHeader style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Whiteboard Tutor</Text>
          <Text style={styles.headerMeta}>
            Segment {activeSegmentIndex + 1} of {segments.length}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setVoiceEnabled((value) => !value)} style={styles.iconButton}>
          {voiceEnabled ? <Volume2 size={22} color={colors.primary} /> : <VolumeX size={22} color={colors.textMuted} />}
        </TouchableOpacity>
      </View>

      <View style={styles.boardShell}>
        <View style={styles.boardHeader}>
          <View style={styles.boardHeaderIcon}>
            <BookOpen size={15} color={colors.background} />
          </View>
          <Text style={styles.boardHeaderText} numberOfLines={1}>
            {activeSegment?.conceptTitle}
          </Text>
        </View>
        <View style={styles.boardCanvas}>
          {renderVisual()}
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, activeSegmentIndex === 0 && styles.controlButtonDisabled]}
          disabled={activeSegmentIndex === 0}
          onPress={() => goToSegment(activeSegmentIndex - 1)}
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playButton} onPress={handleTogglePlay}>
          {isPlaying ? <Pause size={26} color={colors.background} /> : <Play size={26} color={colors.background} />}
          <Text style={styles.playButtonText}>{isPlaying ? "Pause" : "Play"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, activeSegmentIndex >= segments.length - 1 && styles.controlButtonDisabled]}
          disabled={activeSegmentIndex >= segments.length - 1}
          onPress={() => goToSegment(activeSegmentIndex + 1)}
        >
          <ChevronRight size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={handleRestart}>
          <RotateCcw size={21} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.segmentList} contentContainerStyle={styles.segmentListContent}>
        {segments.map((segment, index) => (
          <TouchableOpacity
            key={segment.id}
            activeOpacity={0.82}
            style={[styles.segmentCard, index === activeSegmentIndex && styles.segmentCardActive]}
            onPress={() => goToSegment(index)}
          >
            <Text style={styles.segmentNumber}>PART {index + 1}</Text>
            <Text style={styles.segmentTitle} numberOfLines={2}>{segment.conceptTitle}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Screen>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 20,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    headerCenter: {
      alignItems: "center",
      flex: 1,
      paddingHorizontal: 12,
    },
    headerTitle: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    headerMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 3,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    boardShell: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden",
      minHeight: 430,
    },
    boardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    boardHeaderIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    boardHeaderText: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      flex: 1,
      fontWeight: "700",
    },
    boardCanvas: {
      minHeight: 382,
      padding: 18,
      justifyContent: "center",
    },
    centerBoard: {
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      minHeight: 326,
    },
    boardEyebrow: {
      ...typography.mono,
      color: colors.primary,
    },
    boardTitle: {
      ...typography.h1,
      color: colors.textPrimary,
      textAlign: "center",
      lineHeight: 42,
    },
    boardTitleSmall: {
      ...typography.h3,
      color: colors.textPrimary,
      marginBottom: 10,
    },
    boardSubtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
    },
    bulletBoard: {
      gap: 12,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    bulletDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 8,
    },
    bulletText: {
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: 24,
      flex: 1,
    },
    tableBoard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: "hidden",
    },
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tableCell: {
      ...typography.caption,
      color: colors.textPrimary,
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 10,
      minHeight: 44,
    },
    tableHeader: {
      color: colors.primary,
      fontWeight: "800",
      backgroundColor: `${colors.primary}18`,
    },
    flowBoard: {
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 326,
    },
    flowNode: {
      width: "88%",
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    flowNodeText: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      textAlign: "center",
      fontWeight: "700",
    },
    flowArrow: {
      ...typography.bodySmall,
      color: colors.primary,
      fontWeight: "900",
    },
    timelineBoard: {
      justifyContent: "center",
      minHeight: 326,
    },
    graphBoard: {
      minHeight: 326,
      justifyContent: "center",
      gap: 12,
    },
    graphCaption: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      textAlign: "center",
    },
    generatedImageBoard: {
      minHeight: 326,
      alignItems: "center",
      justifyContent: "center",
    },
    generatedImage: {
      width: "100%",
      height: 326,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceElevated,
      overflow: "hidden",
      marginTop: 14,
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.primary,
    },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 14,
    },
    controlButton: {
      width: 50,
      height: 50,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    controlButtonDisabled: {
      opacity: 0.35,
    },
    playButton: {
      flex: 1,
      height: 54,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
    },
    playButtonText: {
      ...typography.body,
      color: colors.background,
      fontWeight: "900",
    },
    segmentList: {
      marginTop: 14,
      maxHeight: 116,
    },
    diagramBoard: {
      minHeight: 326,
      justifyContent: "center",
    },
    conceptMapBoard: {
      minHeight: 326,
      justifyContent: "center",
      alignItems: "center",
      gap: 20,
    },
    conceptCenter: {
      width: 138,
      minHeight: 76,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: 10,
    },
    conceptCenterText: {
      ...typography.caption,
      color: colors.background,
      textAlign: "center",
      fontWeight: "900",
    },
    conceptGrid: {
      width: "100%",
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 10,
    },
    conceptNode: {
      width: "45%",
      minHeight: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    conceptNodeText: {
      ...typography.caption,
      color: colors.textPrimary,
      textAlign: "center",
      fontWeight: "700",
    },
    segmentListContent: {
      gap: 8,
      paddingBottom: 8,
    },
    segmentCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    segmentCardActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}12`,
    },
    segmentNumber: {
      ...typography.mono,
      color: colors.textMuted,
      marginBottom: 4,
    },
    segmentTitle: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    },
    loadingText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
    errorCard: {
      marginTop: 40,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 18,
      gap: 12,
    },
    errorTitle: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    errorText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    retryButton: {
      marginTop: 4,
    },
  });
