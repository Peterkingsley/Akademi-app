import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  process.env.EXPO_PUBLIC_WEBSOCKET_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://akademi-app.onrender.com";

class SocketService {
  private socket: Socket | null = null;

  async connect() {
    if (this.socket?.connected) return this.socket;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const token = await AsyncStorage.getItem("accessToken");

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
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
