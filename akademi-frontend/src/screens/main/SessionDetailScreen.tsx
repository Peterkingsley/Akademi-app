import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  BookOpen, Monitor,
  Calendar,
  ChevronLeft,
  Clock,
  MessageCircle,
  RefreshCw,
  Share2,
} from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import api from "../../services/api";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

interface SessionMessage {
  id: string;
  role: "STUDENT" | "AI";
  content: string;
  created_at: string;
}

interface SessionDetail {
  id: string;
  session_type?: string;
  reply_mode?: string | null;
  course_code?: string | null;
  topic?: string | null;
  duration?: number | null;
  started_at?: string;
  ended_at?: string | null;
  created_at: string;
  messages?: SessionMessage[];
}

const formatDate = (value?: string) => {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatTime = (value?: string) => {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatType = (value?: string) =>
  (value || "study").replace(/_/g, " ").toLowerCase();

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const cleanMarkdown = (value?: string | null) => {
  if (!value) return "";

  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
};

export const SessionDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id } = route.params || {};

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    if (!id) {
      setError("Session id is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/sessions/${id}`);
      setSession(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load this session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [id]);

  const title = useMemo(() => {
    if (!session) return "Session Details";
    return session.topic || session.course_code || `${formatType(session.session_type)} session`;
  }, [session]);

  const messages = session?.messages || [];
  const studentMessages = messages.filter((message) => message.role === "STUDENT").length;
  const aiMessages = messages.filter((message) => message.role === "AI").length;
  const lastMessage = messages[messages.length - 1];
  const latestActivity = cleanMarkdown(lastMessage?.content);

  return (
    <Screen hideHeader style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Details</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Share2 size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading session...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Text style={styles.errorTitle}>Session unavailable</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity onPress={fetchSession} style={styles.retryButton}>
            <RefreshCw size={16} color={colors.background} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : session ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.sessionType}>{formatType(session.session_type)}</Text>
            <Text style={styles.title}>{title}</Text>

            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Calendar size={15} color={colors.textSecondary} />
                <Text style={styles.metaText}>{formatDate(session.started_at || session.created_at)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Clock size={15} color={colors.textSecondary} />
                <Text style={styles.metaText}>
                  {session.duration ? `${session.duration} min` : formatTime(session.started_at || session.created_at)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Course</Text>
              <View style={styles.courseRow}>
                <BookOpen size={20} color={colors.primary} />
                <Text style={styles.courseCode}>{session.course_code || "No course set"}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Message count</Text>
              <View style={styles.messageStats}>
                <View style={styles.statPill}>
                  <MessageCircle size={14} color={colors.primary} />
                  <Text style={styles.statText}>{pluralize(studentMessages, "student message")}</Text>
                </View>
                <View style={styles.statPill}>
                  <MessageCircle size={14} color={colors.primary} />
                  <Text style={styles.statText}>{pluralize(aiMessages, "Akademi reply", "Akademi replies")}</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.primary + "10", borderColor: colors.primary }]}
            onPress={() => navigation.navigate("WhiteboardTutor", { sessionId: id })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Monitor size={24} color={colors.primary} />
              <View>
                <Text style={[typography.h3, { color: colors.primary }]}>Replay in Teaching Mode</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Watch this session as a whiteboard lesson</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>Latest activity</Text>
            <Text style={styles.insightBody}>
              {latestActivity || "No messages have been saved for this session yet."}
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  iconButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  sessionType: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 27,
    marginBottom: 14,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginLeft: 7,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: 18,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 0,
    marginBottom: 8,
  },
  courseRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  courseCode: {
    ...typography.h3,
    color: colors.textPrimary,
    marginLeft: 8,
  },
  messageStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statPill: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 8,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginLeft: 6,
  },
  insightCard: {
    backgroundColor: "#101412",
    borderColor: "#1D3528",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  insightTitle: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 0,
    marginBottom: 8,
  },
  insightBody: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
  },
  stateContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  stateText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    textAlign: "center",
  },
  errorTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
    marginBottom: 6,
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: "row",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    ...typography.body,
    color: colors.background,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },
});
