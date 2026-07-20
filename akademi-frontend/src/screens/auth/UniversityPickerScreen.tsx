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
import { Search, BookOpen, CheckCircle2, Send } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import { AuthProgressDots } from "../../components/auth/AuthProgressDots";
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
  const [requestEmail, setRequestEmail] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

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

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setRequestSubmitted(false);
    setRequestError(null);
  };

  const handleRequestUniversity = async () => {
    const query = searchQuery.trim();
    if (!query || requestSubmitting) return;

    setRequestSubmitting(true);
    setRequestError(null);
    try {
      await api.post("/universities/requests", {
        query,
        email: requestEmail.trim() || undefined,
      });
      setRequestSubmitted(true);
    } catch (err: any) {
      setRequestError(err.response?.data?.message || "Couldn't send your request. Try again.");
    } finally {
      setRequestSubmitting(false);
    }
  };

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
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${item.name}, ${city}${stateCode ? `, ${stateCode}` : ""}`}
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
      rightAction={<AuthProgressDots step={1} total={4} />}
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
            keyboardShouldPersistTaps="handled"
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
                  onChangeText={handleSearchChange}
                  leftIcon={<Search size={20} color={colors.textMuted} />}
                />
              </View>
            }
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              searchQuery.trim() ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No matches for "{searchQuery.trim()}"</Text>
                  <Text style={styles.emptyText}>
                    We're adding schools throughout the beta. Tell us yours and we'll prioritise it.
                  </Text>
                  {requestSubmitted ? (
                    <View style={styles.requestConfirmed}>
                      <Text style={styles.requestConfirmedText}>
                        Thanks — we've noted "{searchQuery.trim()}" for our roadmap.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.requestForm}>
                      <Input
                        label=""
                        placeholder="Email (optional) — we'll notify you"
                        value={requestEmail}
                        onChangeText={setRequestEmail}
                        keyboardType="email-address"
                      />
                      {requestError ? <Text style={styles.requestErrorText}>{requestError}</Text> : null}
                      <TouchableOpacity
                        style={[styles.requestButton, requestSubmitting && styles.requestButtonDisabled]}
                        onPress={handleRequestUniversity}
                        disabled={requestSubmitting}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={`Request that ${searchQuery.trim()} be added`}
                      >
                        <Send size={16} color="#FFFFFF" />
                        <Text style={styles.requestButtonText}>
                          {requestSubmitting ? "Sending..." : "Request my school"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : null
            }
            ListFooterComponent={
              filteredUniversities.length > 0 ? (
                <View style={styles.aiBanner}>
                  <View style={styles.aiHeader}>
                    <BookOpen size={14} color={colors.primary} />
                    <Text style={styles.aiLabel}>WHY THIS MATTERS</Text>
                  </View>
                  <Text style={styles.aiText}>
                    Selecting your university unlocks school-specific course
                    materials and past examination papers shared by students
                    from your faculty.
                  </Text>
                </View>
              ) : null
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
          <Text style={styles.footerHint}>
            Don't see your school? Search for it above to request it.
          </Text>
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
  headline: {
    color: colors.textPrimary,
    fontSize: 21,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginTop: 8,
    marginBottom: 24,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 190,
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
    backgroundColor: "rgba(48,64,0,0.35)",
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
    fontSize: 12,
    fontFamily: "SpaceMono-Regular",
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    padding: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: "Inter-Bold",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: "Inter-Regular",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: "center",
  },
  requestForm: {
    marginTop: 16,
    width: "100%",
  },
  requestErrorText: {
    color: colors.error,
    fontFamily: "Inter-Regular",
    fontSize: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  requestButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  requestButtonDisabled: {
    opacity: 0.6,
  },
  requestButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter-Bold",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },
  requestConfirmed: {
    marginTop: 12,
  },
  requestConfirmedText: {
    color: colors.primary,
    fontFamily: "Inter-Medium",
    fontSize: 12,
    textAlign: "center",
  },
  aiBanner: {
    backgroundColor: colors.surfaceElevated,
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
    fontSize: 12,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  aiText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter-Regular",
  },
  footer: {
    padding: 24,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  continueButton: {
    marginBottom: 16,
  },
  footerHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    textAlign: "center",
  },
});
