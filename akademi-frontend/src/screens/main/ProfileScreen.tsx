import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Settings,
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
  Sparkles
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Avatar } from "../../components/ui/Avatar";
import { userService, UserProfile, FeatureAccess } from "../../services/user";
import { useAuthStore } from "../../store/useAuthStore";

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [featureAccess, setFeatureAccess] = useState<FeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const academicLabel = useMemo(() => {
    if (!profile) return "";
    return `${profile.level} LEVEL • ${profile.department?.toUpperCase()} • ${profile.university?.toUpperCase()}`;
  }, [profile]);

  const fetchData = async () => {
    try {
      const [profileData, accessData] = await Promise.all([
        userService.getProfile(),
        userService.getFeatureAccess(),
      ]);
      setProfile(profileData);
      setFeatureAccess(accessData);
    } catch (error) {
      console.error("Failed to fetch profile data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      // In a real app, upload the image here
      console.log("Selected image:", result.assets[0].uri);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of Akademi?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await userService.logout();
            } catch (e) {
              console.error("Logout error", e);
            } finally {
              clearAuth();
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. All your data will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final Confirmation",
              "Are you absolutely sure? This is your last chance to turn back.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Forever",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await userService.deleteAccount();
                      clearAuth();
                    } catch (e) {
                      Alert.alert("Error", "Failed to delete account. Please try again later.");
                    }
                  }
                }
              ]
            );
          }
        },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <Screen hideHeader style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }
  return (
    <Screen hideHeader scrollable style={{ flex: 1 }}>
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
              uri={profile?.avatar_url}
              size={80}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <Text style={styles.studentName}>{profile?.name}</Text>
          <Text style={styles.academicDetails}>{academicLabel}</Text>

          {featureAccess?.plan === "pro" ? (
            <LinearGradient
              colors={["#4338CA", "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.proPill}
            >
              <Sparkles size={14} color="#FFFFFF" style={styles.pillIcon} />
              <Text style={styles.proPillText}>Akademi Pro +</Text>
            </LinearGradient>
          ) : (
            <View style={styles.freePill}>
              <Text style={styles.freePillText}>Free Plan</Text>
            </View>
          )}

          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => navigation.navigate("Sessions")}
              activeOpacity={0.7}
            >
              <Clock size={16} color={colors.primary} />
              <Text style={styles.heroButtonText}>Sessions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => navigation.navigate("Progress")}
              activeOpacity={0.7}
            >
              <BarChart2 size={16} color={colors.primary} />
              <Text style={styles.heroButtonText}>Progress</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatTile value={profile?.stats?.assignments || 0} label="ASSIGNMENTS" />
          <StatTile value={profile?.stats?.sessions || 0} label="SESSIONS" />
          <StatTile value={profile?.stats?.uploads || 0} label="UPLOADS" />
        </View>

        {/* Menu Sections */}
        <MenuSection label="ACADEMIC">
          <MenuItem icon={<GraduationCap size={20} color={colors.primary} />} label="Edit Academic Details" onPress={() => {}} />
          <MenuItem icon={<FileText size={20} color={colors.primary} />} label="My Courses" onPress={() => {}} />
        </MenuSection>

        <MenuSection label="CONTENT">
          <MenuItem icon={<Cloud size={20} color={colors.primary} />} label="My Uploads" onPress={() => {}} />
          <MenuItem icon={<Clock size={20} color={colors.primary} />} label="Offline Downloads" onPress={() => {}} />
        </MenuSection>

        <MenuSection label="PREFERENCES">
          <MenuItem icon={<Bell size={20} color={colors.primary} />} label="Notifications" onPress={() => navigation.navigate("NotificationsSettings")} />
          <MenuItem icon={<Key size={20} color={colors.primary} />} label="Subscription" onPress={() => navigation.navigate("Subscription")} />
          <MenuItem icon={<Globe size={20} color={colors.primary} />} label="App Language" onPress={() => {}} />
          <MenuItem icon={<Palette size={20} color={colors.primary} />} label="Appearance" onPress={() => {}} />
        </MenuSection>

        <MenuSection label="ACCOUNT">
          <MenuItem icon={<Lock size={20} color={colors.primary} />} label="Change Password" onPress={() => {}} />
          <MenuItem icon={<Shield size={20} color={colors.primary} />} label="Privacy & Data" onPress={() => {}} />
          <MenuItem icon={<HelpCircle size={20} color={colors.primary} />} label="Help & Support" onPress={() => {}} />
          <MenuItem icon={<Star size={20} color={colors.primary} />} label="Rate Akademi" onPress={() => {}} />
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
    </Screen>
  );
};

const StatTile: React.FC<{ value: number | string; label: string }> = ({ value, label }) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const MenuSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={styles.menuSection}>
    <Text style={styles.sectionLabel}>{label}</Text>
    <View style={styles.menuGroup}>
      {children}
    </View>
  </View>
);

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  labelStyle?: any;
  hideChevron?: boolean;
}> = ({ icon, label, onPress, labelStyle, hideChevron }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.menuItemLeft}>
      <View style={styles.menuIconWrapper}>{icon}</View>
      <Text style={[styles.menuItemLabel, labelStyle]}>{label}</Text>
    </View>
    {!hideChevron && <ChevronRight size={20} color={colors.textMuted} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
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
    padding: 20,
    paddingBottom: 100,
  },
  heroSection: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  studentName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  academicDetails: {
    fontFamily: "SpaceMono-Regular",
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  proPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
  },
  pillIcon: {
    marginRight: 6,
  },
  proPillText: {
    color: "#FFFFFF",
    fontSize: 9.75,
    fontWeight: "700",
  },
  freePill: {
    backgroundColor: colors.surfaceElevated,
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
    marginBottom: 32,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
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
    borderRadius: 12,
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
    marginTop: 20,
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
});
