import { Server } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from './websocket.types';

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

export const setIO = (
  server: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
) => {
  io = server;
};

export const getIO = () => {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
};
