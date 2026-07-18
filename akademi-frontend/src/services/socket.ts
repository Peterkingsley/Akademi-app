import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../store/useAuthStore";
import { currentApiBaseUrl, findHealthyApiBaseUrl } from "./api";
import { readAccessToken } from "./tokenStorage";

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  process.env.EXPO_PUBLIC_WEBSOCKET_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  currentApiBaseUrl;

class SocketService {
  private socket: Socket | null = null;
  private async getAccessToken() {
    const storeToken = useAuthStore.getState().accessToken;
    if (storeToken) return storeToken;

    return readAccessToken();
  }

  async connect() {
    if (this.socket?.connected) return this.socket;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const token = await this.getAccessToken();
    const healthyBaseUrl = await findHealthyApiBaseUrl();
    const socketUrl = healthyBaseUrl || SOCKET_URL;

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
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
      console.warn("WebSocket connection error:", error.message);
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
