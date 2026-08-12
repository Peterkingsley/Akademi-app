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
    // Reuse an in-progress connection as well as a connected one. Several
    // screens mount together at startup; recreating the socket from each call
    // makes them disconnect one another and produces a connect-error storm.
    if (this.socket) {
      return this.socket;
    }

    const token = await this.getAccessToken();
    const healthyBaseUrl = await findHealthyApiBaseUrl();
    const socketUrl = healthyBaseUrl || SOCKET_URL;

    this.socket = io(socketUrl, {
      auth: { token },
      // Render's polling handshake is consistently available even when a
      // carrier/proxy blocks the direct WebSocket handshake. Socket.IO can
      // establish over polling and upgrade to WebSocket when supported.
      transports: ["polling", "websocket"],
      upgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
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
