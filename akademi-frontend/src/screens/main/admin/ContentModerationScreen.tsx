import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView, Dimensions } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { AlertCircle, CheckCircle2, XCircle, Info, ChevronRight, Inbox, Clock, Zap } from "lucide-react-native";
import { Toast } from "../../../components/ui/Toast";

const { width } = Dimensions.get("window");

export const ContentModerationScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const data = await adminService.getFlaggedMaterials();
      setMaterials(data || []);
    } catch (error) {
      console.error("Failed to fetch flagged materials", error);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await adminService.approveMaterial(id);
      setToast({ message: "Content approved and published", type: "success" });
      nextItem();
    } catch (error) {
      setToast({ message: "Failed to approve content", type: "error" });
    }
  };

  const handleTakedown = async (id: string) => {
    try {
      await adminService.takedownMaterial(id);
      setToast({ message: "Content removed from platform", type: "success" });
      nextItem();
    } catch (error) {
      setToast({ message: "Failed to remove content", type: "error" });
    }
  };

  const nextItem = () => {
    if (currentIndex < materials.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setMaterials([]);
    }
  };

  const currentItem = materials[currentIndex];

  if (loading) {
    return (
      <Screen title="Content Moderation">
        <View style={styles.paddingContainer}>
           <Skeleton width="100%" height={250} borderRadius={16} />
           <Skeleton width="60%" height={24} style={{ marginTop: 24 }} />
           <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Skeleton width={100} height={100} borderRadius={8} style={{ marginRight: 12 }} />
              <Skeleton width={100} height={100} borderRadius={8} style={{ marginRight: 12 }} />
              <Skeleton width={100} height={100} borderRadius={8} />
           </View>
        </View>
      </Screen>
    );
  }

  if (!currentItem) {
    return (
      <Screen title="Content Moderation">
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
            <Inbox size={64} color={colors.textMuted} strokeWidth={1} />
          </View>
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 24 }]}>All caught up!</Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 12, paddingHorizontal: 48 }]}>
            The moderation queue is empty. No new flagged materials require your attention.
          </Text>
          <Button
            title="Refresh Queue"
            variant="outline"
            onPress={fetchMaterials}
            style={{ marginTop: 32, width: 200 }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Moderation Deck">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
           <View style={styles.queueInfo}>
              <Clock size={16} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 6 }]}>
                {materials.length} ITEMS REMAINING
              </Text>
           </View>
           <Text style={[typography.h4, { color: colors.textPrimary, marginTop: 4 }]}>Item #{currentIndex + 1}: {currentItem.title}</Text>
        </View>

        {/* AI Proposed Version Card */}
        <Card style={StyleSheet.flatten([styles.mainCard, { borderColor: colors.primary + "40" }])}>
          <View style={styles.cardBadge}>
            <Zap size={14} color="#FFF" fill="#FFF" />
            <Text style={styles.badgeText}>AI RECONCILED VERSION</Text>
          </View>
          <Text style={[typography.h4, { color: colors.textPrimary, marginBottom: 8 }]}>{currentItem.title}</Text>
          <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 22 }]}>
            {currentItem.description || "No description provided for this material."}
          </Text>

          <View style={[styles.aiReason, { backgroundColor: colors.surfaceElevated }]}>
            <Info size={16} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 8, flex: 1 }]}>
              AI detected multiple low-confidence fragments. Reconciled based on course curriculum context.
            </Text>
          </View>
        </Card>

        {/* Original Clips Section */}
        <View style={styles.section}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: 16 }]}>ORIGINAL SOURCE CLIPS</Text>
          <FlatList
            horizontal
            data={currentItem.clips || [1, 2, 3]} // Placeholder clips
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ index }) => (
              <View style={[styles.clipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.clipPlaceholder}>
                   <Image
                     source={{ uri: `https://picsum.photos/seed/${index + (currentItem.id || 0)}/200/200` }}
                     style={StyleSheet.absoluteFill}
                   />
                   <View style={styles.clipOverlay}>
                      <Text style={styles.clipIndex}>CLIP #{index + 1}</Text>
                   </View>
                </View>
                <View style={styles.clipFooter}>
                   <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                     Original scan chunk from page {index + 1}...
                   </Text>
                </View>
              </View>
            )}
            contentContainerStyle={styles.clipsList}
          />
        </View>

        <View style={styles.detailsSection}>
           <Text style={[typography.label, { color: colors.textMuted, marginBottom: 12 }]}>METADATA</Text>
           <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>University</Text>
              <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>{currentItem.university}</Text>
           </View>
           <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Course Code</Text>
              <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>{currentItem.course_code}</Text>
           </View>
           <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Contributor</Text>
              <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>{currentItem.user?.name || "System"}</Text>
           </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Decision Bar */}
      <View style={[styles.decisionBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.decisionButton, styles.takedownButton, { borderColor: colors.error }]}
          onPress={() => handleTakedown(currentItem.id)}
        >
          <XCircle size={20} color={colors.error} />
          <Text style={[styles.buttonText, { color: colors.error }]}>Take Down</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.decisionButton, styles.approveButton, { backgroundColor: colors.success }]}
          onPress={() => handleApprove(currentItem.id)}
        >
          <CheckCircle2 size={20} color="#FFF" />
          <Text style={[styles.buttonText, { color: "#FFF" }]}>Approve & Publish</Text>
        </TouchableOpacity>
      </View>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onHide={() => setToast(null)}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
  },
  paddingContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  queueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  mainCard: {
    padding: 20,
    borderWidth: 2,
    borderRadius: 16,
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  cardBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: "#22C55E",
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 4,
  },
  aiReason: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  clipsList: {
    paddingRight: 16,
  },
  clipCard: {
    width: 140,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
    overflow: 'hidden',
  },
  clipPlaceholder: {
    height: 120,
    backgroundColor: '#252F42',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 4,
  },
  clipIndex: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  clipFooter: {
    padding: 8,
  },
  detailsSection: {
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  decisionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    gap: 12,
  },
  decisionButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  takedownButton: {
    borderWidth: 2,
  },
  approveButton: {
    elevation: 4,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
