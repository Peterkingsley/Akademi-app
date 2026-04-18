import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, DisciplineDocument } from "../../../services/adminService";
import { Clock, RotateCcw, FileText, ChevronLeft, Calendar } from "lucide-react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Button } from "../../../components/ui/Button";

export const DocumentDetailScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const [doc, setDoc] = useState<DisciplineDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    fetchDoc();
  }, [route.params.id]);

  const fetchDoc = async () => {
    try {
      setLoading(true);
      const data = await adminService.getDisciplineDocument(route.params.id);
      setDoc(data);
    } catch (error) {
      console.error("Failed to fetch doc", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = (id: string, version: number) => {
    Alert.alert(
      "Confirm Rollback",
      `Are you sure you want to rollback to version ${version}.0?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rollback",
          onPress: async () => {
            try {
              setRollingBack(true);
              await adminService.rollbackDisciplineDocument(id, version);
              fetchDoc();
            } catch (error) {
              Alert.alert("Error", "Failed to rollback document");
            } finally {
              setRollingBack(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <Screen title="Loading Document...">
        <View style={{ padding: 20 }}>
          <Skeleton width="100%" height={200} borderRadius={16} />
          <Skeleton width="60%" height={24} style={{ marginTop: 24 }} />
          <Skeleton width="100%" height={400} style={{ marginTop: 24 }} borderRadius={16} />
        </View>
      </Screen>
    );
  }

  if (!doc) return <Screen title="Error"><Text>Document not found</Text></Screen>;

  return (
    <Screen title={doc.department} scrollable>
      <View style={styles.container}>
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Badge label={`v${doc.version}.0 Active`} variant="success" />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Last updated: {new Date(doc.updated_at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={[typography.h4, { color: colors.textPrimary, marginTop: spacing.md }]}>
            {doc.faculty}
          </Text>
          {doc.course_code && (
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Course: {doc.course_code}
            </Text>
          )}
          <View style={[styles.notesBox, { backgroundColor: colors.surface }]}>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>VERSION NOTES</Text>
            <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>
              {doc.version_notes || "No notes provided for this version."}
            </Text>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.md }]}>DOCUMENT CONTENT</Text>
          <Card style={styles.contentCard}>
            <FileText size={48} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={[typography.body, { color: colors.textPrimary, textAlign: 'center' }]}>
              AI Knowledge Source Reference:
            </Text>
            <Text style={[typography.mono, { color: colors.primary, textAlign: 'center', marginTop: 8 }]}>
              {doc.document_ref}
            </Text>
            <Button
              title="View Raw Source"
              variant="outline"
              style={{ marginTop: 24 }}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.md }]}>VERSION HISTORY</Text>
          <View style={styles.timeline}>
            {doc.history?.map((entry, index) => (
              <View key={entry.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: entry.is_active ? colors.success : colors.border }]} />
                  {index < (doc.history?.length || 0) - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  )}
                </View>
                <View style={styles.timelineRight}>
                  <View style={styles.timelineHeader}>
                    <Text style={[typography.body, { fontWeight: '700', color: colors.textPrimary }]}>
                      Version {entry.version}.0
                    </Text>
                    {entry.is_active ? (
                      <Badge label="Active" variant="success" size="small" />
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleRollback(doc.id, entry.version)}
                        style={styles.rollbackBtn}
                        disabled={rollingBack}
                      >
                        <RotateCcw size={14} color={colors.primary} />
                        <Text style={[typography.caption, { color: colors.primary, fontWeight: '600', marginLeft: 4 }]}>
                          Rollback
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>
                    {new Date(entry.updated_at).toLocaleDateString()}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={2}>
                    {entry.version_notes}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  headerCard: {
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notesBox: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
  },
  section: {
    marginTop: 32,
  },
  contentCard: {
    padding: 32,
    alignItems: 'center',
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: "row",
    minHeight: 80,
  },
  timelineLeft: {
    alignItems: "center",
    width: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
  },
  timelineRight: {
    flex: 1,
    paddingLeft: 16,
    paddingBottom: 24,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  rollbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(91, 110, 245, 0.1)',
  }
});
