import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/useAuthStore";

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  process.env.EXPO_PUBLIC_WEBSOCKET_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://akademi-app.onrender.com";

class SocketService {
  private socket: Socket | null = null;
  private async getAccessToken() {
    const storeToken = useAuthStore.getState().accessToken;
    if (storeToken) return storeToken;

    const directToken = await AsyncStorage.getItem("accessToken");
    if (directToken) return directToken;

    const authStorage = await AsyncStorage.getItem("auth-storage");
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.accessToken || null;
      } catch (error) {
        console.warn("Failed to parse auth-storage for socket token:", error);
      }
    }

    return null;
  }

  async connect() {
    if (this.socket?.connected) return this.socket;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const token = await this.getAccessToken();

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true,
    });

    this.socket.on("connect", () => {
      console.log("Connected to WebSocket");
    });

    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
    });

    return this.socket;
  }

  getSocket() {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data?: any) {
    this.socket?.emit(event, data);
  }

  on(event: string, callback: (data: any) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (data: any) => void) {
    this.socket?.off(event, callback);
  }
}

export const socketService = new SocketService();
