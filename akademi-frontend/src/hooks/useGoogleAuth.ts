import { useState } from "react";
import { Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

import api from "../services/api";
import { useAuthStore } from "../store/useAuthStore";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (!webClientId && __DEV__) {
  console.warn("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — Google sign-in will fail.");
}

GoogleSignin.configure({ webClientId });

export const useGoogleAuth = () => {
  const navigation = useNavigation<any>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        // User dismissed the Google sheet — not an error, nothing to show.
        return;
      }

      const idToken = response.data.idToken;
      if (!idToken) {
        setError("Google didn't return a valid credential. Please try again.");
        return;
      }

      const apiResponse = await api.post("/auth/google", {
        googleToken: idToken,
        deviceInfo: {
          name: Platform.OS === "ios" ? "iPhone" : "Android Device",
          type: Platform.OS === "ios" ? "IOS" : "ANDROID",
        },
      });

      const { user, accessToken, refreshToken, adminAccessToken, needsOnboarding } = apiResponse.data;

      if (needsOnboarding) {
        // Account exists (freshly created or previously incomplete) but still
        // needs school/department/level. Hold off on setAuth() until that's
        // done so RootNavigator keeps showing the auth stack — see
        // CoursePickerScreen for where this pendingAuth is consumed.
        navigation.navigate("UniversityPicker", {
          pendingAuth: { user, accessToken, refreshToken, adminAccessToken },
        });
        return;
      }

      setAuth(user, accessToken, refreshToken, adminAccessToken);
    } catch (err: any) {
      console.error("Google Sign-In Error Details:", err);
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setError("Google Play Services isn't available on this device.");
        } else if (err.code === statusCodes.IN_PROGRESS) {
          // Already mid-flow from a previous tap — stay quiet.
        } else if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          // User closed the Google account picker sheet.
        } else {
          setError(`Google sign-in error (${err.code}): ${err.message || 'Check Web Client ID and SHA-1 in Google Cloud'}`);
        }
      } else if (!err.response) {
        setError("Check your internet connection and try again.");
      } else {
        setError(err.response?.data?.message || err.message || "Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return { signInWithGoogle, loading, error };
};
