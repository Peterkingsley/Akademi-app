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

export const initWebSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // Adjust based on requirements
      methods: ['GET', 'POST'],
    },
  });
  setIO(io);

  // Redis Adapter Setup
  if (config.nodeEnv !== 'test' && config.enableRedis) {
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
    socket.join(`user:${socket.data.user.userId}`);
    registerHandlers(io, socket);
  });

  return io;
};

export { getIO };
