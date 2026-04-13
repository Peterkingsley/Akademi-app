import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://akademi-app.onrender.com";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
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

    if (error.response?.status === 401 && !originalRequest._retry) {
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
          return Promise.reject(error);
        }

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
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
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
