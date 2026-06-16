import { getIO } from './websocket.state';

export function emitToUser(userId: string, event: string, payload: unknown) {
  try {
    getIO().to(`user:${userId}`).emit(event as any, payload as any);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`WebSocket emitter skipped for ${event}:`, (error as Error)?.message || error);
    }
  }
}
