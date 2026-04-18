import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Modal, Dimensions } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Clock, CheckCircle2, XCircle, Zap, Info, Inbox, ChevronRight } from "lucide-react-native";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { Skeleton } from "../../../components/ui/Skeleton";

const Tab = createMaterialTopTabNavigator();
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const ModerationQueue = ({ status }: { status: string }) => {
  const { colors, typography, spacing } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    fetchItems();
  }, [status]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      let data;
      if (status === 'flagged') data = await adminService.getFlaggedMaterials();
      else if (status === 'pending') data = await adminService.getPendingMaterials();
      else if (status === 'verified') data = await adminService.getVerifiedMaterials();
      else data = await adminService.getArchivedMaterials();
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch queue", error);
    } finally {
      setLoading(false);
    }
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
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemRow, { borderBottomColor: colors.border }]}
            onPress={() => setSelectedItem(item)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { fontWeight: '600', color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.university} • {item.course_code}</Text>
              {status === 'pending' && (
                <View style={{ marginTop: 8 }}>
                   <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>Processing: 4/10 uploads</Text>
                   <ProgressBar progress={0.4} color={colors.primary} />
                </View>
              )}
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />

      {selectedItem && (
        <ComparisonModal
          visible={!!selectedItem}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAction={() => {
            setSelectedItem(null);
            fetchItems();
          }}
        />
      )}
    </View>
  );
};

const ComparisonModal = ({ visible, item, onClose, onAction }: any) => {
  const { colors, typography, spacing } = useTheme();

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
                {item.description || "No description provided for this material."}
              </Text>
              <View style={[styles.aiReason, { backgroundColor: colors.surface }]}>
                <Info size={16} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 8, flex: 1 }]}>
                  AI detected multiple low-confidence fragments. Reconciled based on course curriculum context.
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
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.error }]} onPress={onAction}>
             <XCircle size={20} color={colors.error} />
             <Text style={[typography.caption, { color: colors.error, fontWeight: '700', marginTop: 4 }]}>Takedown</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={onAction}>
             <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700' }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={onAction}>
             <CheckCircle2 size={20} color="#FFF" />
             <Text style={[typography.caption, { color: "#FFF", fontWeight: '700', marginTop: 4 }]}>Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const ContentModerationScreen: React.FC = () => {
  const { colors, typography } = useTheme();

  return (
    <Screen title="Content Queue">
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: { backgroundColor: colors.background },
          tabBarIndicatorStyle: { backgroundColor: colors.primary },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        }}
      >
        <Tab.Screen name="Flagged" children={() => <ModerationQueue status="flagged" />} />
        <Tab.Screen name="Pending" children={() => <ModerationQueue status="pending" />} />
        <Tab.Screen name="Verified" children={() => <ModerationQueue status="verified" />} />
        <Tab.Screen name="Reported" children={() => <ModerationQueue status="archived" />} />
      </Tab.Navigator>
    </Screen>
  );
};

const styles = StyleSheet.create({
  itemRow: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
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
  }
});
