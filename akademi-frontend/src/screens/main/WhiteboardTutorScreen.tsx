import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowLeft, Play, Pause, RotateCcw, ChevronRight, Send } from "lucide-react-native";
import { sessionService } from "../../services/session";
import { WebView } from "react-native-webview";
import * as Speech from "expo-speech";

interface VisualCue {
  id: string;
  visual_type: string;
  render_mode: string;
  start_ms: number;
  end_ms: number;
  payload: any;
}

interface LessonSegment {
  id: string;
  concept_title: string;
  script: string;
  visual_cues: VisualCue[];
}

export const WhiteboardTutorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params;

  const [segments, setSegments] = useState<LessonSegment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activeCue, setActiveCue] = useState<VisualCue | null>(null);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadLesson();
    return () => {
      stopPlayback();
    };
  }, [sessionId]);

  const loadLesson = async () => {
    try {
      const data = await sessionService.getPlayableLesson(sessionId);
      setSegments(data);
    } catch (error) {
      console.error("Failed to load lesson:", error);
    } finally {
      setLoading(false);
    }
  };

  const startPlayback = () => {
    setIsPlaying(true);
    const segment = segments[currentSegmentIndex];
    if (segment) {
      Speech.speak(segment.script, {
        onDone: () => {
          if (currentSegmentIndex < segments.length - 1) {
            setCurrentSegmentIndex(prev => prev + 1);
            setElapsedTime(0);
          } else {
            setIsPlaying(false);
          }
        },
      });

      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 100);
      }, 100);
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    Speech.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    setIsSending(true);
    try {
      const newLesson = await sessionService.generateTeaching(sessionId, inputText);
      setSegments(newLesson);
      setCurrentSegmentIndex(0);
      setElapsedTime(0);
      setInputText("");
      stopPlayback();
    } catch (error) {
      console.error("Failed to send message:", error);
      Alert.alert("Error", "Failed to get a response from the tutor.");
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const segment = segments[currentSegmentIndex];
      const cue = segment?.visual_cues.find(c => elapsedTime >= c.start_ms && elapsedTime <= c.end_ms);
      setActiveCue(cue || activeCue);
    }
  }, [elapsedTime, isPlaying]);

  const renderWhiteboard = () => {
    if (!activeCue) return <View style={styles.emptyBoard}><Text style={styles.emptyText}>Listen to the teacher...</Text></View>;

    if (activeCue.render_mode === "mermaid") {
      const mermaidHtml = `
        <html>
          <head>
            <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
            <script>mermaid.initialize({startOnLoad:true, theme:'dark'});</script>
          </head>
          <body style="background-color: #16311D; display: flex; justify-content: center; align-items: center;">
            <div class="mermaid">
              ${activeCue.payload.mermaid}
            </div>
          </body>
        </html>
      `;
      return (
        <WebView
          originWhitelist={['*']}
          source={{ html: mermaidHtml }}
          style={styles.whiteboardWebView}
        />
      );
    }

    if (activeCue.visual_type === "title_board") {
        return (
            <View style={styles.titleBoard}>
                <Text style={styles.boardTitle}>{activeCue.payload.title}</Text>
            </View>
        );
    }

    return (
        <View style={styles.emptyBoard}>
            <Text style={styles.emptyText}>Visual: {activeCue.visual_type}</Text>
        </View>
    );
  };

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Whiteboard Tutor</Text>
        </View>

        <View style={styles.whiteboardContainer}>
          {renderWhiteboard()}
        </View>

        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>
            {segments[currentSegmentIndex]?.script}
          </Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={() => { setElapsedTime(0); stopPlayback(); setCurrentSegmentIndex(0); }}>
            <RotateCcw size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButton} onPress={isPlaying ? stopPlayback : startPlayback}>
            {isPlaying ? <Pause size={32} color={colors.background} /> : <Play size={32} color={colors.background} />}
          </TouchableOpacity>
          <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                  if (currentSegmentIndex < segments.length - 1) {
                      setCurrentSegmentIndex(prev => prev + 1);
                      setElapsedTime(0);
                      if (isPlaying) {
                          stopPlayback();
                          startPlayback();
                      }
                  }
              }}
          >
            <ChevronRight size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Send size={20} color={colors.background} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  whiteboardContainer: {
    flex: 2,
    backgroundColor: "#16311D",
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
  },
  whiteboardWebView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  emptyBoard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    ...typography.body,
    color: "rgba(255,255,255,0.5)",
  },
  titleBoard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  boardTitle: {
    ...typography.h2,
    color: "#9AE6B4",
    textAlign: "center",
  },
  captionContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  captionText: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 18,
    textAlign: "center",
    lineHeight: 28,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 20,
    gap: 32,
  },
  controlButton: {
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 50,
  },
  playButton: {
    width: 64,
    height: 64,
    backgroundColor: colors.primary,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    color: colors.textPrimary,
    ...typography.body,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
