import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation, useRoute } from "@react-navigation/native";
import { userService } from "../../services/user";
import { Material } from "../../services/material";
import { AlertCircle, CheckCircle2, ChevronRight, CloudUpload, Clock, FileText, RefreshCw } from "lucide-react-native";

export const MyUploadsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const showUploadSuccess = route.params?.uploadStatus === "success";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploads, setUploads] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    try {
      setError(null);
      const data = await userService.getUploads();
      setUploads(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load your uploads.");
      console.error("Failed to fetch uploads", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUploads();
  };

  const getStatusConfig = (status: Material["verification_status"]) => {
    switch (status) {
      case "VERIFIED":
        return {
          label: "Public",
          helper: "Approved and visible to other students",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          color: colors.primary,
          icon: CheckCircle2,
        };
      case "FLAGGED":
        return {
          label: "Needs review",
          helper: "Admin review found an issue",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          color: colors.error,
          icon: AlertCircle,
        };
      case "TAKEN_DOWN":
        return {
          label: "Removed",
          helper: "This material is no longer public",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          color: colors.error,
          icon: AlertCircle,
        };
      case "PENDING":
      default:
        return {
          label: "Pending approval",
          helper: "Only you can use it until admin approves",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          color: colors.warning,
          icon: Clock,
        };
    }
  };

  const renderItem = ({ item }: { item: Material }) => {
    const status = getStatusConfig(item.verification_status);
    const StatusIcon = status.icon;

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
        <View style={styles.trailing}>
          <View style={[styles.statusPill, { backgroundColor: status.backgroundColor }]}>
            <StatusIcon size={10} color={status.color} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
          <ChevronRight size={17} color={colors.textMuted} />
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
        ) : error ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <AlertCircle size={30} color={colors.warning} />
            </View>
            <Text style={styles.emptyTitle}>Uploads unavailable</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity onPress={fetchUploads} style={styles.retryButton}>
              <RefreshCw size={16} color={colors.background} />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : uploads.length > 0 ? (
          <FlatList
            data={uploads}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
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
            <View style={styles.emptyIcon}>
              <CloudUpload size={30} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No uploads yet</Text>
            <Text style={styles.emptySubtitle}>
              Upload course materials from Library. You can use pending uploads while admins review them.
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
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 8,
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
    minWidth: 0,
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
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    maxWidth: 104,
  },
  statusIcon: {
    marginRight: 3,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
    textAlign: "center",
  },
  trailing: {
    alignItems: "flex-end",
    gap: 12,
    marginLeft: 8,
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
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    height: 58,
    justifyContent: "center",
    marginBottom: 18,
    width: 58,
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
  retryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: "row",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    ...typography.body,
    color: colors.background,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },
});
