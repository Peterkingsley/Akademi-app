import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { CalendarDays, Check, ChevronDown, ImagePlus, Plus, Search, Trash2, X } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { useTheme } from "../../../theme/ThemeContext";
import {
  adminService,
  TournamentAudienceOptions,
  TournamentMaterialOption,
} from "../../../services/adminService";
import api from "../../../services/api";

type UniversityOption = { id: string; name: string; location?: string; type?: string };
type DepartmentOption = { id: string; name: string; faculty: string };
type AudienceScope = "EVERYONE" | "UNIVERSITY" | "FACULTY" | "DEPARTMENT";
type CampaignType = "SIMPLE" | "MULTI_STAGE";
type StageDraft = {
  name: string;
  starts_at: string;
  duration_minutes: string;
  question_count: string;
  qualification_count: string;
};
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
  | "checkInClosesAt"
  | "predictionClosesAt";

const defaultAccent = "#AFE607";

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
  const [campaignType, setCampaignType] = useState<CampaignType>("SIMPLE");
  const [predictionEnabled, setPredictionEnabled] = useState(false);
  const [predictionPrizeSummary, setPredictionPrizeSummary] = useState("");
  const [predictionWinnerCount, setPredictionWinnerCount] = useState("1");
  const [predictionClosesAt, setPredictionClosesAt] = useState<Date | null>(null);
  const [stages, setStages] = useState<StageDraft[]>([
    {
      name: "Open Challenge",
      starts_at: "",
      duration_minutes: "30",
      question_count: "10",
      qualification_count: "1000",
    },
  ]);

  const [audienceScope, setAudienceScope] = useState<AudienceScope>("EVERYONE");
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [audienceOptions, setAudienceOptions] = useState<TournamentAudienceOptions>({
    faculties: [],
    departments: [],
  });
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
    fetchAudienceOptions();
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

  const departmentNames = useMemo(
    () => Array.from(new Set(departments.map((item) => item.name))).sort(),
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
      const options = audienceScope === "UNIVERSITY" ? faculties : audienceOptions.faculties;
      return options.filter((item) => !query || item.toLowerCase().includes(query));
    }
    if (pickerMode === "department") {
      const options =
        audienceScope === "DEPARTMENT"
          ? audienceOptions.departments
          : audienceScope === "UNIVERSITY"
            ? departments
                .filter((item) => item.faculty === selectedFaculty)
                .map((item) => item.name)
            : departmentNames;
      return Array.from(new Set(options)).filter((item) => !query || item.toLowerCase().includes(query));
    }
    if (pickerMode === "materials") {
      return materials.filter((item) => {
        const blob = `${item.title} ${item.course_code || ""} ${item.department} ${item.university}`.toLowerCase();
        return !query || blob.includes(query);
      });
    }
    return [];
  }, [
    pickerMode,
    pickerSearch,
    universities,
    faculties,
    departments,
    selectedFaculty,
    materials,
    audienceOptions,
    audienceScope,
    departmentNames,
  ]);

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

  const fetchAudienceOptions = async () => {
    try {
      const data = await adminService.listTournamentAudienceOptions();
      setAudienceOptions(data);
    } catch {
      setAudienceOptions({ faculties: [], departments: [] });
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
              ? { faculty: selectedFaculty || undefined }
              : {
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

  const assignDateField = (field: DateField, value: Date | null) => {
    if (field === "scheduledAt") setScheduledAt(value);
    if (field === "registrationClosesAt") setRegistrationClosesAt(value);
    if (field === "lateJoinCutoffAt") setLateJoinCutoffAt(value);
    if (field === "checkInOpensAt") setCheckInOpensAt(value);
    if (field === "checkInClosesAt") setCheckInClosesAt(value);
    if (field === "predictionClosesAt") setPredictionClosesAt(value);
  };

  const openAndroidDateTimePicker = (field: DateField, initialValue: Date) => {
    DateTimePickerAndroid.open({
      value: initialValue,
      mode: "date",
      is24Hour: false,
      onChange: (dateEvent, pickedDate) => {
        if (dateEvent.type !== "set" || !pickedDate) return;

        const mergedDate = new Date(initialValue);
        mergedDate.setFullYear(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());

        DateTimePickerAndroid.open({
          value: mergedDate,
          mode: "time",
          is24Hour: false,
          onChange: (timeEvent, pickedTime) => {
            if (timeEvent.type !== "set" || !pickedTime) return;

            const mergedDateTime = new Date(mergedDate);
            mergedDateTime.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
            assignDateField(field, mergedDateTime);
          },
        });
      },
    });
  };

  const openDatePicker = (field: DateField) => {
    const value =
      field === "scheduledAt"
        ? scheduledAt
        : field === "registrationClosesAt"
          ? registrationClosesAt
          : field === "lateJoinCutoffAt"
              ? lateJoinCutoffAt
              : field === "checkInOpensAt"
                ? checkInOpensAt
                : field === "checkInClosesAt"
                  ? checkInClosesAt
                  : predictionClosesAt;
    const nextValue = value || new Date();

    if (Platform.OS === "android") {
      openAndroidDateTimePicker(field, nextValue);
      return;
    }

    setTempDate(nextValue);
    setActiveDateField(field);
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
      setSelectedUniversityId(null);
      setSelectedUniversityName("");
      setSelectedFaculty("");
      setSelectedDepartment("");
    }
    if (scope === "FACULTY") {
      setSelectedUniversityId(null);
      setSelectedUniversityName("");
      setSelectedFaculty("");
      setSelectedDepartment("");
    }
    if (scope === "DEPARTMENT") {
      setSelectedUniversityId(null);
      setSelectedUniversityName("");
      setSelectedFaculty("");
      setSelectedDepartment("");
    }
  };

  const updateStage = (index: number, patch: Partial<StageDraft>) => {
    setStages((current) => current.map((stage, stageIndex) => (stageIndex === index ? { ...stage, ...patch } : stage)));
  };

  const addStage = () => {
    setStages((current) => [
      ...current,
      {
        name: `Stage ${current.length + 1}`,
        starts_at: "",
        duration_minutes: "15",
        question_count: "10",
        qualification_count: current.length === 0 ? "200" : "10",
      },
    ]);
  };

  const removeStage = (index: number) => {
    setStages((current) => (current.length <= 1 ? current : current.filter((_, stageIndex) => stageIndex !== index)));
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
      if (audienceScope === "UNIVERSITY") {
        setSelectedDepartment("");
      }
    }
    if (pickerMode === "department") {
      setSelectedDepartment(typeof item === "string" ? item : item.name);
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
    if (audienceScope === "UNIVERSITY" && !selectedUniversityName) {
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
    const predictionWinnerTotal = Number(predictionWinnerCount);
    if (predictionEnabled && predictionWinnerCount.trim() && (!Number.isFinite(predictionWinnerTotal) || predictionWinnerTotal < 1)) {
      Alert.alert("Prediction setup", "Prediction winner count must be at least 1.");
      return;
    }
    if (campaignType === "MULTI_STAGE") {
      const invalidStage = stages.find((stage) => {
        const startsAt = stage.starts_at.trim() || scheduledAt.toISOString();
        const duration = Number(stage.duration_minutes);
        const questionCount = Number(stage.question_count);
        const qualificationCount = stage.qualification_count.trim() ? Number(stage.qualification_count) : null;
        return (
          !stage.name.trim() ||
          !Number.isFinite(duration) ||
          duration < 1 ||
          !Number.isFinite(questionCount) ||
          questionCount < 1 ||
          (qualificationCount !== null && (!Number.isFinite(qualificationCount) || qualificationCount < 1)) ||
          Number.isNaN(new Date(startsAt).getTime())
        );
      });
      if (invalidStage) {
        Alert.alert("Stage setup", "Each stage needs a name, valid start time, duration, question count, and qualification count.");
        return;
      }
    }

    try {
      setSaving(true);
      await adminService.createTournament({
        title,
        description,
        campaign_type: campaignType,
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
        prediction_enabled: predictionEnabled,
        prediction_prize_summary: predictionEnabled ? predictionPrizeSummary || undefined : undefined,
        prediction_winner_count: predictionEnabled ? Number(predictionWinnerCount) || 1 : undefined,
        prediction_closes_at: predictionEnabled ? predictionClosesAt?.toISOString() : undefined,
        stages:
          campaignType === "MULTI_STAGE"
            ? stages.map((stage, index) => ({
                name: stage.name,
                stage_order: index + 1,
                starts_at: (stage.starts_at.trim() ? new Date(stage.starts_at.trim()) : scheduledAt).toISOString(),
                duration_minutes: Number(stage.duration_minutes) || 10,
                question_count: Number(stage.question_count) || 10,
                qualification_count: stage.qualification_count.trim() ? Number(stage.qualification_count) : undefined,
              }))
            : undefined,
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
      setCampaignType("SIMPLE");
      setPredictionEnabled(false);
      setPredictionPrizeSummary("");
      setPredictionWinnerCount("1");
      setPredictionClosesAt(null);
      setStages([
        {
          name: "Open Challenge",
          starts_at: "",
          duration_minutes: "30",
          question_count: "10",
          qualification_count: "1000",
        },
      ]);
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

  const SegmentButton = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[
        styles.segmentButton,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? `${colors.primary}18` : colors.surfaceElevated,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[typography.bodySmall, { color: active ? colors.primary : colors.textSecondary, fontWeight: "800" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Screen title="Create Tournament" scrollable>
      <View style={styles.container}>
        <Card style={{ ...styles.formCard, backgroundColor: colors.surface, borderColor: colors.border }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Challenge Setup</Text>
          <Input label="Challenge Title" placeholder="National GST 101 Challenge" value={title} onChangeText={setTitle} />

          <View style={styles.fieldWrap}>
            <Text style={[typography.caption, styles.fieldLabel, { color: colors.textSecondary }]}>Campaign Type</Text>
            <View style={styles.segmentRow}>
              <SegmentButton label="Simple" active={campaignType === "SIMPLE"} onPress={() => setCampaignType("SIMPLE")} />
              <SegmentButton label="Multi-stage" active={campaignType === "MULTI_STAGE"} onPress={() => setCampaignType("MULTI_STAGE")} />
            </View>
          </View>

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
          {audienceScope === "UNIVERSITY" ? (
            <FieldButton
              label="University / School"
              value={selectedUniversityName}
              placeholder={schoolLoading ? "Loading schools..." : "Choose school"}
              onPress={() => setPickerMode("university")}
            />
          ) : null}
          {audienceScope === "FACULTY" ? (
            <FieldButton
              label="Faculty"
              value={selectedFaculty}
              placeholder="Choose faculty"
              onPress={() => setPickerMode("faculty")}
            />
          ) : null}
          {audienceScope === "DEPARTMENT" ? (
            <FieldButton
              label="Department"
              value={selectedDepartment}
              placeholder="Choose department"
              onPress={() => setPickerMode("department")}
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

          <View style={styles.fieldWrap}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={[typography.caption, styles.fieldLabel, { color: colors.textSecondary }]}>Predictions</Text>
                <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "700" }]}>Allow spectators to predict a winner</Text>
              </View>
              <Switch
                value={predictionEnabled}
                onValueChange={setPredictionEnabled}
                trackColor={{ false: colors.border, true: `${colors.primary}80` }}
                thumbColor={predictionEnabled ? colors.primary : colors.textMuted}
              />
            </View>
          </View>

          {predictionEnabled ? (
            <View style={styles.nestedPanel}>
              <Input
                label="Prediction Prize Summary"
                placeholder="N20,000 prediction draw"
                value={predictionPrizeSummary}
                onChangeText={setPredictionPrizeSummary}
              />
              <FieldButton
                label="Prediction Closes"
                value={formatDate(predictionClosesAt)}
                placeholder="Choose prediction cutoff"
                onPress={() => openDatePicker("predictionClosesAt")}
              />
              <Input
                label="Prediction Winner Count"
                placeholder="1"
                value={predictionWinnerCount}
                onChangeText={setPredictionWinnerCount}
                keyboardType="number-pad"
              />
            </View>
          ) : null}

          {campaignType === "MULTI_STAGE" ? (
            <View style={styles.stageBuilder}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[typography.caption, styles.fieldLabel, { color: colors.textSecondary }]}>Stages</Text>
                  <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: "700" }]}>Build the qualification path</Text>
                </View>
                <TouchableOpacity style={[styles.smallActionButton, { borderColor: colors.border }]} onPress={addStage}>
                  <Plus size={15} color={colors.primary} />
                  <Text style={[typography.caption, { color: colors.primary, fontWeight: "800" }]}>Add</Text>
                </TouchableOpacity>
              </View>

              {stages.map((stage, index) => (
                <View key={`${stage.name}-${index}`} style={[styles.stageDraftCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                  <View style={styles.stageDraftHeader}>
                    <Text style={[typography.bodySmall, { color: colors.primary, fontWeight: "800" }]}>Stage {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeStage(index)} disabled={stages.length <= 1} style={styles.stageRemoveButton}>
                      <Trash2 size={15} color={stages.length <= 1 ? colors.textMuted : "#EF4444"} />
                    </TouchableOpacity>
                  </View>
                  <Input
                    label="Stage Name"
                    placeholder="Open Challenge"
                    value={stage.name}
                    onChangeText={(value) => updateStage(index, { name: value })}
                  />
                  <Input
                    label="Starts At"
                    placeholder={scheduledAt ? scheduledAt.toISOString() : "2026-07-01T10:00:00.000Z"}
                    value={stage.starts_at}
                    onChangeText={(value) => updateStage(index, { starts_at: value })}
                  />
                  <View style={styles.stageDraftGrid}>
                    <Input
                      label="Duration (min)"
                      placeholder="30"
                      value={stage.duration_minutes}
                      onChangeText={(value) => updateStage(index, { duration_minutes: value })}
                      keyboardType="number-pad"
                      style={styles.stageDraftInput}
                    />
                    <Input
                      label="Questions"
                      placeholder="10"
                      value={stage.question_count}
                      onChangeText={(value) => updateStage(index, { question_count: value })}
                      keyboardType="number-pad"
                      style={styles.stageDraftInput}
                    />
                  </View>
                  <Input
                    label="Qualification Count"
                    placeholder={index === stages.length - 1 ? "Leave blank for final" : "1000"}
                    value={stage.qualification_count}
                    onChangeText={(value) => updateStage(index, { qualification_count: value })}
                    keyboardType="number-pad"
                  />
                </View>
              ))}
            </View>
          ) : null}

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
              Audience: {audienceScope === "EVERYONE"
                ? "Everyone on Akademi"
                : audienceScope === "UNIVERSITY"
                  ? selectedUniversityName || "Selected university"
                  : audienceScope === "FACULTY"
                    ? `${selectedFaculty || "Selected faculty"} across all schools`
                    : `${selectedDepartment || "Selected department"} across all schools`}
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
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  nestedPanel: {
    marginBottom: 20,
    borderLeftWidth: 2,
    borderLeftColor: defaultAccent,
    paddingLeft: 12,
  },
  stageBuilder: {
    marginBottom: 20,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  smallActionButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stageDraftCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  stageDraftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  stageRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stageDraftGrid: {
    flexDirection: "row",
    gap: 10,
  },
  stageDraftInput: {
    flex: 1,
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

