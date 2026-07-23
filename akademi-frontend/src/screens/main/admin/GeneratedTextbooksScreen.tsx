import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Modal, ScrollView } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import {
  adminService,
  GeneratedTextbookOverviewItem,
  GeneratedTextbookDetail,
} from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import Toast from "react-native-toast-message";
import { BookOpen, X, RefreshCw } from "lucide-react-native";

const STATUS_COLORS: Record<string, string> = {
  GENERATED: "#22C55E",
  ADMIN_QUEUED: "#EF4444",
  FAILED_QUALITY_CHECK: "#F59E0B",
  GENERATING: "#38BDF8",
  PENDING: "#71717A",
};

const formatAgo = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

const summarizeStatus = (item: GeneratedTextbookOverviewItem) => {
  const generated = item.status_counts.GENERATED || 0;
  const adminQueued = item.status_counts.ADMIN_QUEUED || 0;
  const parts = [`${generated}/${item.total_leaf_nodes} generated`];
  if (adminQueued > 0) parts.push(`${adminQueued} admin-queued`);
  if (item.diagrams_needed > 0) parts.push(`${item.diagrams_fetched}/${item.diagrams_needed} diagrams fetched`);
  return parts.join(" · ");
};

export const GeneratedTextbooksScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const [loading, setLoading] = useState(true);
  const [outlines, setOutlines] = useState<GeneratedTextbookOverviewItem[]>([]);
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GeneratedTextbookDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const data = await adminService.getGeneratedTextbooksOverview();
      setOutlines(data);
    } catch (error) {
      console.error("Failed to fetch generated textbooks overview", error);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (outlineId: string) => {
    setSelectedOutlineId(outlineId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await adminService.getGeneratedTextbookDetail(outlineId);
      setDetail(data);
    } catch (error) {
      console.error("Failed to fetch generated textbook detail", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedOutlineId(null);
    setDetail(null);
  };

  const handleRegenerateTextbook = async () => {
    if (!selectedOutlineId) return;
    setRegenerating(true);
    try {
      await adminService.regenerateGeneratedTextbook(selectedOutlineId);
      Toast.show({
        type: "success",
        text1: "Regeneration Queued",
        text2: "The textbook outline has been queued for a full regeneration.",
      });
      setShowRegenerateConfirm(false);
      closeDetail();
      fetchOverview();
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Regeneration Failed",
        text2: error.response?.data?.message || error.message,
      });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Screen
      title="Generated Textbooks"
      scrollable
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchOverview} />}
    >
      <View style={styles.container}>
        {loading ? (
          [1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={100} borderRadius={12} style={{ marginBottom: 12 }} />
          ))
        ) : outlines.length === 0 ? (
          <View style={styles.emptyState}>
            <BookOpen size={40} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>
              No generated textbooks yet
            </Text>
          </View>
        ) : (
          outlines.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => openDetail(item.id)} activeOpacity={0.8}>
              <Card style={styles.outlineCard}>
                <View style={styles.outlineHeader}>
                  <Text style={[typography.body, { fontWeight: "700", color: colors.textPrimary }]}>
                    {item.course_code}
                  </Text>
                  <Badge
                    label={item.is_published ? (item.is_current ? "Published" : "Superseded") : "Generating"}
                    variant={item.is_published ? (item.is_current ? "success" : "warning") : "blue"}
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
                  {summarizeStatus(item)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>
                  CCMAS v{item.ccmas_version} · built {formatAgo(item.created_at)}
                </Text>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Modal
        visible={!!selectedOutlineId}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeDetail}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeDetail}>
              <X size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[typography.body, { fontWeight: "700", color: colors.textPrimary }]}>
              {detail?.course_code || "Outline detail"}
            </Text>
            {detail ? (
              <TouchableOpacity onPress={() => setShowRegenerateConfirm(true)} style={{ padding: 4 }}>
                <RefreshCw size={20} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 22 }} />
            )}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {detailLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} width="100%" height={56} borderRadius={10} style={{ marginBottom: 10 }} />
              ))
            ) : (
              (detail?.nodes || []).map((node) => {
                const color = STATUS_COLORS[node.status] || colors.textMuted;
                return (
                  <View
                    key={node.id}
                    style={[styles.nodeRow, { borderBottomColor: colors.border, paddingLeft: 12 + node.depth * 16 }]}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text
                        style={[
                          typography.body,
                          { color: colors.textPrimary, fontWeight: node.depth === 0 ? "700" : "500" },
                        ]}
                        numberOfLines={2}
                      >
                        {node.title}
                      </Text>
                      {node.section?.needs_diagram && (
                        <Text
                          style={[
                            typography.caption,
                            { color: node.section.diagram_image_url ? colors.primary : colors.textMuted, marginTop: 2 },
                          ]}
                        >
                          {node.section.diagram_image_url ? "Diagram fetched" : "Diagram pending"}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.statusPill, { borderColor: color }]}>
                      <Text style={[typography.caption, { color, fontWeight: "700" }]}>
                        {node.status.replace(/_/g, " ")}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      <ConfirmDialog
        visible={showRegenerateConfirm}
        title="Force Regenerate Textbook"
        message="Are you sure you want to regenerate this textbook? This will bypass all checks and immediately queue a new generation run, which incurs AI costs. Older versions will remain live for students until the new one finishes building."
        confirmLabel={regenerating ? "Queuing..." : "Regenerate"}
        confirmColor={colors.error}
        onConfirm={handleRegenerateTextbook}
        onCancel={() => setShowRegenerateConfirm(false)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  outlineCard: {
    padding: 16,
    marginBottom: 12,
  },
  outlineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  nodeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingRight: 12,
    borderBottomWidth: 1,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
