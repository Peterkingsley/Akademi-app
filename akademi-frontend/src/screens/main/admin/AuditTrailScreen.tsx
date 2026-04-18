import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, ActivityLog } from "../../../services/adminService";
import {
  Filter,
  Terminal,
  Calendar,
  User,
  AlertCircle,
  Clock
} from "lucide-react-native";
import { Skeleton } from "../../../components/ui/Skeleton";

export const AuditTrailScreen: React.FC = () => {
  const { colors, spacing, typography } = useTheme();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, [activeFilter]);

  const fetchLogs = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) setLoading(true);
      else setLoadingMore(true);

      const currentPage = isLoadMore ? page + 1 : 1;
      const { logs: newLogs, hasMore: more } = await adminService.getActivityLogs({
        page: currentPage,
        filter: activeFilter
      });

      if (isLoadMore) {
        setLogs(prev => [...prev, ...newLogs]);
        setPage(currentPage);
      } else {
        setLogs(newLogs);
        setPage(1);
      }
      setHasMore(more);
    } catch (error) {
      console.error("Failed to fetch logs", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchLogs(true);
    }
  };

  const LogEntry = ({ log }: { log: ActivityLog }) => {
    const isDestructive = log.type === 'destructive';
    const isSystem = log.type === 'system';

    const getTextColor = () => {
      if (isDestructive) return "#EF4444";
      if (isSystem) return "#10B981";
      return colors.textPrimary;
    };

    return (
      <View style={[styles.logRow, { borderBottomColor: colors.border }]}>
        <View style={styles.logMeta}>
          <Text style={[styles.timestamp, { color: colors.textMuted }]}>
            [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]
          </Text>
          <Text style={[styles.adminName, { color: colors.primary }]}>{log.admin_name}</Text>
        </View>
        <View style={styles.logContent}>
          <Text style={[styles.actionText, { color: getTextColor() }]}>
            {log.action_verb.toUpperCase()} <Text style={{ color: colors.textSecondary }}>{log.target}</Text>
          </Text>
        </View>
      </View>
    );
  };

  const FilterPill = ({ id, label }: { id: string, label: string }) => (
    <TouchableOpacity
      style={[
        styles.filterPill,
        { borderColor: colors.border },
        activeFilter === id && { backgroundColor: colors.surfaceElevated, borderColor: colors.primary }
      ]}
      onPress={() => setActiveFilter(id)}
    >
      <Text style={[
        typography.caption,
        { color: colors.textSecondary },
        activeFilter === id && { color: colors.primary, fontWeight: '700' }
      ]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen title="Audit Trail">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          data={[
            { id: 'all', label: 'All Activity' },
            { id: 'me', label: 'My Actions' },
            { id: 'destructive', label: 'Deletions' },
            { id: 'security', label: 'Security' },
            { id: '24h', label: 'Last 24 Hours' }
          ]}
          renderItem={({ item }) => <FilterPill id={item.id} label={item.label} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        />
      </View>

      <View style={[styles.terminalContainer, { backgroundColor: colors.background }]}>
        <FlatList
          data={loading ? Array(15).fill({}) : logs}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={({ item }) => loading ? (
            <View style={styles.logRow}>
               <Skeleton width="100%" height={14} />
            </View>
          ) : (
            <LogEntry log={item} />
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
          ) : null}
          ListEmptyComponent={!loading ? (
            <View style={styles.emptyContainer}>
              <Terminal size={48} color={colors.textMuted} strokeWidth={1} />
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: 16 }]}>No logs found</Text>
            </View>
          ) : null}
          contentContainerStyle={styles.logsList}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  terminalContainer: {
    flex: 1,
  },
  logsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    gap: 12,
  },
  logMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  timestamp: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    width: 60,
  },
  adminName: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    fontWeight: '700',
    width: 80,
  },
  logContent: {
    flex: 1,
  },
  actionText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    lineHeight: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  }
});
