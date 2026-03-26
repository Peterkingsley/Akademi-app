import React, { useState, useEffect } from "react";
import {
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
  Settings,
} from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuthStore } from "../../store/useAuthStore";
import { useNavigation } from "@react-navigation/native";
import { sessionService, Session, LearningProfile } from "../../services/session";

const DURATIONS = ["15 min", "30 min", "45 min", "Open-ended"];

export const LiveTutorEntryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("Select Course");
  const [selectedDuration, setSelectedDuration] = useState("30 min");
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);

  useEffect(() => {
    fetchEntryData();
  }, []);

  const fetchEntryData = async () => {
    try {
      setLoading(true);
      const [sessions, profile] = await Promise.all([
        sessionService.getRecentSessions(3),
        sessionService.getLearningProfile(),
      ]);
      setRecentSessions(sessions);
      setLearningProfile(profile);
    } catch (error) {
      console.error("Error fetching entry data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!topic || selectedCourse === "Select Course") return;
    try {
      const session = await sessionService.createSession({
        sessionType: "TUTOR",
        courseCode: selectedCourse,
        topic,
        duration: selectedDuration === "Open-ended" ? undefined : parseInt(selectedDuration),
      });
      navigation.navigate("LiveTutorSession", { sessionId: session.id });
    } catch (error) {
      console.error("Error starting session:", error);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Avatar name={user?.name || "Student"} size={32} />
        <Text style={[styles.brandText, typography.h3]}>Akademi</Text>
      </View>
      <TouchableOpacity>
        <Settings size={24} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

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
                <Text style={[styles.courseCodeText, typography.mono]}>{session.courseCode}</Text>
              </View>
              <View style={styles.recentMeta}>
                <Text style={[styles.recentTopic, typography.bodySmall]} numberOfLines={1}>{session.topic}</Text>
                <Text style={[styles.recentDate, typography.caption]}>{new Date(session.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
            <View style={styles.recentRight}>
              <Text style={[styles.recentDuration, typography.caption]}>{session.duration || "Open"} min</Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Screen scrollable style={{ flex: 1 }}>
      <View style={[styles.container, { flex: 1 }]}>
        {renderHeader()}

        <Text style={[styles.title, typography.h1]}>Live Tutor</Text>
        <Text style={[styles.subtitle, typography.body, { color: colors.textSecondary }]}>
          Start a tutoring session on any topic
        </Text>

        <View style={[styles.setupCard, { flex: 1 }]}>
          <View>
            <Text style={[styles.label, typography.bodySmall]}>What do you want to learn?</Text>

            <TouchableOpacity style={styles.courseSelector} onPress={() => {}}>
              <View style={styles.courseSelectorLeft}>
                <GraduationCap size={20} color={colors.primary} />
                <Text style={[styles.courseText, typography.body]}>{selectedCourse}</Text>
              </View>
              <ChevronDown size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TextInput
              style={[styles.topicInput, typography.body]}
              placeholder="e.g. Thevenin's theorem, Integration by parts..."
              placeholderTextColor={colors.textMuted}
              value={topic}
              onChangeText={setTopic}
              multiline
            />

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
            label="Start Session →"
            onPress={handleStartSession}
            style={styles.startBtn}
            disabled={!topic || selectedCourse === "Select Course"}
          />
        </View>

        {renderSuggestedTopics()}
        {renderRecentSessions()}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
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
  topicInput: {
    color: colors.textPrimary,
    paddingVertical: 12,
    marginBottom: 24,
    minHeight: 60,
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
