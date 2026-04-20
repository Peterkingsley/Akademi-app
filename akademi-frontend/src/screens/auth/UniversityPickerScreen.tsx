import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Search, Sparkles, CheckCircle2 } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";

interface University {
  id: string;
  name: string;
  location?: string;
  city?: string;
  stateCode?: string;
}

export const UniversityPickerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUniversities();
  }, []);

  const fetchUniversities = async () => {
    try {
      setLoading(true);
      const response = await api.get("/universities");
      // Handle both direct array and search result format
      const data = Array.isArray(response.data) ? response.data : response.data.hits?.map((h: any) => h.document) || [];
      setUniversities(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch universities", err);
      setError("Could not load universities. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUniversities = universities.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContinue = () => {
    const selectedUni = universities.find(u => u.id === selectedId);
    if (selectedUni) {
      navigation.navigate("DepartmentPicker", {
        universityId: selectedUni.id,
        universityName: selectedUni.name
      });
    }
  };

  const renderItem = ({ item }: { item: University }) => {
    const isSelected = selectedId === item.id;
    const locationParts = item.location?.split(",") || [];
    const city = item.city || locationParts[0]?.trim() || "Nigeria";
    const stateCode = item.stateCode || locationParts[1]?.trim() || "";

    return (
      <TouchableOpacity
        style={[
          styles.universityItem,
          isSelected && styles.selectedUniversityItem,
        ]}
        onPress={() => setSelectedId(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoInitial}>{item.name[0]}</Text>
        </View>
        <View style={styles.universityInfo}>
          <Text style={styles.universityName}>{item.name}</Text>
          <Text style={styles.universityLocation}>
            {city}{stateCode ? `, ${stateCode}` : ""}
          </Text>
        </View>
        {isSelected && <CheckCircle2 size={20} color={colors.primary} />}
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={{ flex: 1 }}
      onBack={() => navigation.goBack()}
      title=""
      rightAction={
        <View style={styles.progressDots}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      }
    >
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching universities...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Button label="Retry" onPress={fetchUniversities} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <FlatList
            data={filteredUniversities}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.header}>
                <Text style={styles.headline}>Which university do you attend?</Text>
                <Text style={styles.subtext}>
                  We'll personalise your experience based on your school
                </Text>
                <Input
                  label=""
                  placeholder="Search for your university..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  leftIcon={<Search size={20} color={colors.textMuted} />}
                />
              </View>
            }
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={
              <View style={styles.aiBanner}>
                <View style={styles.aiHeader}>
                  <Sparkles size={14} color={colors.primary} />
                  <Text style={styles.aiLabel}>AI RECOMMENDATION</Text>
                </View>
                <Text style={styles.aiText}>
                  Selecting your university unlocks school-specific course
                  materials and past examination papers curated by top scholars
                  from your faculty.
                </Text>
              </View>
            }
          />
        )}

        <View style={styles.footer}>
          <Button
            label="Continue"
            onPress={handleContinue}
            disabled={!selectedId || loading}
            style={styles.continueButton}
          />
          <TouchableOpacity style={styles.ghostLink}>
            <Text style={styles.ghostLinkText}>Can't find your university?</Text>
          </TouchableOpacity>
        </View>
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
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
  errorText: {
    color: colors.error,
    fontFamily: "Inter-Medium",
    fontSize: 12,
    textAlign: "center",
  },
  header: {
    paddingTop: 20,
  },
  progressDots: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1F2937",
    marginLeft: 4,
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 12,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 21,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 11.25,
    fontFamily: "Inter-Regular",
    marginTop: 8,
    marginBottom: 24,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 150, flexGrow: 1,
  },
  universityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedUniversityItem: {
    borderColor: colors.primary,
    borderLeftWidth: 3,
    backgroundColor: "#0D1526",
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  logoInitial: {
    color: "#000000",
    fontSize: 13.5,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  universityInfo: {
    flex: 1,
  },
  universityName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: "Inter-Bold",
    fontWeight: "600",
  },
  universityLocation: {
    color: colors.textSecondary,
    fontSize: 9.75,
    fontFamily: "SpaceMono-Regular",
    marginTop: 2,
  },
  aiBanner: {
    backgroundColor: "#0D1526",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  aiLabel: {
    color: colors.primary,
    fontSize: 8.25,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  aiText: {
    color: colors.textSecondary,
    fontSize: 9.75,
    lineHeight: 18,
    fontFamily: "Inter-Regular",
  },
  footer: {
    padding: 24,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  continueButton: {
    marginBottom: 16,
  },
  ghostLink: {
    alignItems: "center",
  },
  ghostLinkText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontFamily: "Inter-Regular",
  },
});
