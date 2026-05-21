import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image } from "react-native";
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
        <View style={styles.content}>
          <View style={styles.heartWrapper}>
            <Heart size={48} color={colors.primary} fill={colors.primary} />
          </View>

          <Text style={styles.title}>Enjoying Akademi?</Text>
          <Text style={styles.subtitle}>
            Your feedback helps us make Akademi better for every student in Nigeria.
          </Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity key={i} onPress={() => setRating(i)}>
                <Star
                  size={40}
                  color={i <= rating ? "#F59E0B" : colors.border}
                  fill={i <= rating ? "#F59E0B" : "transparent"}
                />
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <Text style={styles.ratingText}>
              {rating <= 3 ? "We'd love to hear how we can improve." : "We're so glad you like it!"}
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Button
            label="Submit Feedback"
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
    padding: 24,
    justifyContent: "space-between",
  },
  content: {
    alignItems: "center",
    paddingTop: 40,
  },
  heartWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  stars: {
    flexDirection: "row",
    gap: 12,
    marginTop: 40,
    marginBottom: 24,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: colors.primary,
  },
  footer: {
    gap: 16,
    alignItems: "center",
  },
  button: {
    width: "100%",
  },
  maybeLater: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: "Inter-Medium",
  },
});
