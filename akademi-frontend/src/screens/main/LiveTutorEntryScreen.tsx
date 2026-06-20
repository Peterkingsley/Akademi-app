import React, { useMemo, useState, useEffect } from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import {
  GraduationCap,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Check,
  Settings,
} from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuthStore } from "../../store/useAuthStore";
import { useNavigation, useRoute } from "@react-navigation/native";
import { sessionService, Session, LearningProfile } from "../../services/session";
import { useTheme } from "../../theme/ThemeContext";
import { useVoiceComposer } from "../../hooks/useVoiceComposer";
import { appendTranscript } from "../../services/voice";
import { VoiceInputButton } from "../../components/ui/VoiceInputButton";

const DURATIONS = ["15 min", "30 min", "45 min", "Open-ended"];

const formatDuration = (duration?: number) => duration ? `${duration} min` : "Open-ended";

const getSessionTopic = (session: Session) => session.topic?.trim() || "Live tutor session";

export const LiveTutorEntryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params || {};
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [topic, setTopic] = useState(params.topic || "");
  const [selectedCourse, setSelectedCourse] = useState(params.courseCode || (user as any)?.courses?.[0] || "Select Course");
  const [selectedDuration, setSelectedDuration] = useState("30 min");
  const [isCoursePickerVisible, setIsCoursePickerVisible] = useState(false);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const { isRecording, isTranscribing, toggleRecording } = useVoiceComposer({
    onTranscript: (transcript) => setTopic((prev: string) => appendTranscript(prev, transcript, true)),
    recordingName: "live-tutor-topic.m4a",
    permissionMessage: "Allow microphone access so Akademi can capture your tutor topic.",
    stopErrorTitle: "Voice input failed",
  });
  const courseOptions = useMemo(() => {
    const userCourses = Array.from(
      new Set<string>(
        ((user as any)?.courses || []).filter(
          (course: unknown): course is string => typeof course === "string" && course.trim().length > 0,
        ),
      ),
    );
    return ["Select Course", ...userCourses];
  }, [user]);

  useEffect(() => {
    fetchEntryData();
  }, []);

  const fetchEntryData = async () => {
    try {
      setLoading(true);
      const [sessions, profile] = await Promise.all([
        sessionService.getRecentSessions(20),
        sessionService.getLearningProfile(),
      ]);
      setRecentSessions(sessions.filter((session) => session.session_type === "TUTOR").slice(0, 3));
      setLearningProfile(profile);
    } catch (error) {
      console.error("Error fetching entry data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async () => {
    const trimmedTopic = topic.trim();
    const courseCode = selectedCourse === "Select Course" ? null : selectedCourse;

    if (!trimmedTopic) {
      Alert.alert("Add a topic", "Type what you want the Live Tutor to teach you before starting.");
      return;
    }

    if (starting) return;

    setStarting(true);
    try {
      const session = await sessionService.createSession({
        session_type: "TUTOR",
        course_code: courseCode,
        topic: trimmedTopic,
        duration: selectedDuration === "Open-ended" ? undefined : parseInt(selectedDuration),
        metadata: params.materialId ? {
          materialId: params.materialId,
          materialTitle: params.materialTitle,
        } : undefined,
      });

      if (params.materialContext) {
        await sessionService.sendMessage(session.id, {
          content: `Start this live tutor session using the material context below. Teach the student, ask what they are struggling with, and be ready to answer follow-up questions.\n\n${params.materialContext}`,
          reply_mode: "STUDY",
        });
      }

      navigation.navigate("LiveTutorSession", { sessionId: session.id });
    } catch (error: any) {
      console.error("Error starting session:", error);
      Alert.alert(
        "Could not start session",
        error?.response?.data?.message || "Please check your connection and try again.",
      );
    } finally {
      setStarting(false);
    }
  };

  const renderSuggestedTopics = () => {
    if (loading) return <Skeleton height={100} width="100%" borderRadius={12} />;

    const weakAreas = learningProfile?.weakAreas || [];
    if (weakAreas.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Sparkles size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, typography.h3]}>Suggested for you</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
          {weakAreas.map((area, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionPill}
              onPress={() => {
                setTopic(area.topic);
                setSelectedCourse(area.subject);
              }}
            >
              <Text style={[styles.suggestionLabel, typography.mono]}>AI INSIGHT</Text>
              <Text style={[styles.suggestionText, typography.bodySmall]}>{area.topic}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderRecentSessions = () => {
    if (loading) return <Skeleton height={150} width="100%" borderRadius={12} />;
    if (recentSessions.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, typography.h3]}>Recent tutor sessions</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Sessions")}>
            <Text style={[styles.seeAll, typography.bodySmall]}>See all</Text>
          </TouchableOpacity>
        </View>
        {recentSessions.map((session) => (
          <TouchableOpacity
            key={session.id}
            style={styles.recentSessionCard}
            onPress={() => navigation.navigate("LiveTutorSession", { sessionId: session.id })}
          >
            <View style={styles.recentLeft}>
              <View style={[styles.courseCodePill, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.courseCodeText, typography.mono]}>{session.course_code || "General"}</Text>
              </View>
              <View style={styles.recentMeta}>
                <Text style={[styles.recentTopic, typography.bodySmall]} numberOfLines={1}>{getSessionTopic(session)}</Text>
                <Text style={[styles.recentDate, typography.caption]}>{new Date(session.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
            <View style={styles.recentRight}>
              <Text style={[styles.recentDuration, typography.caption]}>{formatDuration(session.duration)}</Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Screen hideHeader scrollable style={{ flex: 1 }}>
      <View style={[styles.container, { flex: 1 }]}>

        <Text style={[styles.title, typography.h1]}>Live Tutor</Text>
        <Text style={[styles.subtitle, typography.body, { color: colors.textSecondary }]}>
          {params.materialTitle ? `Continue with ${params.materialTitle}` : "Start a tutoring session on any topic"}
        </Text>

        {params.materialTitle && (
          <View style={styles.materialContextCard}>
            <Text style={[styles.materialContextLabel, typography.mono]}>MATERIAL CONTEXT</Text>
            <Text style={[styles.materialContextTitle, typography.bodySmall]} numberOfLines={2}>
              {params.materialTitle}
            </Text>
            <Text style={[styles.materialContextText, typography.caption]} numberOfLines={2}>
              The tutor will start with this material and your selected course.
            </Text>
          </View>
        )}

        <View style={[styles.setupCard, { flex: 1 }]}>
          <View>
            <Text style={[styles.label, typography.bodySmall]}>What do you want to learn?</Text>

            <TouchableOpacity
              style={styles.courseSelector}
              onPress={() => setIsCoursePickerVisible((visible) => !visible)}
              activeOpacity={0.82}
            >
              <View style={styles.courseSelectorLeft}>
                <GraduationCap size={20} color={colors.primary} />
                <Text style={[styles.courseText, typography.body]}>
                  {selectedCourse === "Select Course" ? "General topic" : selectedCourse}
                </Text>
              </View>
              <ChevronDown size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {isCoursePickerVisible && (
              <View style={styles.inlineCoursePicker}>
                <Text style={styles.inlinePickerLabel}>Choose course context</Text>
                <View style={styles.inlineCourseGrid}>
                  {courseOptions.map((item) => {
                    const selected = selectedCourse === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        activeOpacity={0.82}
                        style={[styles.inlineCourseChip, selected && styles.inlineCourseChipActive]}
                        onPress={() => {
                          setSelectedCourse(item);
                          setIsCoursePickerVisible(false);
                        }}
                      >
                        {selected && <Check size={13} color={colors.background} />}
                        <Text style={[styles.inlineCourseText, selected && styles.inlineCourseTextActive]}>
                          {item === "Select Course" ? "General topic" : item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.topicInputWrap}>
              <TextInput
                style={[styles.topicInput, typography.body]}
                placeholder="e.g. Thevenin's theorem, Integration by parts..."
                placeholderTextColor={colors.textMuted}
                value={topic}
                onChangeText={setTopic}
                multiline
              />
              <VoiceInputButton
                onPress={toggleRecording}
                isRecording={isRecording}
                isTranscribing={isTranscribing}
                style={styles.topicVoiceButton}
              />
            </View>

            <Text style={[styles.durationLabel, typography.mono]}>DURATION</Text>
            <View style={styles.durationRow}>
              {DURATIONS.map((dur) => (
                <TouchableOpacity
                  key={dur}
                  style={[
                    styles.durationPill,
                    selectedDuration === dur ? styles.durationPillActive : styles.durationPillInactive
                  ]}
                  onPress={() => setSelectedDuration(dur)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      typography.caption,
                      { color: selectedDuration === dur ? colors.background : colors.textSecondary }
                    ]}
                  >
                    {dur}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Button
            label="Start Session ->"
            onPress={handleStartSession}
            style={styles.startBtn}
            loading={starting}
            disabled={!topic.trim() || starting}
          />
        </View>

        {renderSuggestedTopics()}
        {renderRecentSessions()}
      </View>

    </Screen>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 10,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandText: {
    marginLeft: 12,
    color: colors.primary,
    fontWeight: "700",
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 24,
  },
  setupCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 32,
    justifyContent: "space-between",
  },
  materialContextCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + "44",
    padding: 14,
    marginBottom: 16,
  },
  materialContextLabel: {
    color: colors.primary,
    fontSize: 8,
    marginBottom: 6,
  },
  materialContextTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  materialContextText: {
    color: colors.textSecondary,
    lineHeight: 16,
  },
  label: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  courseSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  courseSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  courseText: {
    color: colors.textPrimary,
    marginLeft: 10,
  },
  inlineCoursePicker: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  inlinePickerLabel: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 0,
    marginBottom: 10,
  },
  inlineCourseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inlineCourseChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  inlineCourseChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  inlineCourseText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  inlineCourseTextActive: {
    color: colors.background,
    marginLeft: 5,
  },
  topicInputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  topicInput: {
    color: colors.textPrimary,
    paddingVertical: 12,
    marginBottom: 24,
    minHeight: 60,
    flex: 1,
  },
  topicVoiceButton: {
    marginBottom: 24,
  },
  durationLabel: {
    color: colors.textMuted,
    marginBottom: 12,
    letterSpacing: 1,
  },
  durationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  durationPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  durationPillActive: {
    backgroundColor: colors.textPrimary,
  },
  durationPillInactive: {
    backgroundColor: colors.surfaceElevated,
  },
  durationText: {
    fontWeight: "600",
  },
  startBtn: {
    width: "100%",
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    marginLeft: 8,
  },
  seeAll: {
    color: colors.primary,
    fontWeight: "600",
  },
  suggestionsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  suggestionPill: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 160,
  },
  suggestionLabel: {
    color: colors.textMuted,
    fontSize: 7.5,
    marginBottom: 4,
  },
  suggestionText: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  recentSessionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  courseCodePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  courseCodeText: {
    color: colors.primary,
    fontSize: 7.5,
    fontWeight: "700",
  },
  recentMeta: {
    flex: 1,
    marginRight: 8,
  },
  recentTopic: {
    color: colors.textPrimary,
    fontWeight: "600",
    marginBottom: 2,
  },
  recentDate: {
    color: colors.textMuted,
  },
  recentRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  recentDuration: {
    color: colors.textMuted,
    marginRight: 8,
  },
});

