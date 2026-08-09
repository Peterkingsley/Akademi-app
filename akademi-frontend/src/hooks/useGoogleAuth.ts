import { useState } from "react";
import { Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";

import api from "../services/api";
import { useAuthStore } from "../store/useAuthStore";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let googleSigninModule: typeof import("@react-native-google-signin/google-signin") | null = null;
let isConfigured = false;

const getGoogleSigninModule = () => {
  if (googleSigninModule) return googleSigninModule;
  try {
    googleSigninModule = require("@react-native-google-signin/google-signin");
    return googleSigninModule;
  } catch (err) {
    console.warn("Failed to load @react-native-google-signin/google-signin module:", err);
    return null;
  }
};

const ensureGoogleSigninConfigured = () => {
  if (isConfigured) return;
  if (!webClientId && __DEV__) {
    console.warn("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — Google sign-in will fail.");
  }
  const mod = getGoogleSigninModule();
  if (!mod || !mod.GoogleSignin) {
    throw new Error("RNGoogleSignin TurboModule missing");
  }
  mod.GoogleSignin.configure({ webClientId });
  isConfigured = true;
};

export const useGoogleAuth = () => {
  const navigation = useNavigation<any>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError("Google Sign-In is temporarily paused. Please sign in with email and password.");
  };

  return { signInWithGoogle, loading, error };
};
