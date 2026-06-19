import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/useAuthStore";
import { captureFrontendException } from "../lib/sentry";

const DEFAULT_API_URLS = [
  "https://akademi-app-1.onrender.com",
  "https://akademi-app.onrender.com",
];

const parseCandidateUrls = (...sources: Array<string | undefined>) => {
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const source of sources) {
    if (!source) continue;
    const parts = source
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    for (const part of parts) {
      if (seen.has(part)) continue;
      seen.add(part);
      candidates.push(part.replace(/\/+$/, ""));
    }
  }

  return candidates;
};

const API_CANDIDATE_URLS = parseCandidateUrls(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_API_FALLBACK_URLS,
  ...DEFAULT_API_URLS,
);

let currentApiBaseUrl = API_CANDIDATE_URLS[0] || DEFAULT_API_URLS[0];
let activeUrlProbe: Promise<string> | null = null;

const setCurrentApiBaseUrl = (nextUrl: string) => {
  currentApiBaseUrl = nextUrl.replace(/\/+$/, "");
  api.defaults.baseURL = currentApiBaseUrl;
};

const canTriggerFailover = (error: any) => {
  if (!error) return false;
  const status = error.response?.status;
  if (!status) return true;
  return status === 502 || status === 503 || status === 504;
};

const findHealthyApiBaseUrl = async () => {
  if (activeUrlProbe) return activeUrlProbe;

  activeUrlProbe = (async () => {
    for (const candidate of API_CANDIDATE_URLS) {
      try {
        const response = await axios.get(`${candidate}/health`, {
          timeout: 8000,
          validateStatus: () => true,
        });

        if (response.status < 500) {
          setCurrentApiBaseUrl(candidate);
          return candidate;
        }
      } catch {
        // keep checking the next backend candidate
      }
    }

    return currentApiBaseUrl;
  })();

  try {
    return await activeUrlProbe;
  } finally {
    activeUrlProbe = null;
  }
};

const api = axios.create({
  baseURL: currentApiBaseUrl,
  timeout: 30000,
});

// Request interceptor — attach token
api.interceptors.request.use(async (config) => {
  // Try to get token from AsyncStorage first
  let token = await AsyncStorage.getItem("accessToken");

  // If not in AsyncStorage, try to find it in the persisted auth-storage
  if (!token) {
    const authStorage = await AsyncStorage.getItem("auth-storage");
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        token = parsed.state?.accessToken;
      } catch (e) {
        console.error("Failed to parse auth-storage", e);
      }
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Logging failed requests for diagnostics
    console.error(`API Error [${originalRequest.method.toUpperCase()}] ${originalRequest.url}: `, {
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response?.status >= 500 || !error.response) {
      captureFrontendException(error, {
        request: {
          method: originalRequest?.method,
          url: originalRequest?.url,
        },
        responseStatus: error.response?.status,
      });
    }

    if (originalRequest && canTriggerFailover(error) && !originalRequest._baseRetry) {
      originalRequest._baseRetry = true;
      const healthyBaseUrl = await findHealthyApiBaseUrl();

      if (healthyBaseUrl && healthyBaseUrl !== originalRequest.baseURL) {
        originalRequest.baseURL = healthyBaseUrl;
        return api(originalRequest);
      }
    }

    if (error.response?.status === 401) {
        if (!originalRequest._retry) {
          originalRequest._retry = true;
          try {
            let refreshToken = await AsyncStorage.getItem("refreshToken");

            if (!refreshToken) {
              const authStorage = await AsyncStorage.getItem("auth-storage");
              if (authStorage) {
                const parsed = JSON.parse(authStorage);
                refreshToken = parsed.state?.refreshToken;
              }
            }

            if (!refreshToken) {
              useAuthStore.getState().clearAuth();
              return Promise.reject(error);
            }

            const { data } = await axios.post(`${currentApiBaseUrl}/auth/refresh`, {
              refreshToken,
            });

            await AsyncStorage.setItem("accessToken", data.accessToken);
            await AsyncStorage.setItem("refreshToken", data.refreshToken);

            // Update auth-storage too for consistency
            const authStorage = await AsyncStorage.getItem("auth-storage");
            if (authStorage) {
              const parsed = JSON.parse(authStorage);
              parsed.state.accessToken = data.accessToken;
              parsed.state.refreshToken = data.refreshToken;
              await AsyncStorage.setItem("auth-storage", JSON.stringify(parsed));
            }

            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            // Handle refresh token expiration (e.g., logout user)
            captureFrontendException(refreshError, {
              request: {
                method: "post",
                url: "/auth/refresh",
              },
            });
            useAuthStore.getState().clearAuth();
            return Promise.reject(refreshError);
          }
        } else {
            // If it's already a retry and we still get 401, logout
            useAuthStore.getState().clearAuth();
        }
    }
    return Promise.reject(error);
  },
);

export default api;
export { currentApiBaseUrl, findHealthyApiBaseUrl };
