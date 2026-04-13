import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ChevronLeft, Calendar, Clock, BookOpen, Share2 } from "lucide-react-native";

export const SessionDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { id } = route.params || {};

  return (
    <Screen hideHeader style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Details</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Share2 size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sessionType}>STUDY SESSION</Text>
          <Text style={styles.title}>Session #{id}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>Oct 24, 2023</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>45 mins</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COURSE</Text>
            <View style={styles.courseRow}>
              <BookOpen size={20} color={colors.primary} />
              <Text style={styles.courseCode}>EEE 301</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TOPIC</Text>
            <Text style={styles.topicText}>Introduction to Circuit Analysis</Text>
          </View>
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>AI INSIGHT</Text>
          <Text style={styles.insightBody}>
            You spent 15 minutes on Kirchhoff's Laws. You might want to review nodal analysis in your next session.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  iconBtn: { padding: 4 },
  content: { padding: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionType: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
    marginBottom: 8,
  },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: 12 },
  metaRow: { flexDirection: "row", gap: 16, marginBottom: 20 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 12, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    color: colors.textMuted,
    marginBottom: 8,
  },
  courseRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  courseCode: { ...typography.h3, color: colors.textPrimary },
  topicText: { ...typography.body, color: colors.textSecondary },
  insightCard: {
    marginTop: 20,
    backgroundColor: "rgba(34, 197, 94, 0.05)",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  insightTitle: {
    fontSize: 10,
    fontFamily: "SpaceMono-Regular",
    color: colors.primary,
    marginBottom: 4,
  },
  insightBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});
