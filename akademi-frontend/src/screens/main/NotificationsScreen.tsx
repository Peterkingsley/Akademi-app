import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  RefreshCw,
  Sparkles,
} from "lucide-react-native";

import { Screen } from "../../components/layout/Screen";
import { notificationService, Notification } from "../../services/notificationService";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
};

const getNotificationTone = (type: Notification["type"]) => {
  switch (type) {
    case "success":
      return { icon: CheckCircle2, color: colors.success, label: "Success" };
    case "warning":
      return { icon: AlertCircle, color: colors.warning, label: "Alert" };
    case "ai":
      return { icon: Sparkles, color: colors.primary, label: "Akademi" };
    default:
      return { icon: Bell, color: "#38BDF8", label: "Update" };
  }
};

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setError(null);
      const data = await notificationService.list();
      setNotifications(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load your notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkRead = async (id: string) => {
    const current = notifications.find((item) => item.id === id);
    if (!current || current.read) return;

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );

    try {
      await notificationService.markRead(id);
    } catch (err) {
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id ? { ...notification, read: false } : notification
        )
      );
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;

    const previous = notifications;
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));

    try {
      await notificationService.markAllRead();
    } catch (err) {
      setNotifications(previous);
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const tone = getNotificationTone(item.type);
    const Icon = tone.icon;

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.unreadCard]}
        activeOpacity={0.82}
        onPress={() => handleMarkRead(item.id)}
      >
        <View style={[styles.iconWrapper, { backgroundColor: `${tone.color}18` }]}>
          <Icon size={20} color={tone.color} />
        </View>
        <View style={styles.content}>
          <View style={styles.cardTop}>
            <Text style={[styles.typeLabel, { color: tone.color }]}>{tone.label}</Text>
            <Text style={styles.time}>{getTimeAgo(item.timestamp)}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.message}>{item.message}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <Screen hideHeader style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Activity</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
              : "You are all caught up"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={markAllAsRead}
          disabled={unreadCount === 0}
          style={[styles.markAllButton, unreadCount === 0 && styles.markAllDisabled]}
        >
          <Check size={16} color={unreadCount === 0 ? colors.textMuted : colors.primary} />
          <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.stateText}>Loading activity...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <AlertCircle size={32} color={colors.warning} />
          <Text style={styles.stateTitle}>Could not load activity</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity onPress={fetchNotifications} style={styles.retryButton}>
            <RefreshCw size={16} color={colors.background} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Bell size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptySubtext}>
                Upload approvals, tutor summaries, and study alerts will appear here when they are ready.
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.background,
    flexDirection: "row",
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerCopy: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 20,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  markAllButton: {
    alignItems: "center",
    borderColor: "rgba(34,197,94,0.28)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  markAllDisabled: {
    borderColor: colors.border,
    opacity: 0.7,
  },
  markAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 5,
  },
  markAllTextDisabled: {
    color: colors.textMuted,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  notificationCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 14,
  },
  unreadCard: {
    backgroundColor: "#101412",
    borderColor: "rgba(34,197,94,0.28)",
  },
  iconWrapper: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  content: {
    flex: 1,
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  typeLabel: {
    ...typography.label,
    fontSize: 9,
    letterSpacing: 0,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginLeft: 10,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 5,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  unreadDot: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    height: 8,
    marginLeft: 10,
    marginTop: 8,
    width: 8,
  },
  stateContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  stateTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
    marginTop: 14,
  },
  stateText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
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
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
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
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
    marginBottom: 8,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});
