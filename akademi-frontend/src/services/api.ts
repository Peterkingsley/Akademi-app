import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";
import { captureFrontendException } from "../lib/sentry";
import { readAccessToken, readAdminAccessToken, readRefreshToken, saveTokens } from "./tokenStorage";

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
let activeRefreshRequest: Promise<{ accessToken: string; refreshToken: string; adminAccessToken?: string | null }> | null = null;

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

const isAdminApiRequest = (url?: string) => {
  if (!url) return false;
  return url.startsWith("/admin") || url.includes("/admin/");
};

const readStoredRefreshToken = async () => {
  return readRefreshToken();
};

const persistRotatedTokens = async (accessToken: string, refreshToken: string, adminAccessToken?: string | null) => {
  await saveTokens(accessToken, refreshToken, adminAccessToken);
  useAuthStore.getState().updateTokens(accessToken, refreshToken, adminAccessToken);
};

const refreshAccessToken = async () => {
  if (activeRefreshRequest) {
    return activeRefreshRequest;
  }

  activeRefreshRequest = (async () => {
    const refreshToken = await readStoredRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token stored");
    }

    const { data } = await axios.post(`${currentApiBaseUrl}/auth/refresh`, {
      refreshToken,
    });

    await persistRotatedTokens(data.accessToken, data.refreshToken, data.adminAccessToken);
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      adminAccessToken: data.adminAccessToken,
    };
  })();

  try {
    return await activeRefreshRequest;
  } finally {
    activeRefreshRequest = null;
  }
};

// Request interceptor — attach token
api.interceptors.request.use(async (config) => {
  const isAdminRequest = isAdminApiRequest(String(config.url || ""));
  let token = isAdminRequest ? await readAdminAccessToken() : await readAccessToken();

  if (isAdminRequest && !token) {
    try {
      const refreshed = await refreshAccessToken();
      token = refreshed.adminAccessToken || null;
    } catch {
      // Let the admin request fail as admin-only unauthorized; do not clear user auth here.
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
    const isAdminRequest = isAdminApiRequest(String(originalRequest?.url || ""));

    // Log expected client/API failures as warnings to avoid dev-screen noise for handled cases.
    const logPayload = {
      status: error.response?.status,
      data: error.response?.data
    };
    if (error.response?.status === 429 || (error.response?.status && error.response.status < 500)) {
      console.warn(`API Error [${originalRequest.method.toUpperCase()}] ${originalRequest.url}: `, logPayload);
    } else {
      console.error(`API Error [${originalRequest.method.toUpperCase()}] ${originalRequest.url}: `, logPayload);
    }

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

    if (error.response?.status === 401 && isAdminRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
        if (!originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const { accessToken } = await refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
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
export { currentApiBaseUrl, findHealthyApiBaseUrl, refreshAccessToken };
