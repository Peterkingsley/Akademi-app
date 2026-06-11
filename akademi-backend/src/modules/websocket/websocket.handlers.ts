import { Socket, Server } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from './websocket.types';
import { SessionsService } from '../sessions/sessions.service';
import { streamAudio } from './websocket.audio';
import redisClient from '../../config/redis';
import { config } from '../../config/env';
import { SessionType } from '@prisma/client';

const sessionsService = new SessionsService();

const getClientSafeError = (error: any) => {
  const message = error?.message || '';
  console.error('WebSocket handler error:', error);

  if (
    message.includes('AI tutor is temporarily busy') ||
    message.includes('AI providers failed') ||
    message.includes('Gemini') ||
    message.includes('Claude') ||
    message.includes('GoogleGenerativeAI') ||
    message.includes('503') ||
    message.includes('Service Unavailable')
  ) {
    return 'AI tutor is temporarily busy. Please try again in a moment.';
  }

  return message || 'Something went wrong. Please try again.';
};

export const registerHandlers = (
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) => {
  const userId = socket.data.user.userId;

  socket.on('session:start', async ({ sessionId, courseCode, sessionType, replyMode }) => {
    try {
      if (sessionId) {
        const session = await sessionsService.getSession(sessionId);
        if (session.user_id !== userId) {
          throw new Error('Session not found');
        }

        socket.join(session.id);
        socket.emit('session:joined', { sessionId: session.id });
        await redisClient.del(`session:disconnected:${session.id}`);
        return;
      }

      const normalizedCourseCode = courseCode?.trim() || null;

      // Check for active session first for reconnection support
      const sessions = await sessionsService.listSessions(userId);
      // Handle optional course code when finding active session
      let session = sessions.find(s => !s.ended_at && (s.course_code || null) === normalizedCourseCode);

      if (!session) {
        session = await sessionsService.startSession(userId, {
          course_code: normalizedCourseCode,
          session_type: sessionType || SessionType.TUTOR,
          reply_mode: replyMode,
        });
      }

      socket.join(session.id);
      socket.emit('session:joined', { sessionId: session.id });

      // Clear any disconnection timer if re-starting or joining
      await redisClient.del(`session:disconnected:${session.id}`);
    } catch (error: any) {
      socket.emit('error', { message: getClientSafeError(error) });
    }
  });

  socket.on('message:send', async ({ content, sessionId }) => {
    try {
      socket.emit('message:typing');

      const aiMessage = await sessionsService.sendMessage(userId, sessionId, { content });

      socket.emit('message:receive', {
        content: aiMessage.content,
        messageId: aiMessage.id
      });

      if (config.enableLiveTutorAudio) {
        await streamAudio(socket, aiMessage.content);
      }
    } catch (error: any) {
      socket.emit('error', { message: getClientSafeError(error) });
    }
  });

  socket.on('session:pause', async ({ sessionId, position }) => {
    try {
      const pausePosition = typeof position === 'number' && Number.isFinite(position) ? position : 0;
      await redisClient.set(`session:pause_position:${sessionId}`, pausePosition.toString());
      socket.emit('audio:stop');
      socket.emit('session:paused', { position: pausePosition });
    } catch (error: any) {
      socket.emit('error', { message: getClientSafeError(error) });
    }
  });

  socket.on('session:resume', async ({ sessionId }) => {
    try {
      const position = await redisClient.get(`session:pause_position:${sessionId}`);
      const resumeFrom = position ? parseInt(position) : 0;
      socket.emit('session:resumed', { resumeFrom });
    } catch (error: any) {
      socket.emit('error', { message: getClientSafeError(error) });
    }
  });

  socket.on('session:end', async ({ sessionId }) => {
    try {
      await sessionsService.endSession(sessionId);
      const summary = await sessionsService.getSessionSummary(sessionId);
      socket.emit('session:summary', { summary });
      socket.emit('session:ended');
      socket.leave(sessionId);
    } catch (error: any) {
      socket.emit('error', { message: getClientSafeError(error) });
    }
  });

  socket.on('disconnect', async () => {
    try {
      const sessions = await sessionsService.listSessions(userId);
      const activeSession = sessions.find(s => !s.ended_at);

      if (activeSession) {
        await redisClient.set(`session:disconnected:${activeSession.id}`, '1', { EX: 600 });
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
};
