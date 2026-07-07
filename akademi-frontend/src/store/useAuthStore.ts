import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearTokens, readStoredTokens, saveTokens } from "../services/tokenStorage";

interface User {
  id: string;
  email: string;
  name: string;
  university?: string;
  faculty?: string;
  department?: string;
  level?: number;
  courses?: string[];
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  onboarding_complete?: boolean;
  admin_role?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  adminAccessToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string, adminAccessToken?: string | null) => void;
  updateTokens: (accessToken: string, refreshToken: string, adminAccessToken?: string | null) => void;
  updateUser: (user: Partial<User>) => void;
  clearAuth: () => void;
  setHasHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      adminAccessToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      setAuth: (user, accessToken, refreshToken, adminAccessToken = null) => {
        void saveTokens(accessToken, refreshToken, adminAccessToken).catch((error) => {
          console.error("Failed to save auth tokens securely", error);
        });
        set({ user, accessToken, refreshToken, adminAccessToken, isAuthenticated: true });
      },
      updateTokens: (accessToken, refreshToken, adminAccessToken = null) => {
        void saveTokens(accessToken, refreshToken, adminAccessToken).catch((error) => {
          console.error("Failed to rotate auth tokens securely", error);
        });
        set({ accessToken, refreshToken, adminAccessToken, isAuthenticated: true });
      },
      updateUser: (updatedUser) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedUser } : null,
        }));
      },
      clearAuth: () => {
        void clearTokens().catch((error) => {
          console.error("Failed to clear secure auth tokens", error);
        });
        AsyncStorage.removeItem("auth-storage");
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          adminAccessToken: null,
          isAuthenticated: false,
        });
      },
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => async (state) => {
        const { accessToken, refreshToken, adminAccessToken } = await readStoredTokens();
        useAuthStore.setState({
          accessToken,
          refreshToken,
          adminAccessToken,
          isAuthenticated: Boolean(state?.user && accessToken && refreshToken),
          hasHydrated: true,
        });
      },
    },
  ),
);
