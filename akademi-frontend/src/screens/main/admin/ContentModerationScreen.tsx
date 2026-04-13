import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService } from "../../../services/adminService";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

export const ContentModerationScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const data = await adminService.getFlaggedMaterials();
      setMaterials(data);
    } catch (error) {
      console.error("Failed to fetch flagged materials", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await adminService.approveMaterial(id);
      Alert.alert("Success", "Material approved and published.");
      fetchMaterials();
    } catch (error) {
      Alert.alert("Error", "Failed to approve material.");
    }
  };

  const handleTakedown = async (id: string) => {
    try {
      await adminService.takedownMaterial(id);
      Alert.alert("Success", "Material taken down.");
      fetchMaterials();
    } catch (error) {
      Alert.alert("Error", "Failed to take down material.");
    }
  };

  const renderMaterial = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Text style={[typography.body, { fontWeight: "600" }]}>{item.title}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.course_code} • {item.university}</Text>
      <View style={[styles.reasonContainer, { backgroundColor: colors.surface }]}>
        <Text style={[typography.caption, { color: "#EF4444" }]}>Flagged: Low confidence reconciliation</Text>
      </View>
      <View style={styles.actions}>
        <Button
          label="Approve"
          variant="primary"
          onPress={() => handleApprove(item.id)}
          style={styles.actionButton}
        />
        <Button
          label="Takedown"
          variant="ghost"
          onPress={() => handleTakedown(item.id)}
          style={styles.actionButton}
        />
      </View>
    </Card>
  );

  return (
    <Screen title="Content Moderation">
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={materials}
          keyExtractor={(item) => item.id}
          renderItem={renderMaterial}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={[typography.h4, { margin: 16 }]}>Flagged Materials Queue</Text>
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No flagged materials to review.</Text>
          }
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  reasonContainer: {
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    marginTop: 16,
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 0.48,
    height: 36,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 32,
  },
});
