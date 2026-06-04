import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import { userService } from "../../services/user";
import { Material } from "../../services/material";
import { FileText, CloudUpload, ChevronRight, Clock } from "lucide-react-native";

export const MyUploadsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Material[]>([]);

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    try {
      const data = await userService.getUploads();
      setUploads(data);
    } catch (error) {
      console.error("Failed to fetch uploads", error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Material }) => (
    <TouchableOpacity
      style={styles.uploadItem}
      activeOpacity={0.7}
      onPress={() => navigation.navigate("StudyMode", { materialId: item.id })}
    >
      <View style={styles.fileIcon}>
        <FileText size={20} color={colors.primary} />
      </View>
      <View style={styles.uploadInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.course_code || "General"}</Text>
          <View style={styles.dot} />
          <Clock size={10} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {new Date(item.updated_at || item.created_at || Date.now()).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View style={[
        styles.statusPill,
        { backgroundColor: item.verification_status === 'VERIFIED' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)' }
      ]}>
        <Text style={[
          styles.statusText,
          { color: item.verification_status === 'VERIFIED' ? colors.primary : colors.warning }
        ]}>
          {item.verification_status}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Screen style={{ flex: 1 }} title="My Uploads" onBack={() => navigation.goBack()}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : uploads.length > 0 ? (
          <FlatList
            data={uploads}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
          />
        ) : (
          <View style={styles.emptyState}>
            <CloudUpload size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No uploads yet</Text>
            <Text style={styles.emptySubtitle}>
              Contribute study materials to help others and earn points.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    padding: 20,
  },
  uploadItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  uploadInfo: {
    flex: 1,
  },
  fileName: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: "SpaceMono-Regular",
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.textMuted,
    marginHorizontal: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 20,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
});
