import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Modal, Linking, TextInput, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminQueuedSection } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { CheckCircle2, XCircle, Zap, Info, Inbox, Eye, AlertCircle, ShieldAlert, FileText, CheckSquare, Square, RefreshCw, Sparkles, Layers, BookOpen } from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

const Tab = createMaterialTopTabNavigator();

const ModerationQueue = ({ status }: { status: string }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      const apiStatus =
        status === "flagged"
          ? "flagged"
          : status === "pending"
          ? "pending"
          : status === "verified"
          ? "verified"
          : "archived";

      if (apiStatus === "flagged") data = await adminService.getFlaggedMaterials();
      else if (apiStatus === "pending") data = await adminService.getPendingMaterials();
      else if (apiStatus === "verified") data = await adminService.getVerifiedMaterials();
      else data = await adminService.getArchivedMaterials();

      setItems(data || []);
      setSelectedIds((current) => current.filter((id) => data?.some((item: any) => item.id === id)));
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
          setModalVisible(false);
          const { url } = await adminService.getGeneratedTextbookPdf(targetItem.id);
          if (url) Linking.openURL(url);
          return;
        }

        const { url } = await adminService.getMaterialDownloadUrl(targetItem.id);
        if (url) Linking.openURL(url);
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
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
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

  if (loading)
    return (
      <View style={{ padding: 16, gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={90} borderRadius={14} />
        ))}
      </View>
    );

  if (items.length === 0)
    return (
      <View style={styles.emptyState}>
        <Inbox size={44} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Queue is clear</Text>
        <Text style={styles.emptySub}>No materials pending review for this category</Text>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isPendingQueue && (
        <View style={styles.bulkBar}>
          {isSelectionMode ? (
            <>
              <Text style={styles.bulkCountText}>{selectedCountLabel}</Text>
              <TouchableOpacity style={styles.bulkSecondaryBtn} onPress={clearSelection}>
                <Text style={styles.bulkSecondaryText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkPrimaryBtn, { opacity: bulkApproving ? 0.7 : 1 }]}
                onPress={handleBulkApprove}
                disabled={bulkApproving}
              >
                <Text style={styles.bulkPrimaryText}>{bulkApproving ? "Approving..." : "Approve Selected"}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.bulkTipText}>Press and hold a material card to select multiple files.</Text>
          )}
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id);
          const readiness = getMaterialReadiness(item);

          return (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.itemCard, isSelected && styles.itemCardSelected]}
              onPress={() => handleRowPress(item)}
              onLongPress={() => handleRowLongPress(item)}
              delayLongPress={200}
            >
              <View style={styles.itemMain}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.course_code && (
                    <View style={styles.courseBadge}>
                      <Text style={styles.courseBadgeText}>{item.course_code}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.itemMeta} numberOfLines={1}>
                  {item.university || "Akademi Library"} • {item.department || "General"} • {item.level ? `${item.level}L` : "N/A"}
                </Text>

                {status === "pending" && (
                  <View style={styles.readinessRow}>
                    <View style={[styles.readinessPill, { borderColor: readiness.extractionColor }]}>
                      <Text style={[styles.readinessText, { color: readiness.extractionColor }]}>
                        {readiness.extractionLabel}
                      </Text>
                    </View>
                    <View style={[styles.readinessPill, { borderColor: readiness.cbtColor }]}>
                      <Text style={[styles.readinessText, { color: readiness.cbtColor }]}>{readiness.cbtLabel}</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.actionGroup}>
                {isSelected ? (
                  <View style={styles.selectedCheck}>
                    <CheckCircle2 size={16} color="#FFF" />
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => handleModerationAction("view", item)}
                      disabled={isSelectionMode}
                      activeOpacity={0.7}
                    >
                      <Eye size={16} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, styles.approveIconBtn]}
                      onPress={() => handleModerationAction("approve", item)}
                      disabled={isSelectionMode}
                      activeOpacity={0.7}
                    >
                      <CheckCircle2 size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, styles.takedownIconBtn]}
                      onPress={() => handleModerationAction("takedown", item)}
                      disabled={isSelectionMode}
                      activeOpacity={0.7}
                    >
                      <XCircle size={16} color={colors.error} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
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
        message={
          actionType === "approve"
            ? "Are you sure you want to approve this material for the verified library?"
            : "Are you sure you want to take down this material? This action is high priority."
        }
        type={actionType === "approve" ? "info" : "danger"}
        confirmText={actionType === "approve" ? "Approve" : "Takedown"}
        onConfirm={confirmAction}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
};

const TextbookSectionsQueue = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      setItems(data || []);
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

  if (loading)
    return (
      <View style={{ padding: 16, gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={90} borderRadius={14} />
        ))}
      </View>
    );

  if (error)
    return (
      <View style={styles.emptyState}>
        <AlertCircle size={44} color={colors.error} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Failed to load queue</Text>
        <Text style={styles.emptySub}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchItems}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );

  if (items.length === 0)
    return (
      <View style={styles.emptyState}>
        <Inbox size={44} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No sections need review</Text>
        <Text style={styles.emptySub}>All AI generated textbook modules pass quality control</Text>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.section_id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.88} style={styles.itemCard} onPress={() => openPreview(item)}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.itemMeta}>{item.course_code}</Text>
              {!!item.quality_check_notes && (
                <Text style={styles.flagNote} numberOfLines={2}>
                  {item.quality_check_notes}
                </Text>
              )}
            </View>
            <View style={styles.iconBtn}>
              <Eye size={16} color={colors.textPrimary} />
            </View>
          </TouchableOpacity>
        )}
      />

      {previewItem && (
        <Modal visible={modalVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closePreview}>
          <View style={styles.deckContainer}>
            <View style={styles.deckHeader}>
              <TouchableOpacity onPress={closePreview}>
                <Text style={styles.deckCancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.deckTitle} numberOfLines={1}>
                {previewItem.course_code}
              </Text>
              <View style={{ width: 44 }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.deckSectionTitle}>{previewItem.title}</Text>
              <Text style={styles.deckOutcomeText}>Learning outcome: {previewItem.learning_outcome}</Text>

              {!!previewItem.quality_check_notes && (
                <View style={styles.flagNotesBox}>
                  <Text style={styles.flagNotesTitle}>WHY THIS WAS FLAGGED</Text>
                  <Text style={styles.flagNotesText}>{previewItem.quality_check_notes}</Text>
                </View>
              )}

              <Text style={styles.deckContentLabel}>MODULE CONTENT{isEditing ? " (EDITING MODE)" : ""}</Text>
              {isEditing ? (
                <TextInput
                  value={editingContent}
                  onChangeText={setEditingContent}
                  multiline
                  textAlignVertical="top"
                  style={styles.deckTextarea}
                />
              ) : (
                <Text style={styles.deckBodyText}>{previewItem.content}</Text>
              )}
            </ScrollView>

            <View style={styles.deckFooter}>
              {isEditing ? (
                <TouchableOpacity
                  style={[styles.deckPrimaryBtn, { opacity: saving ? 0.7 : 1 }]}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  <Text style={styles.deckPrimaryText}>{saving ? "Saving..." : "Save Edit"}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.deckPrimaryBtn} onPress={() => setIsEditing(true)}>
                  <Text style={styles.deckPrimaryText}>Edit Content</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.deckDangerBtn} onPress={() => setConfirmVisible(true)}>
                <Text style={styles.deckDangerText}>Take Down Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <ConfirmDialog
        visible={confirmVisible}
        title="Take down book"
        message="This takes the entire generated textbook down for all students. Are you sure?"
        type="danger"
        confirmText={takingDown ? "Taking down..." : "Take down"}
        onConfirm={handleTakeDown}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
};

const ComparisonModal = ({ visible, item, onClose, onAction }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasExtractedText = Boolean(item.content && item.content.trim().length > 0);
  const questionCount = Array.isArray(item.questions) ? item.questions.length : Number(item.question_count || 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.deckContainer}>
        <View style={styles.deckHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.deckCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.deckTitle}>Moderation Deck</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={{ flex: 1 }}>
          <View style={styles.deckSplitSection}>
            <View style={styles.deckSplitLabel}>
              <Zap size={14} color={colors.primary} />
              <Text style={styles.deckSplitText}>AI RECONCILED VERSION</Text>
            </View>
            <View style={styles.deckCard}>
              <Text style={styles.deckCardTitle}>{item.title}</Text>
              <Text style={styles.deckCardBody}>
                {hasExtractedText
                  ? item.content.slice(0, 1200)
                  : "No extracted text is available yet. Admins can still inspect the uploaded file before approving or rejecting."}
              </Text>
              <View style={styles.aiReasonBox}>
                <Info size={16} color={colors.primary} />
                <Text style={styles.aiReasonText}>
                  {questionCount > 0
                    ? `${questionCount} CBT questions are already attached to this material.`
                    : "CBT questions will be generated after approval when enough text is available."}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.deckSplitSection}>
            <View style={styles.deckSplitLabel}>
              <Text style={styles.deckSplitText}>ORIGINAL CLIPS & PAGES</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clipsScroll}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.clipCard}>
                  <Image source={{ uri: `https://picsum.photos/seed/${item.id + i}/200/200` }} style={styles.clipImage} />
                  <View style={styles.clipFooter}>
                    <Text style={styles.clipText}>Page #{i}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={styles.deckActionRow}>
          <TouchableOpacity style={styles.deckRejectBtn} onPress={() => onAction("takedown")}>
            <XCircle size={18} color={colors.error} />
            <Text style={styles.deckRejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deckViewBtn} onPress={() => onAction("view")}>
            <Eye size={18} color={colors.textPrimary} />
            <Text style={styles.deckViewText}>View File</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deckApproveBtn} onPress={() => onAction("approve")}>
            <CheckCircle2 size={18} color="#FFF" />
            <Text style={styles.deckApproveText}>Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const ContentModerationScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Screen style={styles.screen}>
      {/* Hero Command Header */}
      <LinearGradient colors={["#0B1E12", "#04110A"]} style={styles.heroHeader}>
        <View style={styles.statusBadge}>
          <ShieldAlert size={12} color={colors.primary} />
          <Text style={styles.statusBadgeText}>MODERATION ACTIVE</Text>
        </View>
        <Text style={styles.heroEyebrow}>CONTENT QUEUE & QUALITY CONTROL</Text>
        <Text style={styles.heroTitle}>Content Moderation</Text>
        <Text style={styles.heroSub}>Approve student uploads, review AI generated textbooks & process flagged files</Text>
      </LinearGradient>

      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
          tabBarIndicatorStyle: { backgroundColor: colors.primary, height: 3, borderRadius: 1.5 },
          tabBarLabelStyle: { fontSize: 11, fontFamily: "Inter-SemiBold", textTransform: "capitalize" },
          tabBarScrollEnabled: true,
        }}
      >
        <Tab.Screen name="Flagged" children={() => <ModerationQueue status="flagged" />} />
        <Tab.Screen name="Pending" children={() => <ModerationQueue status="pending" />} />
        <Tab.Screen name="Verified" children={() => <ModerationQueue status="verified" />} />
        <Tab.Screen name="Textbooks" children={() => <TextbookSectionsQueue />} />
      </Tab.Navigator>
    </Screen>
  );
};

const createStyles = (colors: typeof import("../../../theme/colors").darkPalette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    heroHeader: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(34, 197, 94, 0.25)",
    },
    statusBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(34, 197, 94, 0.3)",
      marginBottom: 10,
    },
    statusBadgeText: {
      fontSize: 10,
      fontFamily: "SpaceMono-Regular",
      fontWeight: "700",
      color: colors.primary,
    },
    heroEyebrow: {
      fontSize: 11,
      fontFamily: "SpaceMono-Regular",
      color: colors.primary,
      marginBottom: 4,
    },
    heroTitle: {
      fontSize: 26,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    heroSub: {
      fontSize: 13,
      lineHeight: 19,
      fontFamily: "Inter-Regular",
      color: colors.textSecondary,
    },
    bulkBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bulkCountText: {
      fontSize: 13,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
    },
    bulkTipText: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
    },
    bulkSecondaryBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bulkSecondaryText: {
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
      color: colors.textPrimary,
    },
    bulkPrimaryBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
    },
    bulkPrimaryText: {
      fontSize: 12,
      fontFamily: "Inter-Bold",
      color: "#FFF",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
    },
    itemCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    itemCardSelected: {
      borderColor: colors.primary,
      backgroundColor: "rgba(34, 197, 94, 0.08)",
    },
    itemMain: {
      flex: 1,
      marginRight: 12,
    },
    itemHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    itemTitle: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
    },
    courseBadge: {
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    courseBadgeText: {
      fontSize: 9,
      fontFamily: "SpaceMono-Regular",
      color: colors.primary,
      fontWeight: "700",
    },
    itemMeta: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
    },
    readinessRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 8,
    },
    readinessPill: {
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    readinessText: {
      fontSize: 9,
      fontFamily: "SpaceMono-Regular",
      fontWeight: "700",
    },
    actionGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    selectedCheck: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    approveIconBtn: {
      backgroundColor: "rgba(34, 197, 94, 0.12)",
      borderColor: "rgba(34, 197, 94, 0.3)",
    },
    takedownIconBtn: {
      backgroundColor: "rgba(239, 68, 68, 0.12)",
      borderColor: "rgba(239, 68, 68, 0.3)",
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: "Inter-SemiBold",
      color: colors.textPrimary,
      marginTop: 12,
    },
    emptySub: {
      fontSize: 13,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
      marginTop: 4,
    },
    retryBtn: {
      marginTop: 16,
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
    retryBtnText: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: colors.error,
    },
    flagNote: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: colors.error,
      marginTop: 4,
    },
    deckContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    deckHeader: {
      height: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    deckCancelText: {
      fontSize: 14,
      fontFamily: "Inter-Medium",
      color: colors.primary,
    },
    deckTitle: {
      fontSize: 16,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
    },
    deckSectionTitle: {
      fontSize: 20,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
    },
    deckOutcomeText: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: colors.textMuted,
      marginTop: 4,
    },
    flagNotesBox: {
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      borderColor: "rgba(239, 68, 68, 0.25)",
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginTop: 16,
    },
    flagNotesTitle: {
      fontSize: 10,
      fontFamily: "SpaceMono-Regular",
      fontWeight: "700",
      color: colors.error,
    },
    flagNotesText: {
      fontSize: 13,
      fontFamily: "Inter-Regular",
      color: colors.textPrimary,
      marginTop: 4,
    },
    deckContentLabel: {
      fontSize: 10,
      fontFamily: "SpaceMono-Regular",
      color: colors.textMuted,
      marginTop: 20,
      marginBottom: 8,
    },
    deckBodyText: {
      fontSize: 14,
      lineHeight: 22,
      fontFamily: "Inter-Regular",
      color: colors.textSecondary,
    },
    deckTextarea: {
      minHeight: 280,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: colors.textPrimary,
    },
    deckFooter: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    deckPrimaryBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    deckPrimaryText: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: "#FFF",
    },
    deckDangerBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
    },
    deckDangerText: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: colors.error,
    },
    deckSplitSection: {
      marginBottom: 20,
    },
    deckSplitLabel: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: colors.surface,
    },
    deckSplitText: {
      fontSize: 11,
      fontFamily: "SpaceMono-Regular",
      fontWeight: "700",
      color: colors.textPrimary,
    },
    deckCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      margin: 20,
      padding: 18,
    },
    deckCardTitle: {
      fontSize: 18,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
      marginBottom: 10,
    },
    deckCardBody: {
      fontSize: 14,
      lineHeight: 22,
      fontFamily: "Inter-Regular",
      color: colors.textSecondary,
    },
    aiReasonBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      padding: 12,
      marginTop: 16,
    },
    aiReasonText: {
      flex: 1,
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: colors.textSecondary,
    },
    clipsScroll: {
      paddingLeft: 20,
      marginTop: 10,
    },
    clipCard: {
      width: 140,
      height: 170,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: 12,
      overflow: "hidden",
    },
    clipImage: {
      flex: 1,
    },
    clipFooter: {
      padding: 8,
      alignItems: "center",
    },
    clipText: {
      fontSize: 11,
      fontFamily: "Inter-Medium",
      color: colors.textSecondary,
    },
    deckActionRow: {
      flexDirection: "row",
      gap: 10,
      padding: 16,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    deckRejectBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    deckRejectText: {
      fontSize: 12,
      fontFamily: "Inter-Bold",
      color: colors.error,
    },
    deckViewBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    deckViewText: {
      fontSize: 12,
      fontFamily: "Inter-Bold",
      color: colors.textPrimary,
    },
    deckApproveBtn: {
      flex: 1.2,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    deckApproveText: {
      fontSize: 12,
      fontFamily: "Inter-Bold",
      color: "#FFF",
    },
  });

