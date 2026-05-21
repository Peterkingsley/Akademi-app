import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import { WifiOff, FileText, Trash2, ExternalLink } from "lucide-react-native";
import { offlineService } from "../../services/material";
import { Material } from "../../services/material";
import * as WebBrowser from "expo-web-browser";

export const OfflineDownloadsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [materials, setMaterials] = useState<Material[]>([]);

  useEffect(() => {
    loadOfflineMaterials();
  }, []);

  const loadOfflineMaterials = async () => {
    const data = await offlineService.getOfflineMaterials();
    setMaterials(data);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Download",
      "Are you sure you want to remove this material from your offline storage?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await offlineService.deleteOfflineMaterial(id);
            loadOfflineMaterials();
          }
        }
      ]
    );
  };

  const handleOpen = async (material: Material) => {
    // In a real app, you might use a PDF viewer for local files
    // For MVP, we'll try to open the local URI
    try {
      await WebBrowser.openBrowserAsync(material.file_ref);
    } catch (error) {
      Alert.alert("Error", "Could not open file.");
    }
  };

  const renderItem = ({ item }: { item: Material }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.iconWrapperSmall}>
          <FileText size={20} color={colors.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardSub}>{item.course_code} • {item.file_type}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpen(item)}>
          <ExternalLink size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
          <Trash2 size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Screen style={{ flex: 1 }} title="Offline Downloads" onBack={() => navigation.goBack()}>
      <View style={styles.container}>
        {materials.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.iconWrapper}>
              <WifiOff size={48} color={colors.textMuted} />
            </View>
            <Text style={styles.title}>No Offline Content</Text>
            <Text style={styles.subtitle}>
              Materials you download for offline use will appear here. You can access them even without an internet connection.
            </Text>
          </View>
        ) : (
          <FlatList
            data={materials}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconWrapperSmall: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
  },
  cardSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 14,
  },
});
