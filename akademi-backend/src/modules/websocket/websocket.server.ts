import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import redisClient from '../../config/redis';
import { config } from '../../config/env';
import { JwtPayload } from '../auth/auth.types';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from './websocket.types';
import { registerHandlers } from './websocket.handlers';

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const initWebSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust based on requirements
      methods: ['GET', 'POST'],
    },
  });

  // Redis Adapter Setup
  if (config.nodeEnv !== 'test') {
      const pubClient = redisClient;
      const subClient = pubClient.duplicate();
      subClient.connect().then(() => {
        io.adapter(createAdapter(pubClient, subClient));
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
    console.log(`User connected: ${socket.data.user?.userId}`);
    registerHandlers(io, socket);
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
};
