import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "akademi.accessToken";
const REFRESH_TOKEN_KEY = "akademi.refreshToken";
const LEGACY_ACCESS_TOKEN_KEY = "accessToken";
const LEGACY_REFRESH_TOKEN_KEY = "refreshToken";
const AUTH_STORAGE_KEY = "auth-storage";

let secureStoreAvailable: Promise<boolean> | null = null;

const canUseSecureStore = () => {
  if (!secureStoreAvailable) {
    secureStoreAvailable = SecureStore.isAvailableAsync().catch(() => false);
  }
  return secureStoreAvailable;
};

const stripTokensFromAuthStorage = async () => {
  const persisted = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!persisted) return;

  try {
    const parsed = JSON.parse(persisted);
    if (parsed?.state) {
      delete parsed.state.accessToken;
      delete parsed.state.refreshToken;
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  }
};

const migrateLegacyToken = async (legacyKey: string, secureKey: string) => {
  const legacyValue = await AsyncStorage.getItem(legacyKey);
  if (!legacyValue) return null;

  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(secureKey, legacyValue);
  }
  await AsyncStorage.removeItem(legacyKey);
  return legacyValue;
};

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  if (!(await canUseSecureStore())) {
    throw new Error("Secure token storage is not available on this device.");
  }

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  await AsyncStorage.multiRemove([LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
  await stripTokensFromAuthStorage();
};

export const readAccessToken = async () => {
  if (await canUseSecureStore()) {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (token) return token;
  }

  return migrateLegacyToken(LEGACY_ACCESS_TOKEN_KEY, ACCESS_TOKEN_KEY);
};

export const readRefreshToken = async () => {
  if (await canUseSecureStore()) {
    const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (token) return token;
  }

  return migrateLegacyToken(LEGACY_REFRESH_TOKEN_KEY, REFRESH_TOKEN_KEY);
};

export const readStoredTokens = async () => {
  const [accessToken, refreshToken] = await Promise.all([
    readAccessToken(),
    readRefreshToken(),
  ]);
  await stripTokensFromAuthStorage();
  return { accessToken, refreshToken };
};

export const clearTokens = async () => {
  if (await canUseSecureStore()) {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  }

  await AsyncStorage.multiRemove([LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
  await stripTokensFromAuthStorage();
};
