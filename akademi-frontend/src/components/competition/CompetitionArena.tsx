import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swords } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";

type ArenaHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const ArenaHeader: React.FC<ArenaHeaderProps> = ({
  eyebrow = "AKADEMI ARENA",
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  const { colors, typeScale, radius, controlSize } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: colors.bg.surface, borderColor: colors.borderRoles.subtle, borderRadius: radius.xl }]}>
      <View style={[styles.heroGlow, { backgroundColor: colors.brand.subtle }]} />
      <View style={styles.eyebrowRow}>
        <View style={[styles.iconBox, { backgroundColor: colors.brand.subtle, borderColor: colors.brand.border }]}>
          <Swords size={18} color={colors.brand.foreground} />
        </View>
        <Text style={[typeScale.caption, styles.eyebrow, { color: colors.brand.foreground }]}>{eyebrow}</Text>
      </View>
      <Text style={[typeScale.h1, { color: colors.fg.primary }]}>{title}</Text>
      <Text style={[typeScale.secondary, styles.subtitle, { color: colors.fg.secondary }]}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { minHeight: controlSize.minTouch, borderRadius: radius.md, backgroundColor: pressed ? colors.brand.fillPressed : colors.brand.fill },
          ]}
        >
          <Text style={[typeScale.label, { color: colors.brand.onFill }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

type ArenaSectionTitleProps = { title: string; subtitle?: string; right?: React.ReactNode };

export const ArenaSectionTitle: React.FC<ArenaSectionTitleProps> = ({ title, subtitle, right }) => {
  const { colors, typeScale } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text style={[typeScale.h3, { color: colors.fg.primary }]}>{title}</Text>
        {subtitle ? <Text style={[typeScale.secondary, { color: colors.fg.secondary }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
};

type ArenaStatProps = { label: string; value: string | number; icon?: React.ReactNode };

export const ArenaStat: React.FC<ArenaStatProps> = ({ label, value, icon }) => {
  const { colors, typeScale, radius } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.bg.surfaceRaised, borderColor: colors.borderRoles.subtle, borderRadius: radius.md }]}>
      {icon}
      <Text style={[typeScale.title, { color: colors.fg.primary }]}>{value}</Text>
      <Text style={[typeScale.caption, { color: colors.fg.muted }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { position: "relative", overflow: "hidden", borderWidth: 1, padding: 20, gap: 8 },
  heroGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90, right: -76, top: -92, opacity: 0.75 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  iconBox: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontWeight: "700", letterSpacing: 0.8 },
  subtitle: { maxWidth: 520 },
  action: { alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 18, marginTop: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  sectionCopy: { flex: 1, gap: 2 },
  stat: { flex: 1, minHeight: 96, padding: 12, borderWidth: 1, justifyContent: "center", gap: 3 },
});
