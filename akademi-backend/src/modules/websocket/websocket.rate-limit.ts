import { Socket } from 'socket.io';
import redisClient from '../../config/redis';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './websocket.types';

type SocketRateLimitOptions = {
  event: keyof ClientToServerEvents;
  max: number;
  windowSeconds: number;
};

const sanitizeIdentifier = (value: string) => value.replace(/[^a-zA-Z0-9:._-]/g, '_');

const getSocketIdentifier = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
) => {
  const userId = socket.data.user?.userId;
  const fallback = socket.handshake.address || socket.id || 'unknown-socket';
  return sanitizeIdentifier(userId || fallback);
};

export const checkSocketRateLimit = async (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  { event, max, windowSeconds }: SocketRateLimitOptions,
) => {
  const identifier = getSocketIdentifier(socket);
  const key = `socket-rate-limit:${String(event)}:${identifier}`;
  const count = await redisClient.incr(key);

  if (count === 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (count === 1) {
    await redisClient.expire(key, windowSeconds);
  }

  const ttl = await redisClient.ttl(key);
  const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;

  if (count > max) {
    console.warn('Socket rate limit exceeded', {
      event,
      userId: socket.data.user?.userId ?? null,
      socketId: socket.id,
      ip: socket.handshake.address,
      retryAfterSeconds,
    });
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
};
