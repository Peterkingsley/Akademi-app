import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import redisClient from '../../config/redis';
import { config } from '../../config/env';
import { JwtPayload } from '../auth/auth.types';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from './websocket.types';
import { registerHandlers } from './websocket.handlers';
import { getIO, setIO } from './websocket.state';

let activeConnections = 0;
let websocketInitialized = false;

export const initWebSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // Adjust based on requirements
      methods: ['GET', 'POST'],
    },
  });
  setIO(io);
  websocketInitialized = true;

  // Redis Adapter Setup
  if (config.nodeEnv !== 'test' && config.enableRedis && config.enableWebSocketRedisAdapter) {
      const pubClient = redisClient;
      const subClient = pubClient.duplicate();
      subClient.connect()
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          console.log('WebSocket Redis adapter enabled');
        })
        .catch((error) => {
          console.error('Failed to enable WebSocket Redis adapter:', error);
        });
  }

  // Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    activeConnections += 1;
    console.log(`User connected: ${socket.data.user?.userId}`);
    socket.join(`user:${socket.data.user.userId}`);
    registerHandlers(io, socket);
    socket.on('disconnect', () => {
      activeConnections = Math.max(0, activeConnections - 1);
    });
  });

  return io;
};

export const getWebSocketHealth = () => ({
  enabled: websocketInitialized,
  activeConnections,
});

export const shutdownWebSocket = async () => {
  if (!websocketInitialized) {
    return;
  }

  try {
    const io = getIO();
    await io.close();
  } finally {
    websocketInitialized = false;
    activeConnections = 0;
  }
};

export { getIO };
