import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { CalendarDays, Check, ChevronDown, ImagePlus, Search, X } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, TournamentMaterialOption } from "../../../services/adminService";
import api from "../../../services/api";

type UniversityOption = { id: string; name: string; location?: string; type?: string };
type DepartmentOption = { id: string; name: string; faculty: string };
type AudienceScope = "EVERYONE" | "UNIVERSITY" | "FACULTY" | "DEPARTMENT";
type PickerMode =
  | "scope"
  | "university"
  | "faculty"
  | "department"
  | "materials";
type DateField =
  | "scheduledAt"
  | "registrationClosesAt"
  | "lateJoinCutoffAt"
  | "checkInOpensAt"
  | "checkInClosesAt";

const defaultAccent = "#16A34A";

export const AdminTournamentCreateScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");
  const [preheader, setPreheader] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Register for challenge");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerFileName, setBannerFileName] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);

  const [audienceScope, setAudienceScope] = useState<AudienceScope>("EVERYONE");
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [selectedUniversityName, setSelectedUniversityName] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [schoolLoading, setSchoolLoading] = useState(false);

  const [materials, setMaterials] = useState<TournamentMaterialOption[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<TournamentMaterialOption[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [registrationClosesAt, setRegistrationClosesAt] = useState<Date | null>(null);
  const [lateJoinCutoffAt, setLateJoinCutoffAt] = useState<Date | null>(null);
  const [checkInOpensAt, setCheckInOpensAt] = useState<Date | null>(null);
  const [checkInClosesAt, setCheckInClosesAt] = useState<Date | null>(null);
  const [activeDateField, setActiveDateField] = useState<DateField | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useEffect(() => {
    fetchUniversities();
  }, []);

  useEffect(() => {
    if (selectedUniversityId) {
      fetchDepartments(selectedUniversityId);
    } else {
      setDepartments([]);
    }
  }, [selectedUniversityId]);

  useEffect(() => {
    fetchMaterials();
  }, [audienceScope, selectedUniversityName, selectedFaculty, selectedDepartment]);

  const faculties = useMemo(
    () => Array.from(new Set(departments.map((item) => item.faculty))).sort(),
    [departments],
  );

  const filteredPickerItems = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (pickerMode === "scope") {
      const scopes: AudienceScope[] = ["EVERYONE", "UNIVERSITY", "FACULTY", "DEPARTMENT"];
      return scopes.filter((item) => item.toLowerCase().includes(query));
    }
    if (pickerMode === "university") {
      return universities.filter((item) => !query || item.name.toLowerCase().includes(query));
    }
    if (pickerMode === "faculty") {
      return faculties.filter((item) => !query || item.toLowerCase().includes(query));
    }
    if (pickerMode === "department") {
      return departments.filter(
        (item) => item.faculty === selectedFaculty && (!query || item.name.toLowerCase().includes(query)),
      );
    }
    if (pickerMode === "materials") {
      return materials.filter((item) => {
        const blob = `${item.title} ${item.course_code || ""} ${item.department} ${item.university}`.toLowerCase();
        return !query || blob.includes(query);
      });
    }
    return [];
  }, [pickerMode, pickerSearch, universities, faculties, departments, selectedFaculty, materials]);

  const previewCourseLabel = useMemo(() => {
    const courseCodes = Array.from(new Set(selectedMaterials.map((item) => item.course_code).filter(Boolean)));
    if (courseCodes.length === 1) return courseCodes[0];
    if (courseCodes.length > 1) return "Mixed course event";
    return "Material-based event";
  }, [selectedMaterials]);

  const fetchUniversities = async () => {
    try {
      setSchoolLoading(true);
      const response = await api.get<UniversityOption[]>("/universities");
      setUniversities(response.data || []);
    } catch {
      Alert.alert("School list unavailable", "Could not load schools from the Akademi database.");
    } finally {
      setSchoolLoading(false);
    }
  };

  const fetchDepartments = async (universityId: string) => {
    try {
      setSchoolLoading(true);
      const response = await api.get<DepartmentOption[]>(`/universities/${universityId}/departments`);
      setDepartments(response.data || []);
    } catch {
      setDepartments([]);
      Alert.alert("Department list unavailable", "Could not load faculties and departments for this school.");
    } finally {
      setSchoolLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true);
      const params =
        audienceScope === "EVERYONE"
          ? {}
          : audienceScope === "UNIVERSITY"
            ? { university: selectedUniversityName || undefined }
            : audienceScope === "FACULTY"
              ? { university: selectedUniversityName || undefined, faculty: selectedFaculty || undefined }
              : {
                  university: selectedUniversityName || undefined,
                  faculty: selectedFaculty || undefined,
                  department: selectedDepartment || undefined,
                };
      const data = await adminService.listTournamentMaterialOptions(params);
      setMaterials(data);
      setSelectedMaterials((current) => current.filter((item) => data.some((option) => option.id === item.id)));
    } catch {
      setMaterials([]);
    } finally {
      setMaterialsLoading(false);
    }
  };

  const pickBannerImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploadingBanner(true);
      const uploaded = await adminService.uploadTournamentBanner({
        uri: asset.uri,
        name: asset.fileName || `tournament-banner-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
      setBannerUrl(uploaded.url);
      setBannerFileName(uploaded.fileName);
    } catch (error: any) {
      Alert.alert("Banner upload failed", error?.response?.data?.message || "Please try another image.");
    } finally {
      setUploadingBanner(false);
    }
  };

  const openDatePicker = (field: DateField) => {
    setActiveDateField(field);
    const value =
      field === "scheduledAt"
        ? scheduledAt
        : field === "registrationClosesAt"
          ? registrationClosesAt
          : field === "lateJoinCutoffAt"
            ? lateJoinCutoffAt
            : field === "checkInOpensAt"
              ? checkInOpensAt
              : checkInClosesAt;
    setTempDate(value || new Date());
  };

  const assignDateField = (field: DateField, value: Date | null) => {
    if (field === "scheduledAt") setScheduledAt(value);
    if (field === "registrationClosesAt") setRegistrationClosesAt(value);
    if (field === "lateJoinCutoffAt") setLateJoinCutoffAt(value);
    if (field === "checkInOpensAt") setCheckInOpensAt(value);
    if (field === "checkInClosesAt") setCheckInClosesAt(value);
  };

  const handleDateChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (!activeDateField) return;
    if (Platform.OS === "android") {
      if (value) assignDateField(activeDateField, value);
      setActiveDateField(null);
      return;
    }
    if (value) setTempDate(value);
  };

  const confirmIosDate = () => {
    if (activeDateField) assignDateField(activeDateField, tempDate);
    setActiveDateField(null);
  };

  const clearScopeSelections = (scope: AudienceScope) => {
    setAudienceScope(scope);
    if (scope === "EVERYONE") {
      setSelectedUniversityId(null);
      setSelectedUniversityName("");
      setSelectedFaculty("");
      setSelectedDepartment("");
    }
    if (scope === "UNIVERSITY") {
      setSelectedFaculty("");
      setSelectedDepartment("");
    }
    if (scope === "FACULTY") {
      setSelectedDepartment("");
    }
  };

  const selectPickerItem = (item: any) => {
    if (pickerMode === "scope") {
      clearScopeSelections(item as AudienceScope);
      setPickerMode(null);
      return;
    }
    if (pickerMode === "university") {
      setSelectedUniversityId(item.id);
      setSelectedUniversityName(item.name);
      setSelectedFaculty("");
      setSelectedDepartment("");
    }
    if (pickerMode === "faculty") {
      setSelectedFaculty(item as string);
      setSelectedDepartment("");
    }
    if (pickerMode === "department") {
      setSelectedDepartment(item.name);
    }
    if (pickerMode === "materials") {
      const option = item as TournamentMaterialOption;
      setSelectedMaterials((current) =>
        current.some((entry) => entry.id === option.id)
          ? current.filter((entry) => entry.id !== option.id)
          : [...current, option],
      );
      return;
    }
    setPickerMode(null);
  };

  const createTournament = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Give the challenge a clear tournament title.");
      return;
    }
    if (!scheduledAt) {
      Alert.alert("Missing schedule", "Choose when this tournament should go live.");
      return;
    }
    if (selectedMaterials.length === 0) {
      Alert.alert("Select materials", "Choose at least one verified material from the Akademi database.");
      return;
    }
    if (audienceScope !== "EVERYONE" && !selectedUniversityName) {
      Alert.alert("Select school", "Choose the school this tournament is for.");
      return;
    }
    if (audienceScope === "FACULTY" && !selectedFaculty) {
      Alert.alert("Select faculty", "Choose the faculty for this tournament.");
      return;
    }
    if (audienceScope === "DEPARTMENT" && !selectedDepartment) {
      Alert.alert("Select department", "Choose the department for this tournament.");
      return;
    }

    try {
      setSaving(true);
      await adminService.createTournament({
        title,
        description,
        scheduled_at: scheduledAt.toISOString(),
        registration_closes_at: registrationClosesAt?.toISOString(),
        late_join_cutoff_at: lateJoinCutoffAt?.toISOString(),
        check_in_opens_at: checkInOpensAt?.toISOString(),
        check_in_closes_at: checkInClosesAt?.toISOString(),
        prize_summary: prize || undefined,
        campaign_preheader: preheader || undefined,
        campaign_banner_url: bannerUrl || undefined,
        campaign_cta_label: ctaLabel || undefined,
        campaign_accent_color: defaultAccent,
        audience_scope: audienceScope,
        audience_university: selectedUniversityName || undefined,
        audience_faculty: selectedFaculty || undefined,
        audience_department: selectedDepartment || undefined,
        source_material_ids: selectedMaterials.map((item) => item.id),
      });

      Alert.alert("Tournament created", "Your new tournament campaign has been saved as a draft.");
      setTitle("");
      setDescription("");
      setPrize("");
      setPreheader("");
      setCtaLabel("Register for challenge");
      setBannerUrl("");
      setBannerFileName("");
      setSelectedMaterials([]);
      setScheduledAt(null);
      setRegistrationClosesAt(null);
      setLateJoinCutoffAt(null);
      setCheckInOpensAt(null);
      setCheckInClosesAt(null);
    } catch (error: any) {
      Alert.alert("Unable to create tournament", error?.response?.data?.message || "Please check the tournament setup.");
    } finally {
      setSaving(false);
    }
  };

  const FieldButton = ({
    label,
    value,
    placeholder,
    onPress,
    disabled,
  }: {
    label: string;
    value?: string;
    placeholder: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <View style={styles.fieldWrap}>
      <Text style={[typography.caption, styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.selectField,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          disabled && { opacity: 0.45 },
        ]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text style={[typography.body, { color: value ? colors.textPrimary : colors.textMuted, flex: 1 }]}>
          {value || placeholder}
        </Text>
        <ChevronDown size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  const formatDate = (value: Date | null) => (value ? value.toLocaleString() : "");

  return (
    <Screen title="Create Tournament" scrollable>
      <View style={styles.container}>
        <Card style={{ ...styles.formCard, backgroundColor: colors.surface, borderColor: colors.border }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Challenge Setup</Text>
          <Input label="Challenge Title" placeholder="National GST 101 Challenge" value={title} onChangeText={setTitle} />

          <View style={styles.fieldWrap}>
            <Text style={[typography.caption, styles.fieldLabel, { color: colors.textSecondary }]}>Campaign Description</Text>
            <TextInput
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="Write the full campaign brief students should read before they register."
              placeholderTextColor={colors.textMuted}
              style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            />
          </View>

          <FieldButton
            label="Audience Scope"
            value={audienceScope}
            placeholder="Choose who can join"
            onPress={() => setPickerMode("scope")}
          />
          {audienceScope !== "EVERYONE" ? (
            <FieldButton
              label="University / School"
              value={selectedUniversityName}
              placeholder={schoolLoading ? "Loading schools..." : "Choose school"}
              onPress={() => setPickerMode("university")}
            />
          ) : null}
          {(audienceScope === "FACULTY" || audienceScope === "DEPARTMENT") ? (
            <FieldButton
              label="Faculty"
              value={selectedFaculty}
              placeholder={!selectedUniversityName ? "Choose school first" : "Choose faculty"}
              onPress={() => setPickerMode("faculty")}
              disabled={!selectedUniversityName}
            />
          ) : null}
          {audienceScope === "DEPARTMENT" ? (
            <FieldButton
              label="Department"
              value={selectedDepartment}
              placeholder={!selectedFaculty ? "Choose faculty first" : "Choose department"}
              onPress={() => setPickerMode("department")}
              disabled={!selectedFaculty}
            />
          ) : null}

          <View style={styles.fieldWrap}>
            <Text style={[typography.caption, styles.fieldLabel, { color: colors.textSecondary }]}>Verified Materials</Text>
            <TouchableOpacity
              style={[styles.selectField, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={() => setPickerMode("materials")}
            >
              <Text style={[typography.body, { color: selectedMaterials.length ? colors.textPrimary : colors.textMuted, flex: 1 }]}>
                {selectedMaterials.length
                  ? `${selectedMaterials.length} material${selectedMaterials.length > 1 ? "s" : ""} selected`
                  : materialsLoading
                    ? "Loading verified materials..."
                    : "Choose material source"}
              </Text>
              <ChevronDown size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {selectedMaterials.length ? (
              <View style={styles.chipsWrap}>
                {selectedMaterials.map((material) => (
                  <TouchableOpacity
                    key={material.id}
                    style={[styles.chip, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}38` }]}
                    onPress={() => setSelectedMaterials((current) => current.filter((entry) => entry.id !== material.id))}
                  >
                    <Text style={[typography.caption, { color: colors.primary }]}>
                      {material.course_code || "GENERAL"} · {material.title}
                    </Text>
                    <X size={12} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          <FieldButton label="Go Live Date & Time" value={formatDate(scheduledAt)} placeholder="Choose start time" onPress={() => openDatePicker("scheduledAt")} />
          <FieldButton label="Registration Closes" value={formatDate(registrationClosesAt)} placeholder="Choose closing time" onPress={() => openDatePicker("registrationClosesAt")} />
          <FieldButton label="Late Join Cutoff" value={formatDate(lateJoinCutoffAt)} placeholder="Choose late-join cutoff" onPress={() => openDatePicker("lateJoinCutoffAt")} />
          <FieldButton label="Check-in Opens" value={formatDate(checkInOpensAt)} placeholder="Choose check-in start" onPress={() => openDatePicker("checkInOpensAt")} />
          <FieldButton label="Check-in Closes" value={formatDate(checkInClosesAt)} placeholder="Choose check-in end" onPress={() => openDatePicker("checkInClosesAt")} />

          <Input label="Prize Summary" placeholder="N50,000 scholarship prize" value={prize} onChangeText={setPrize} />
          <Input label="Campaign Preheader" placeholder="Fast-paced showdown for engineering students" value={preheader} onChangeText={setPreheader} />
          <Input label="Register Button Text" placeholder="Register for challenge" value={ctaLabel} onChangeText={setCtaLabel} />

          <View style={styles.fieldWrap}>
            <Text style={[typography.caption, styles.fieldLabel, { color: colors.textSecondary }]}>Banner Image</Text>
            <TouchableOpacity
              style={[styles.bannerUploadButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              onPress={pickBannerImage}
              disabled={uploadingBanner}
            >
              <ImagePlus size={18} color={colors.primary} />
              <View style={styles.bannerUploadCopy}>
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>
                  {uploadingBanner ? "Uploading banner..." : bannerFileName || "Upload tournament banner"}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Students will see this on the campaign card.</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={{ ...styles.previewCard, backgroundColor: colors.surface, borderColor: colors.border }}>
          <Text style={[typography.caption, { color: colors.primary }]}>STUDENT PREVIEW</Text>
          <Text style={[typography.h4, { color: colors.textPrimary }]}>Exactly how the campaign will feel on the student side</Text>
          {bannerUrl ? <Image source={{ uri: bannerUrl }} style={styles.bannerPreview} resizeMode="cover" /> : null}
          <Card style={{ ...styles.previewInner, backgroundColor: colors.surfaceElevated, borderColor: colors.border }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{preheader || "Tournament campaign"}</Text>
            <Text style={[typography.h4, { color: colors.textPrimary }]}>{title || "Challenge title goes here"}</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {description || "Students will read your full campaign description here before they register."}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {previewCourseLabel} · {selectedMaterials.length} verified material{selectedMaterials.length === 1 ? "" : "s"}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Audience: {audienceScope === "EVERYONE" ? "Everyone on Akademi" : audienceScope === "UNIVERSITY" ? selectedUniversityName || "Selected university" : audienceScope === "FACULTY" ? `${selectedFaculty || "Selected faculty"} · ${selectedUniversityName || "school"}` : `${selectedDepartment || "Selected department"} · ${selectedUniversityName || "school"}`}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {prize || "Prize summary will show here"}
            </Text>
            {scheduledAt ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Starts {scheduledAt.toLocaleString()}
              </Text>
            ) : null}
            <TouchableOpacity style={[styles.previewButton, { backgroundColor: defaultAccent }]}>
              <Text style={styles.previewButtonText}>{ctaLabel || "Register for challenge"}</Text>
            </TouchableOpacity>
          </Card>
        </Card>

        <TouchableOpacity style={[styles.createButton, { backgroundColor: colors.primary }]} onPress={createTournament} disabled={saving}>
          <Text style={styles.createButtonText}>{saving ? "Creating tournament..." : "Create Tournament"}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={pickerMode !== null} animationType="slide" transparent onRequestClose={() => setPickerMode(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.h4, { color: colors.textPrimary }]}>
                {pickerMode === "scope"
                  ? "Choose audience scope"
                  : pickerMode === "university"
                    ? "Choose school"
                    : pickerMode === "faculty"
                      ? "Choose faculty"
                      : pickerMode === "department"
                        ? "Choose department"
                        : "Choose verified materials"}
              </Text>
              <TouchableOpacity onPress={() => setPickerMode(null)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Search size={16} color={colors.textMuted} />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search..."
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.textPrimary }]}
              />
            </View>
            <ScrollView contentContainerStyle={styles.modalList}>
              {filteredPickerItems.map((item: any) => {
                const isSelected =
                  pickerMode === "materials"
                    ? selectedMaterials.some((entry) => entry.id === item.id)
                    : false;
                return (
                  <TouchableOpacity
                    key={typeof item === "string" ? item : item.id}
                    style={[styles.modalItem, { borderColor: colors.border }]}
                    onPress={() => selectPickerItem(item)}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>
                        {typeof item === "string" ? item : item.name || item.title}
                      </Text>
                      {pickerMode === "materials" ? (
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          {item.course_code || "GENERAL"} · {item.department} · {item.university}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected ? <Check size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {pickerMode === "materials" ? (
              <TouchableOpacity style={[styles.doneButton, { backgroundColor: colors.primary }]} onPress={() => setPickerMode(null)}>
                <Text style={styles.doneButtonText}>Done selecting materials</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>

      {activeDateField ? (
        Platform.OS === "ios" ? (
          <Modal visible transparent animationType="slide" onRequestClose={() => setActiveDateField(null)}>
            <View style={styles.modalBackdrop}>
              <View style={[styles.dateModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <DateTimePicker value={tempDate} mode="datetime" display="spinner" onChange={handleDateChange} />
                <TouchableOpacity style={[styles.doneButton, { backgroundColor: colors.primary }]} onPress={confirmIosDate}>
                  <Text style={styles.doneButtonText}>Use this date & time</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker value={tempDate} mode="datetime" display="default" onChange={handleDateChange} />
        )
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  fieldWrap: {
    marginBottom: 20,
  },
  fieldLabel: {
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 9.75,
  },
  selectField: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 120,
    padding: 14,
    textAlignVertical: "top",
    fontSize: 12,
  },
  bannerUploadButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerUploadCopy: {
    flex: 1,
    gap: 2,
  },
  chipsWrap: {
    marginTop: 10,
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  bannerPreview: {
    width: "100%",
    height: 160,
    borderRadius: 14,
  },
  previewInner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  previewButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  previewButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  createButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  createButtonText: {
    color: "#04110A",
    fontWeight: "700",
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 16,
    maxHeight: "82%",
    gap: 12,
  },
  dateModalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  searchBar: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
  },
  modalList: {
    gap: 10,
    paddingBottom: 18,
  },
  modalItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  doneButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#04110A",
    fontWeight: "700",
    fontSize: 13,
  },
});
