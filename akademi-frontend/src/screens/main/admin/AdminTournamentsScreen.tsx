import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { CalendarDays, Eye, ImagePlus, Plus, Radio, Trophy } from "lucide-react-native";
import { Screen } from "../../../components/layout/Screen";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { useTheme } from "../../../theme/ThemeContext";
import { adminService, AdminCompetitionRoom, AdminTournament } from "../../../services/adminService";
import * as ImagePicker from "expo-image-picker";

export const AdminTournamentsScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [rooms, setRooms] = useState<AdminCompetitionRoom[]>([]);
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [registrationClosesAt, setRegistrationClosesAt] = useState("");
  const [lateJoinCutoffAt, setLateJoinCutoffAt] = useState("");
  const [checkInOpensAt, setCheckInOpensAt] = useState("");
  const [checkInClosesAt, setCheckInClosesAt] = useState("");
  const [prize, setPrize] = useState("");
  const [preheader, setPreheader] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerFileName, setBannerFileName] = useState("");
  const [accentColor, setAccentColor] = useState("#16A34A");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [audienceScope, setAudienceScope] = useState<"EVERYONE" | "UNIVERSITY" | "FACULTY" | "DEPARTMENT">("EVERYONE");
  const [audienceUniversity, setAudienceUniversity] = useState("");
  const [audienceFaculty, setAudienceFaculty] = useState("");
  const [audienceDepartment, setAudienceDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);

  const formCardStyle: ViewStyle = {
    ...styles.formCard,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  };

  const loadTournaments = async () => {
    try {
      setLoadNotice(null);
      const [tournamentResult, roomResult] = await Promise.allSettled([
        adminService.listTournaments(),
        adminService.listCompetitionRooms(),
      ]);

      if (tournamentResult.status === "fulfilled") {
        setTournaments(tournamentResult.value);
      } else {
        setTournaments([]);
      }

      if (roomResult.status === "fulfilled") {
        setRooms(roomResult.value);
      } else {
        setRooms([]);
      }

      if (tournamentResult.status === "rejected" && roomResult.status === "rejected") {
        const error: any = tournamentResult.reason;
        throw error;
      }

      if (tournamentResult.status === "rejected") {
        setLoadNotice("Tournament campaigns could not load right now, but live room history is still available below.");
      } else if (roomResult.status === "rejected") {
        setLoadNotice("Live room history could not load right now, but tournament campaigns are still available.");
      }
    } catch (error: any) {
      setRooms([]);
      setTournaments([]);
      setLoadNotice(
        error?.response?.status === 404
          ? "Tournament admin routes are not live on this backend yet. Deploy the latest backend branch on Render and this screen will start loading real events."
          : "We could not load tournaments right now. Please try again in a moment.",
      );
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const pickBannerImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

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

  const createTournament = async () => {
    try {
      setSaving(true);
      await adminService.createTournament({
        title,
        shared_course_code: courseCode,
        scheduled_at: scheduledAt,
        registration_closes_at: registrationClosesAt || undefined,
        late_join_cutoff_at: lateJoinCutoffAt || undefined,
        check_in_opens_at: checkInOpensAt || undefined,
        check_in_closes_at: checkInClosesAt || undefined,
        prize_summary: prize,
        campaign_preheader: preheader || undefined,
        campaign_banner_url: bannerUrl || undefined,
        campaign_accent_color: accentColor || undefined,
        campaign_cta_label: ctaLabel || undefined,
        campaign_cta_url: ctaUrl || undefined,
        audience_scope: audienceScope,
        audience_university: audienceUniversity || undefined,
        audience_faculty: audienceFaculty || undefined,
        audience_department: audienceDepartment || undefined,
      });
      setTitle("");
      setCourseCode("");
      setScheduledAt("");
      setRegistrationClosesAt("");
      setLateJoinCutoffAt("");
      setCheckInOpensAt("");
      setCheckInClosesAt("");
      setPrize("");
      setPreheader("");
      setBannerUrl("");
      setBannerFileName("");
      setAccentColor("#16A34A");
      setCtaLabel("");
      setCtaUrl("");
      setAudienceScope("EVERYONE");
      setAudienceUniversity("");
      setAudienceFaculty("");
      setAudienceDepartment("");
      await loadTournaments();
    } catch (error: any) {
      Alert.alert("Unable to create tournament", error?.response?.data?.message || "Please check the form.");
    } finally {
      setSaving(false);
    }
  };

  const publishTournament = async (id: string) => {
    try {
      await adminService.publishTournament(id);
      await loadTournaments();
    } catch (error: any) {
      Alert.alert("Unable to publish", error?.response?.data?.message || "Please try again.");
    }
  };

  return (
    <Screen title="Tournaments" scrollable>
      <View style={styles.container}>
        <Card style={formCardStyle}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Create Tournament</Text>
          <Input label="Title" placeholder="National GST 101 Challenge" value={title} onChangeText={setTitle} />
          <Input label="Course Code" placeholder="GST 101" value={courseCode} onChangeText={setCourseCode} autoCapitalize="characters" />
          <Input label="Scheduled At (ISO)" placeholder="2026-06-30T14:00:00.000Z" value={scheduledAt} onChangeText={setScheduledAt} />
          <Input label="Registration Closes At" placeholder="2026-06-30T12:00:00.000Z" value={registrationClosesAt} onChangeText={setRegistrationClosesAt} />
          <Input label="Late Join Cutoff At" placeholder="2026-06-30T14:05:00.000Z" value={lateJoinCutoffAt} onChangeText={setLateJoinCutoffAt} />
          <Input label="Check-in Opens At" placeholder="2026-06-30T13:30:00.000Z" value={checkInOpensAt} onChangeText={setCheckInOpensAt} />
          <Input label="Check-in Closes At" placeholder="2026-06-30T13:55:00.000Z" value={checkInClosesAt} onChangeText={setCheckInClosesAt} />
          <Input label="Prize Summary" placeholder="N50,000 scholarship prize" value={prize} onChangeText={setPrize} />
          <Input label="Campaign Preheader" placeholder="A fast-paced national student showdown" value={preheader} onChangeText={setPreheader} />
          <View style={styles.bannerField}>
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
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  PNG, JPG, or WEBP. No pasted image links needed.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <Input label="Accent Color" placeholder="#16A34A" value={accentColor} onChangeText={setAccentColor} autoCapitalize="none" />
          <Input label="CTA Label" placeholder="Register for the showdown" value={ctaLabel} onChangeText={setCtaLabel} />
          <Input label="CTA URL" placeholder="https://..." value={ctaUrl} onChangeText={setCtaUrl} autoCapitalize="none" />
          <Input label="Audience Scope" placeholder="EVERYONE | UNIVERSITY | FACULTY | DEPARTMENT" value={audienceScope} onChangeText={(value) => setAudienceScope((value.toUpperCase() as any) || "EVERYONE")} autoCapitalize="characters" />
          {audienceScope !== "EVERYONE" ? (
            <Input
              label={audienceScope === "UNIVERSITY" ? "Audience University" : audienceScope === "FACULTY" ? "Audience Faculty" : "Audience Department"}
              placeholder={audienceScope === "UNIVERSITY" ? "University of Lagos" : audienceScope === "FACULTY" ? "Engineering" : "Computer Science"}
              value={audienceScope === "UNIVERSITY" ? audienceUniversity : audienceScope === "FACULTY" ? audienceFaculty : audienceDepartment}
              onChangeText={(value) => {
                if (audienceScope === "UNIVERSITY") setAudienceUniversity(value);
                if (audienceScope === "FACULTY") setAudienceFaculty(value);
                if (audienceScope === "DEPARTMENT") setAudienceDepartment(value);
              }}
            />
          ) : null}

          <View style={[styles.previewCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.previewHeader}>
              <Eye size={16} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Tournament Campaign Preview</Text>
            </View>
            <View style={[styles.previewAccent, { backgroundColor: accentColor || colors.primary }]} />
            <Text style={[typography.caption, { color: colors.textMuted }]}>{preheader || "Preheader text"}</Text>
            <Text style={[typography.h4, { color: colors.textPrimary }]}>{title || "Tournament title"}</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {prize || "Prize summary appears here"}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Audience: {audienceScope === "EVERYONE" ? "Everyone on Akademi" : audienceScope === "UNIVERSITY" ? audienceUniversity || "Selected university" : audienceScope === "FACULTY" ? audienceFaculty || "Selected faculty" : audienceDepartment || "Selected department"}
            </Text>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={[styles.previewBanner, { borderColor: colors.border }]} resizeMode="cover" />
            ) : (
              <Text style={[typography.caption, { color: colors.textMuted }]}>Banner image not uploaded yet</Text>
            )}
            <TouchableOpacity style={[styles.previewCta, { backgroundColor: accentColor || colors.primary }]}>
              <Text style={styles.previewCtaText}>{ctaLabel || "Campaign CTA"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={createTournament} disabled={saving}>
            <Plus size={16} color="#04110A" />
            <Text style={styles.primaryButtonText}>{saving ? "Creating..." : "Create Tournament"}</Text>
          </TouchableOpacity>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Existing Tournaments</Text>
        </View>
        {loadNotice ? (
          <Card
            style={{
              ...styles.noticeCard,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>Tournament feed unavailable</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {loadNotice}
            </Text>
          </Card>
        ) : null}
        <ScrollView contentContainerStyle={styles.list}>
          {tournaments.map((tournament) => (
            <Card
              key={tournament.id}
              style={{
                ...styles.itemCard,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View style={styles.itemTop}>
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700" }]}>{tournament.title}</Text>
                <Text style={[typography.caption, { color: colors.primary }]}>{tournament.status}</Text>
              </View>
              <View style={styles.metaRow}>
                <CalendarDays size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{new Date(tournament.scheduled_at).toLocaleString()}</Text>
              </View>
              <View style={styles.metaRow}>
                <Trophy size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{tournament.prize_summary || "No prize summary yet"}</Text>
              </View>
              <View style={styles.metaRow}>
                <Radio size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {tournament.entry_count} total | {tournament.checked_in_count || 0} checked in | {tournament.registered_count || 0} registered | {tournament.standby_count || 0} standby
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Eye size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {tournament.check_in_opens_at ? `Check-in: ${new Date(tournament.check_in_opens_at).toLocaleString()}` : "Check-in window not set"}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Eye size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Audience: {tournament.audience_scope === "EVERYONE" ? "Everyone on Akademi" : tournament.audience_scope === "UNIVERSITY" ? tournament.audience_university : tournament.audience_scope === "FACULTY" ? tournament.audience_faculty : tournament.audience_department}
                </Text>
              </View>
              {tournament.status === "DRAFT" ? (
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => publishTournament(tournament.id)}>
                  <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: "700" }]}>Publish Tournament</Text>
                </TouchableOpacity>
              ) : null}
            </Card>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Past Matches & Student Rooms</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Track private friend battles, tournament rooms, and completed live rounds from one place.
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {rooms.map((room) => (
            <Card
              key={room.id}
              style={{
                ...styles.itemCard,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View style={styles.itemTop}>
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: "700", flex: 1 }]}>{room.title}</Text>
                <Text style={[typography.caption, { color: colors.primary }]}>{room.status}</Text>
              </View>
              <View style={styles.metaRow}>
                <Radio size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Code {room.code} | {room.visibility} | {room.tournament ? "Tournament-backed" : "Student-created"}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Trophy size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Host: {room.host.name} | Winner: {room.winner_name || "Not decided yet"}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Eye size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {room.participant_count} participants | {room.ready_count} ready | {room.finished_count} finished
                </Text>
              </View>
              <View style={styles.metaRow}>
                <CalendarDays size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Created {new Date(room.created_at).toLocaleString()}
                  {room.ended_at ? ` | Ended ${new Date(room.ended_at).toLocaleString()}` : ""}
                </Text>
              </View>
              {room.shared_course_code ? (
                <View style={styles.metaRow}>
                  <Eye size={14} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Course: {room.shared_course_code}
                  </Text>
                </View>
              ) : null}
            </Card>
          ))}
        </ScrollView>
      </View>
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
    borderRadius: 16,
    padding: 16,
  },
  fieldLabel: {
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 9.75,
  },
  bannerField: {
    marginBottom: 20,
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
  primaryButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#04110A",
    fontWeight: "700",
    fontSize: 13,
  },
  sectionHeader: {
    marginTop: 8,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewAccent: {
    width: 48,
    height: 4,
    borderRadius: 999,
  },
  previewCta: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  previewBanner: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewCtaText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
});
