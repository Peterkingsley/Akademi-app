import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Search, CheckCircle2 } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/layout/Screen";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";

interface Department {
  id: string;
  name: string;
  faculty: string;
}

const LEVELS = ["100L", "200L", "300L", "400L", "500L", "PG"];

export const DepartmentPickerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { universityId, universityName } = route.params || {};

  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState("100L");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (universityId) {
      fetchDepartments();
    } else {
      setError("No university selected. Please go back.");
      setLoading(false);
    }
  }, [universityId]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/universities/${universityId}/departments`);
      const data: Department[] = response.data;
      setDepartments(data);

      const uniqueFaculties = Array.from(new Set(data.map(d => d.faculty))).sort();
      setFaculties(uniqueFaculties);

      if (uniqueFaculties.length > 0) {
        setSelectedFaculty(uniqueFaculties[0]);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to fetch departments", err);
      setError("Could not load departments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredDepts = departments.filter((d) => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFaculty = selectedFaculty ? d.faculty === selectedFaculty : true;
    return matchesSearch && matchesFaculty;
  });

  const handleContinue = () => {
    if (selectedDept) {
      navigation.navigate("Register", {
        universityId,
        university: universityName,
        faculty: selectedFaculty,
        department: selectedDept,
        level: selectedLevel,
      });
    }
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
      scrollable
    >
      <View style={styles.container}>
        <Text style={styles.headline}>What department are you in?</Text>
        <Text style={styles.subtext}>
          We'll surface the right courses and materials for you
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading departments...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Button label="Retry" onPress={fetchDepartments} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Faculty</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Pick one</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.facultyRow}
              >
                {faculties.map((faculty) => (
                  <TouchableOpacity
                    key={faculty}
                    style={[
                      styles.facultyChip,
                      selectedFaculty === faculty && styles.selectedFacultyChip,
                    ]}
                    onPress={() => setSelectedFaculty(faculty)}
                  >
                    <Text
                      style={[
                        styles.facultyChipText,
                        selectedFaculty === faculty && styles.selectedFacultyChipText,
                      ]}
                    >
                      {faculty}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Input
                label=""
                placeholder="Search department..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                leftIcon={<Search size={20} color={colors.textMuted} />}
              />
              <View style={styles.deptList}>
                {filteredDepts.length > 0 ? (
                  filteredDepts.map((dept) => {
                    const isSelected = selectedDept === dept.name;
                    return (
                      <TouchableOpacity
                        key={dept.id}
                        style={[
                          styles.deptItem,
                          isSelected && styles.selectedDeptItem,
                        ]}
                        onPress={() => setSelectedDept(dept.name)}
                      >
                        <Text style={styles.deptName}>{dept.name}</Text>
                        <View
                          style={[
                            styles.radioCircle,
                            isSelected && styles.radioCircleSelected,
                          ]}
                        >
                          {isSelected && (
                            <CheckCircle2 size={16} color="#FFFFFF" fill={colors.primary} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No departments found in this faculty.</Text>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Level / Year of Study</Text>
              <View style={styles.levelRow}>
                {LEVELS.map((level) => {
                  const isSelected = selectedLevel === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelPill,
                        isSelected && styles.selectedLevelPill,
                      ]}
                      onPress={() => setSelectedLevel(level)}
                    >
                      <Text
                        style={[
                          styles.levelPillText,
                          isSelected && styles.selectedLevelPillText,
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Button
              label="Continue"
              onPress={handleContinue}
              disabled={!selectedDept}
              style={styles.continueButton}
            />
          </>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    flex: 1,
  },
  center: {
    paddingVertical: 40,
    alignItems: "center",
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
  emptyText: {
    color: colors.textMuted,
    fontFamily: "Inter-Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
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
    marginTop: 20,
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 11.25,
    fontFamily: "Inter-Regular",
    marginTop: 8,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 9.75,
    fontFamily: "Inter-Regular",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  badge: {
    backgroundColor: colors.warning,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#000000",
    fontSize: 8.25,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  facultyRow: {
    paddingRight: 24,
  },
  facultyChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  selectedFacultyChip: {
    borderColor: colors.primary,
    backgroundColor: "#0D1526",
    borderWidth: 2,
  },
  facultyChipText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontFamily: "Inter-Regular",
  },
  selectedFacultyChipText: {
    color: colors.primary,
    fontWeight: "600",
  },
  deptList: {
    marginTop: 12,
  },
  deptItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedDeptItem: {
    borderColor: colors.primary,
    backgroundColor: "#0D1526",
  },
  deptName: {
    color: colors.textPrimary,
    fontSize: 11.25,
    fontFamily: "Inter-Regular",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  levelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  levelPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 70,
    alignItems: "center",
  },
  selectedLevelPill: {
    backgroundColor: "#FFFFFF",
  },
  levelPillText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontFamily: "Inter-Regular",
  },
  selectedLevelPillText: {
    color: "#000000",
    fontWeight: "700",
  },
  continueButton: {
    marginTop: 8,
    marginBottom: 80,
  },
});
