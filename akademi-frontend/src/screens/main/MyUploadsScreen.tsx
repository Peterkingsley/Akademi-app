import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation, useRoute } from "@react-navigation/native";
import { userService } from "../../services/user";
import { Material } from "../../services/material";
import { FileText, CloudUpload, Clock } from "lucide-react-native";

export const MyUploadsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const showUploadSuccess = route.params?.uploadStatus === "success";
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

  const getStatusConfig = (status: Material["verification_status"]) => {
    switch (status) {
      case "VERIFIED":
        return {
          label: "Public",
          helper: "Approved and visible to other students",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          color: colors.primary,
        };
      case "FLAGGED":
        return {
          label: "Needs review",
          helper: "Admin review found an issue",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          color: colors.error,
        };
      case "TAKEN_DOWN":
        return {
          label: "Removed",
          helper: "This material is no longer public",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          color: colors.error,
        };
      case "PENDING":
      default:
        return {
          label: "Pending approval",
          helper: "Only you can use it until admin approves",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          color: colors.warning,
        };
    }
  };

  const renderItem = ({ item }: { item: Material }) => {
    const status = getStatusConfig(item.verification_status);

    return (
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
          <Text style={styles.statusHelper} numberOfLines={2}>{status.helper}</Text>
        </View>
        <View style={[
          styles.statusPill,
          { backgroundColor: status.backgroundColor }
        ]}>
          <Text style={[
            styles.statusText,
            { color: status.color }
          ]}>
            {status.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
            ListHeaderComponent={
              showUploadSuccess ? (
                <View style={styles.successBanner}>
                  <Text style={styles.successTitle}>Upload complete</Text>
                  <Text style={styles.successText}>
                    You can use this material now. Other students will see it after admin approval.
                  </Text>
                </View>
              ) : null
            }
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
  successBanner: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  successTitle: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  successText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter-Regular",
    lineHeight: 16,
    marginTop: 4,
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
    maxWidth: 104,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
    textAlign: "center",
  },
  statusHelper: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: "Inter-Regular",
    marginTop: 6,
    lineHeight: 14,
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
