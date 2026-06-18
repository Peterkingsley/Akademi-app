import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from "react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/ui/Avatar";
import {
  ChevronRight,
  GraduationCap,
  FileText,
  Cloud,
  Clock,
  Bell,
  Key,
  Globe,
  Palette,
  Lock,
  Shield,
  HelpCircle,
  Star,
  LogOut,
  Trash2,
  Sparkles,
  BarChart2,
  ShieldCheck,
} from "lucide-react-native";
import { useAuthStore } from "../../store/useAuthStore";
import { useNavigation } from "@react-navigation/native";
import { ProgressSummary, userService } from "../../services/user";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../theme/ThemeContext";

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { clearAuth, user, updateUser } = useAuthStore();
  const [profile, setProfile] = useState<any>(user);
  const [loading, setLoading] = useState(!user);
  const [refreshing, setRefreshing] = useState(false);
  const [featureAccess, setFeatureAccess] = useState<any>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState<"logout" | "delete" | null>(null);

  const fetchProfile = async () => {
    try {
      setError(null);
      const [data, access, progressData] = await Promise.all([
        userService.getProfile(),
        userService.getFeatureAccess(),
        userService.getProgress(),
      ]);
      setProfile(data);
      updateUser(data);
      setFeatureAccess(access);
      setProgress(progressData);
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError("Could not refresh profile data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      try {
        setLoading(true);
        const updated = await userService.updateAvatar(result.assets[0].uri);
        const avatarUrl = updated.avatar_url || updated.profile_photo_url || (updated as any).photoUrl;
        setProfile((prev: any) => ({ ...prev, avatar_url: avatarUrl, profile_photo_url: avatarUrl }));
        updateUser({ avatar_url: avatarUrl, profile_photo_url: avatarUrl });
      } catch (error) {
        Alert.alert("Error", "Failed to update avatar");
      } finally {
        setLoading(false);
      }
    }
  };

  const academicLabel = profile
    ? [profile.university, profile.department, profile.level ? `Level ${profile.level}` : null]
        .filter(Boolean)
        .join(" / ")
    : "";
  const avatarUrl = profile?.avatar_url || profile?.profile_photo_url;
  const planName = Array.isArray(featureAccess) && featureAccess.some((item: any) => item?.payment_ref && item.payment_ref !== "BYPASS")
    ? "Active Pass"
    : "Free Beta";

  const handleLogout = () => {
    setIsLogoutModalVisible(true);
  };

  const handleDeleteAccount = () => {
    setIsDeleteModalVisible(true);
  };

  const confirmLogout = async () => {
    try {
      setIsSubmittingAction("logout");
      await userService.logout();
      clearAuth();
    } catch (error) {
      clearAuth();
    } finally {
      setIsSubmittingAction(null);
      setIsLogoutModalVisible(false);
    }
  };

  const confirmDeleteAccount = async () => {
    try {
      setIsSubmittingAction("delete");
      await userService.deleteAccount();
      clearAuth();
    } catch (error) {
      setIsSubmittingAction(null);
      setIsDeleteModalVisible(false);
      Alert.alert("Error", "Failed to delete account");
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Screen
      title="Profile"
      hideHeader
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Profile Hero */}
        <View style={styles.heroSection}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
            <Avatar
              name={profile?.name || "User"}
              uri={avatarUrl}
              size={72}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <Text style={styles.studentName}>{profile?.name}</Text>
          <Text style={styles.academicDetails}>{academicLabel}</Text>

          <View style={styles.freePill}>
            <Sparkles size={13} color={colors.primary} style={styles.pillIcon} />
            <Text style={styles.freePillText}>{planName}</Text>
          </View>

          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => navigation.navigate("Sessions", { screen: "SessionsMain" })}
              activeOpacity={0.7}
            >
              <Clock size={16} color={colors.primary} />
              <Text style={styles.heroButtonText}>Sessions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => navigation.navigate("Sessions", { screen: "Progress" })}
              activeOpacity={0.7}
            >
              <BarChart2 size={16} color={colors.primary} />
              <Text style={styles.heroButtonText}>Progress</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={onRefresh} activeOpacity={0.8}>
            <Text style={styles.errorBannerText}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <StatTile value={progress?.summary.solved || 0} label="SOLVED" />
          <StatTile value={progress?.summary.sessions || 0} label="SESSIONS" />
          <StatTile value={progress?.summary.uploads || 0} label="UPLOADS" />
        </View>

        {/* Menu Sections */}
        {user?.admin_role && (
          <MenuSection label="ADMINISTRATION">
            <MenuItem
              icon={<ShieldCheck size={20} color={colors.primary} />}
              label="Admin Panel"
              onPress={() => navigation.navigate("Admin")}
            />
          </MenuSection>
        )}
        <MenuSection label="ACADEMIC">
          <MenuItem
            icon={<GraduationCap size={20} color={colors.primary} />}
            label="Edit Academic Details"
            onPress={() => navigation.navigate("EditAcademicDetails")}
          />
          <MenuItem
            icon={<FileText size={20} color={colors.primary} />}
            label="My Courses"
            onPress={() => navigation.navigate("MyCourses")}
          />
        </MenuSection>

        <MenuSection label="CONTENT">
          <MenuItem
            icon={<Cloud size={20} color={colors.primary} />}
            label="My Uploads"
            onPress={() => navigation.navigate("MyUploads")}
          />
          <MenuItem
            icon={<Clock size={20} color={colors.primary} />}
            label="Offline Downloads"
            onPress={() => navigation.navigate("OfflineDownloads")}
          />
        </MenuSection>

        <MenuSection label="PREFERENCES">
          <MenuItem
            icon={<Bell size={20} color={colors.primary} />}
            label="Notifications"
            onPress={() => navigation.navigate("NotificationsSettings")}
          />
          <MenuItem
            icon={<Key size={20} color={colors.primary} />}
            label="Subscription"
            onPress={() => navigation.navigate("Subscription")}
          />
          <MenuItem
            icon={<Globe size={20} color={colors.primary} />}
            label="App Language"
            onPress={() => navigation.navigate("AppLanguage")}
          />
          <MenuItem
            icon={<Palette size={20} color={colors.primary} />}
            label="Appearance"
            onPress={() => navigation.navigate("AppearanceSettings")}
          />
        </MenuSection>

        <SectionDivider />

        <MenuSection label="ACCOUNT">
          <MenuItem
            icon={<Lock size={20} color={colors.primary} />}
            label="Change Password"
            onPress={() => navigation.navigate("ChangePassword")}
          />
          <MenuItem
            icon={<Shield size={20} color={colors.primary} />}
            label="Privacy & Data"
            onPress={() => navigation.navigate("PrivacyData")}
          />
          <MenuItem
            icon={<HelpCircle size={20} color={colors.primary} />}
            label="Help & Support"
            onPress={() => navigation.navigate("HelpSupport")}
          />
          <MenuItem
            icon={<Star size={20} color={colors.primary} />}
            label="Rate Akademi"
            onPress={() => navigation.navigate("RateAkademi")}
          />
          <MenuItem
            icon={<LogOut size={20} color={colors.error} />}
            label="Log Out"
            labelStyle={{ color: colors.error }}
            onPress={handleLogout}
          />
          <MenuItem
            icon={<Trash2 size={16} color={colors.error} />}
            label="Delete Account"
            labelStyle={{ color: colors.error, fontSize: 9.75 }}
            onPress={handleDeleteAccount}
            hideChevron
          />
        </MenuSection>
      </ScrollView>

      <ConfirmationModal
        visible={isLogoutModalVisible}
        title="Log out"
        body="Are you sure you want to log out of Akademi on this device?"
        confirmLabel={isSubmittingAction === "logout" ? "Logging out..." : "Log out"}
        onCancel={() => isSubmittingAction !== "logout" && setIsLogoutModalVisible(false)}
        onConfirm={confirmLogout}
        destructive
        loading={isSubmittingAction === "logout"}
      />

      <ConfirmationModal
        visible={isDeleteModalVisible}
        title="Delete account"
        body="This action is permanent and cannot be undone. All your data will be deleted."
        confirmLabel={isSubmittingAction === "delete" ? "Deleting..." : "Delete account"}
        onCancel={() => isSubmittingAction !== "delete" && setIsDeleteModalVisible(false)}
        onConfirm={confirmDeleteAccount}
        destructive
        loading={isSubmittingAction === "delete"}
      />
    </Screen>
  );
};

const StatTile: React.FC<{ value: number | string; label: string }> = ({ value, label }) => (
  <ThemedStatTile value={value} label={label} />
);

const ThemedStatTile: React.FC<{ value: number | string; label: string }> = ({ value, label }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

const MenuSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.menuSection}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.menuGroup}>
        {children}
      </View>
    </View>
  );
};

const SectionDivider: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8, marginHorizontal: 20 }} />
  );
};

const ConfirmationModal: React.FC<{
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
}> = ({ visible, title, body, confirmLabel, onCancel, onConfirm, destructive = false, loading = false }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmOverlay}>
        <TouchableOpacity style={styles.confirmScrim} activeOpacity={1} onPress={onCancel} />
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmBody}>{body}</Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.confirmSecondaryButton}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.confirmSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.confirmPrimaryButton,
                destructive && styles.confirmDestructiveButton,
                loading && styles.confirmButtonDisabled,
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              <Text
                style={[
                  styles.confirmPrimaryText,
                  destructive && styles.confirmDestructiveText,
                ]}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  labelStyle?: any;
  hideChevron?: boolean;
}> = ({ icon, label, onPress, labelStyle, hideChevron }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuItemLeft}>
        <View style={styles.menuIconWrapper}>{icon}</View>
        <Text style={[styles.menuItemLabel, labelStyle]}>{label}</Text>
      </View>
      {!hideChevron && <ChevronRight size={20} color={colors.textMuted} />}
    </TouchableOpacity>
  );
};

const createStyles = (colors: typeof import("../../theme/colors").darkPalette) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  headerLeft: {
    marginLeft: 0,
  },
  headerAvatar: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsIcon: {
    padding: 4,
  },
  container: {
    padding: 18,
    paddingBottom: 100,
  },
  heroSection: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    marginBottom: 13,
    borderWidth: 2,
    borderColor: colors.border,
  },
  studentName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  academicDetails: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    maxWidth: "86%",
    textAlign: "center",
    marginBottom: 13,
  },
  pillIcon: {
    marginRight: 6,
  },
  freePill: {
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
  },
  freePillText: {
    color: colors.textSecondary,
    fontSize: 9.75,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  errorBanner: {
    backgroundColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.28)",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: colors.warning,
    fontSize: 11,
    lineHeight: 16,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  statValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 7.5,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "center",
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: "SpaceMono-Regular",
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIconWrapper: {
    width: 32,
    alignItems: "flex-start",
  },
  menuItemLabel: {
    fontSize: 11.25,
    color: colors.textPrimary,
    fontFamily: "Inter-Medium",
  },
  heroButtons: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroButtonText: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: colors.textPrimary,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  confirmScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.64)",
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    zIndex: 1,
  },
  confirmTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 10,
  },
  confirmBody: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
  },
  confirmSecondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmSecondaryText: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  confirmPrimaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  confirmPrimaryText: {
    ...typography.h4,
    color: colors.background,
  },
  confirmDestructiveButton: {
    backgroundColor: "rgba(239,68,68,0.16)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.28)",
  },
  confirmDestructiveText: {
    color: colors.error,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
});
