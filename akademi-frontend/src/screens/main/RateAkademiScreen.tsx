import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Button } from "../../components/ui/Button";
import { useNavigation } from "@react-navigation/native";
import { Star, Heart } from "lucide-react-native";
import * as StoreReview from "expo-store-review";

export const RateAkademiScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [rating, setRating] = useState(0);

  const handleRate = async () => {
    if (rating >= 4) {
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
      } else {
        Linking.openURL("https://play.google.com/store/apps/details?id=app.akademi");
      }
    } else {
      navigation.navigate("HelpSupport");
    }
  };

  return (
    <Screen style={{ flex: 1 }} title="Rate Akademi" onBack={() => navigation.goBack()}>
      <View style={styles.container}>
        <LinearGradient
          colors={["#0B1E12", "#04110A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.heartWrapper}>
            <Heart size={36} color={colors.primary} fill={colors.primary} />
          </View>

          <Text style={styles.title}>Enjoying Akademi?</Text>
          <Text style={styles.subtitle}>
            Your feedback helps us make Akademi better for every student in Nigeria.
          </Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => setRating(i)}>
                <Star
                  size={36}
                  color={i <= rating ? "#F59E0B" : colors.border}
                  fill={i <= rating ? "#F59E0B" : "transparent"}
                />
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <Text style={styles.ratingText}>
              {rating <= 3 ? "We'd love to hear how we can improve!" : "We're so glad Akademi is helping your studies! 🎉"}
            </Text>
          )}
        </LinearGradient>

        <View style={styles.footer}>
          <Button
            label="Submit Rating"
            disabled={rating === 0}
            onPress={handleRate}
            style={styles.button}
          />
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.maybeLater}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    paddingBottom: 32,
    justifyContent: "space-between",
  },
  card: {
    alignItems: "center",
    borderColor: "rgba(34,197,94,0.25)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    marginTop: 10,
  },
  heartWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderColor: "rgba(34,197,94,0.3)",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  stars: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
    marginBottom: 20,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter-SemiBold",
    color: colors.primary,
    textAlign: "center",
  },
  footer: {
    gap: 14,
    alignItems: "center",
  },
  button: {
    width: "100%",
  },
  maybeLater: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: "Inter-Medium",
  },
});
