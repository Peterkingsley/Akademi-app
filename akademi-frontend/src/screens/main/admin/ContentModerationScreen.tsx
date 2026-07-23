import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Modal, Linking, TextInput, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminQueuedSection } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { CheckCircle2, XCircle, Zap, Info, Inbox, Eye, AlertCircle } from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import * as Haptics from "expo-haptics";

const Tab = createMaterialTopTabNavigator();

const ModerationQueue = ({ status }: { status: string }) => {
  const { colors, typography } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "takedown" | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);
  const navigation = useNavigation<any>();
  const isPendingQueue = status === "pending";
  const isSelectionMode = isPendingQueue && selectedIds.length > 0;

  const selectedCountLabel = useMemo(() => {
    const count = selectedIds.length;
    return `${count} material${count === 1 ? "" : "s"} selected`;
  }, [selectedIds.length]);

  useEffect(() => {
    fetchItems();
  }, [status]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      let data;
      // Map display labels to API status
      const apiStatus = status === 'flagged' ? 'flagged' :
                        status === 'pending' ? 'pending' :
                        status === 'verified' ? 'verified' : 'archived';

      if (apiStatus === 'flagged') data = await adminService.getFlaggedMaterials();
      else if (apiStatus === 'pending') data = await adminService.getPendingMaterials();
      else if (apiStatus === 'verified') data = await adminService.getVerifiedMaterials();
      else data = await adminService.getArchivedMaterials();
      setItems(data);
      setSelectedIds((current) => current.filter((id) => data.some((item: any) => item.id === id)));
    } catch (error) {
      console.error("Failed to fetch queue", error);
    } finally {
      setLoading(false);
    }
  };

    const handleModerationAction = async (type: "approve" | "takedown" | "view", item?: any) => {
    const targetItem = item || selectedItem || previewItem;
    if (!targetItem) return;

    if (type === "view") {
      try {
        if (targetItem.is_akademi_generated) {
          setModalVisible(false); // Close preview modal if it's open
          
          // Generate/Fetch the PDF for the AI-generated textbook
          const { url } = await adminService.getGeneratedTextbookPdf(targetItem.id);
          if (url) {
            Linking.openURL(url);
          }
          return;
        }
        
        // Standard materials
        const { url } = await adminService.getMaterialDownloadUrl(targetItem.id);
        if (url) {
          Linking.openURL(url);
        }
      } catch (error) {
        console.error("Failed to get download URL", error);
        Alert.alert("Preview Failed", "Could not load the material preview.");
      }
      return;
    }
    setSelectedItem(targetItem);
    setActionType(type);
    setConfirmVisible(true);
  };

  const confirmAction = async () => {
    if (!selectedItem || !actionType) return;
    try {
      if (actionType === "approve") {
        await adminService.approveMaterial(selectedItem.id);
      } else {
        await adminService.takedownMaterial(selectedItem.id);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmVisible(false);
      setSelectedItem(null);
      setPreviewItem(null);
      fetchItems();
    } catch (error) {
      console.error("Action failed", error);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleRowPress = (item: any) => {
    if (isSelectionMode) {
      toggleItemSelection(item.id);
      return;
    }

    setPreviewItem(item);
    setModalVisible(true);
  };

  const handleRowLongPress = (item: any) => {
    if (!isPendingQueue) {
      setPreviewItem(item);
      setModalVisible(true);
      return;
    }

    toggleItemSelection(item.id);
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.length || bulkApproving) return;

    try {
      setBulkApproving(true);
      await adminService.approveMaterials(selectedIds);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedIds([]);
      fetchItems();
    } catch (error) {
      console.error("Bulk approval failed", error);
    } finally {
      setBulkApproving(false);
    }
  };

  const getMaterialReadiness = (item: any) => {
    const hasExtractedText = Boolean(item.content && item.content.trim().length > 0);
    const questionCount = Array.isArray(item.questions) ? item.questions.length : Number(item.question_count || 0);

    return {
      extractionLabel: hasExtractedText ? "Text extracted" : "Extraction pending",
      extractionColor: hasExtractedText ? colors.primary : colors.warning,
      cbtLabel: questionCount > 0 ? `${questionCount} CBT questions ready` : "CBT questions pending",
      cbtColor: questionCount > 0 ? colors.primary : colors.warning,
    };
  };

  if (loading) return <View style={{ padding: 16 }}>{[1,2,3].map(i => <Skeleton key={i} width="100%" height={100} borderRadius={12} style={{ marginBottom: 12 }} />)}</View>;

  if (items.length === 0) return (
    <View style={styles.emptyState}>
      <Inbox size={48} color={colors.textMuted} />
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>Queue is empty</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isPendingQueue && (
        <View style={[styles.bulkBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {isSelectionMode ? (
            <>
              <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "700", flex: 1 }]}>
                {selectedCountLabel}
              </Text>
              <TouchableOpacity
                style={[styles.bulkSecondaryButton, { borderColor: colors.border }]}
                onPress={clearSelection}
              >
                <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "700" }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkPrimaryButton, { backgroundColor: colors.primary, opacity: bulkApproving ? 0.7 : 1 }]}
                onPress={handleBulkApprove}
                disabled={bulkApproving}
              >
                <Text style={[typography.caption, { color: "#FFFFFF", fontWeight: "700" }]}>
                  {bulkApproving ? "Approving..." : "Approve Selected"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Press and hold a file to start selecting multiple materials.
            </Text>
          )}
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.itemRow,
              { borderBottomColor: colors.border },
              selectedIds.includes(item.id) && { backgroundColor: colors.surface },
            ]}
            onPress={() => handleRowPress(item)}
            onLongPress={() => handleRowLongPress(item)}
            delayLongPress={200}
          >
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={[typography.body, { fontWeight: '600', color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.university} - {item.course_code || "General"}</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{item.faculty} - {item.department} - {item.level}L</Text>
              {status === 'pending' && (
                <View style={{ marginTop: 8, gap: 6 }}>
                  <View style={styles.readinessRow}>
                    <View style={[styles.readinessPill, { borderColor: getMaterialReadiness(item).extractionColor }]}>
                      <Text style={[styles.readinessText, { color: getMaterialReadiness(item).extractionColor }]}>{getMaterialReadiness(item).extractionLabel}</Text>
                    </View>
                    <View style={[styles.readinessPill, { borderColor: getMaterialReadiness(item).cbtColor }]}>
                      <Text style={[styles.readinessText, { color: getMaterialReadiness(item).cbtColor }]}>{getMaterialReadiness(item).cbtLabel}</Text>
                    </View>
                  </View>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Review the upload before publishing. Pending files are visible only to the uploader.</Text>
                </View>
              )}
            </View>

            <View style={styles.actionGroup}>
              {selectedIds.includes(item.id) && (
                <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                  <CheckCircle2 size={14} color="#FFFFFF" />
                </View>
              )}
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.surfaceElevated }]}
                onPress={() => handleModerationAction("view", item)}
                disabled={isSelectionMode}
              >
                <Eye size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}
                onPress={() => handleModerationAction("approve", item)}
                disabled={isSelectionMode}
              >
                <CheckCircle2 size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                onPress={() => handleModerationAction("takedown", item)}
                disabled={isSelectionMode}
              >
                <XCircle size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      {previewItem && (
        <ComparisonModal
          visible={modalVisible}
          item={previewItem}
          onClose={() => {
            setModalVisible(false);
            setPreviewItem(null);
          }}
          onAction={(type: any) => {
            setModalVisible(false);
            handleModerationAction(type);
          }}
        />
      )}

      <ConfirmDialog
        visible={confirmVisible}
        title={actionType === "approve" ? "Approve Material" : "Takedown Material"}
        message={actionType === "approve"
          ? "Are you sure you want to approve this material for the verified library?"
          : "Are you sure you want to take down this material? This action is high priority."}
        type={actionType === "approve" ? "info" : "danger"}
        confirmText={actionType === "approve" ? "Approve" : "Takedown"}
        onConfirm={confirmAction}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
};

const TextbookSectionsQueue = () => {
  const { colors, typography } = useTheme();
  const [items, setItems] = useState<AdminQueuedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<AdminQueuedSection | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [takingDown, setTakingDown] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getAdminQueuedSections();
      setItems(data);
    } catch (err: any) {
      console.error("Failed to fetch admin-queued sections", err);
      setError(err.message || "Failed to fetch queued sections");
    } finally {
      setLoading(false);
    }
  };

  const openPreview = (item: AdminQueuedSection) => {
    setPreviewItem(item);
    setEditingContent(item.content);
    setIsEditing(false);
    setModalVisible(true);
  };

  const closePreview = () => {
    setModalVisible(false);
    setPreviewItem(null);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!previewItem || !editingContent.trim()) return;
    try {
      setSaving(true);
      await adminService.updateGeneratedTextbookSection(previewItem.section_id, editingContent);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closePreview();
      fetchItems();
    } catch (error) {
      console.error("Failed to save section edit", error);
    } finally {
      setSaving(false);
    }
  };

  const handleTakeDown = async () => {
    if (!previewItem?.material_id) return;
    try {
      setTakingDown(true);
      await adminService.takeDownGeneratedTextbook(previewItem.material_id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmVisible(false);
      closePreview();
      fetchItems();
    } catch (error) {
      console.error("Failed to take down textbook", error);
    } finally {
      setTakingDown(false);
    }
  };

  if (loading) return <View style={{ padding: 16 }}>{[1, 2, 3].map(i => <Skeleton key={i} width="100%" height={100} borderRadius={12} style={{ marginBottom: 12 }} />)}</View>;

  if (error) return (
    <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
      <AlertCircle size={48} color={colors.error} />
      <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600', marginTop: 16, textAlign: 'center' }]}>Failed to load queue</Text>
      <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>{error}</Text>
      <TouchableOpacity 
        style={{ marginTop: 24, backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
        onPress={fetchItems}
      >
        <Text style={[typography.body, { color: colors.error, fontWeight: '500' }]}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  if (items.length === 0) return (
    <View style={styles.emptyState}>
      <Inbox size={48} color={colors.textMuted} />
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>No sections need review</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.section_id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemRow, { borderBottomColor: colors.border }]}
            onPress={() => openPreview(item)}
          >
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={[typography.body, { fontWeight: '600', color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.course_code}</Text>
              {!!item.quality_check_notes && (
                <Text style={[typography.caption, { color: colors.error, marginTop: 4 }]} numberOfLines={2}>
                  {item.quality_check_notes}
                </Text>
              )}
            </View>
            <Eye size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      />

      {previewItem && (
        <Modal visible={modalVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closePreview}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={closePreview}>
                <Text style={[typography.body, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
              <Text style={[typography.body, { fontWeight: '700', color: colors.textPrimary }]} numberOfLines={1}>
                {previewItem.course_code}
              </Text>
              <View style={{ width: 50 }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              <Text style={[typography.h4, { color: colors.textPrimary }]}>{previewItem.title}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
                Learning outcome: {previewItem.learning_outcome}
              </Text>

              {!!previewItem.quality_check_notes && (
                <Card style={styles.reviewNotesCard}>
                  <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>WHY THIS WAS FLAGGED</Text>
                  <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
                    {previewItem.quality_check_notes}
                  </Text>
                </Card>
              )}

              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 20, marginBottom: 8 }]}>
                CONTENT{isEditing ? " (editing)" : ""}
              </Text>
              {isEditing ? (
                <TextInput
                  value={editingContent}
                  onChangeText={setEditingContent}
                  multiline
                  textAlignVertical="top"
                  style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                />
              ) : (
                <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 22 }]}>
                  {previewItem.content}
                </Text>
              )}
            </ScrollView>

            <View style={[styles.decisionBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
              {isEditing ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  <Text style={{ color: "#FFF", fontWeight: '700' }}>{saving ? "Saving..." : "Save fix"}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => setIsEditing(true)}>
                  <Text style={{ color: "#FFF", fontWeight: '700' }}>Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.error, borderWidth: 1 }]}
                onPress={() => setConfirmVisible(true)}
              >
                <Text style={{ color: colors.error, fontWeight: '700' }}>Take down book</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <ConfirmDialog
        visible={confirmVisible}
        title="Take down book"
        message="This takes the entire generated textbook down for all students, not just this section. Are you sure?"
        type="danger"
        confirmText={takingDown ? "Taking down..." : "Take down"}
        onConfirm={handleTakeDown}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
};

const ComparisonModal = ({ visible, item, onClose, onAction }: any) => {
  const { colors, typography } = useTheme();
  const hasExtractedText = Boolean(item.content && item.content.trim().length > 0);
  const questionCount = Array.isArray(item.questions) ? item.questions.length : Number(item.question_count || 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[typography.body, { color: colors.primary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[typography.body, { fontWeight: '700', color: colors.textPrimary }]}>Moderation Deck</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={{ flex: 1 }}>
          <View style={styles.splitSection}>
            <View style={[styles.sectionLabel, { backgroundColor: colors.surface }]}>
              <Zap size={14} color={colors.primary} fill={colors.primary} />
              <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700', marginLeft: 6 }]}>AI RECONCILED VERSION</Text>
            </View>
            <Card style={styles.contentCard}>
              <Text style={[typography.h4, { color: colors.textPrimary, marginBottom: 12 }]}>{item.title}</Text>
              <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 22 }]}>
                {hasExtractedText ? item.content.slice(0, 1200) : "No extracted text is available yet. Admins can still inspect the uploaded file before approving or rejecting."}
              </Text>
              <View style={[styles.aiReason, { backgroundColor: colors.surface }]}>
                <Info size={16} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 8, flex: 1 }]}>
                  {questionCount > 0
                    ? `${questionCount} CBT questions are already attached to this material.`
                    : "CBT questions will be generated after approval when enough text is available."}
                </Text>
              </View>
            </Card>
          </View>

          <View style={styles.splitSection}>
            <View style={[styles.sectionLabel, { backgroundColor: colors.surface }]}>
              <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700' }]}>ORIGINAL CLIPS</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clipsScroll}>
              {[1, 2, 3].map(i => (
                <View key={i} style={[styles.clipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Image source={{ uri: `https://picsum.photos/seed/${item.id + i}/200/200` }} style={styles.clipImage} />
                  <View style={styles.clipFooter}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Chunk #{i} (Page {i})</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={[styles.decisionBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.error }]} onPress={() => onAction("takedown")}>
             <XCircle size={20} color={colors.error} />
             <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginTop: 4 }]}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => onAction("view")}>
             <Eye size={20} color={colors.textPrimary} />
             <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700', marginTop: 4 }]}>View Content</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => onAction("approve")}>
             <CheckCircle2 size={20} color="#FFF" />
             <Text style={[typography.caption, { color: "#FFF", fontWeight: '700', marginTop: 4 }]}>Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const ContentModerationScreen: React.FC = () => {
  const { colors } = useTheme();

  return (
    <Screen title="Content Queue">
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: { backgroundColor: colors.background },
          tabBarIndicatorStyle: { backgroundColor: colors.primary },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
          tabBarScrollEnabled: true,
        }}
      >
        <Tab.Screen name="Flagged Queue" children={() => <ModerationQueue status="flagged" />} />
        <Tab.Screen name="Pending Materials" children={() => <ModerationQueue status="pending" />} />
        <Tab.Screen name="Verified Library" children={() => <ModerationQueue status="verified" />} />
        <Tab.Screen name="Reports" children={() => <ModerationQueue status="reports" />} />
        <Tab.Screen name="Textbook Sections" children={() => <TextbookSectionsQueue />} />
      </Tab.Navigator>
    </Screen>
  );
};

const styles = StyleSheet.create({
  itemRow: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  bulkBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulkPrimaryButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  bulkSecondaryButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  splitSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentCard: {
    margin: 16,
    padding: 20,
  },
  aiReason: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  clipsScroll: {
    paddingLeft: 16,
    marginTop: 12,
  },
  clipCard: {
    width: 150,
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
    overflow: 'hidden',
  },
  clipImage: {
    flex: 1,
  },
  clipFooter: {
    padding: 8,
  },
  decisionBar: {
    padding: 16,
    paddingBottom: 32,
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readinessRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  readinessPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readinessText: {
    fontSize: 8,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  reviewNotesCard: {
    marginTop: 16,
    padding: 14,
  },
  editInput: {
    minHeight: 280,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});

