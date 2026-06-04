import { Socket, Server } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from './websocket.types';
import { SessionsService } from '../sessions/sessions.service';
import { streamAudio } from './websocket.audio';
import redisClient from '../../config/redis';
import { SessionType } from '@prisma/client';

const sessionsService = new SessionsService();

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

      if (!courseCode) {
        throw new Error('courseCode is required to start a tutor session');
      }

      // Check for active session first for reconnection support
      const sessions = await sessionsService.listSessions(userId);
      // Handle optional course code when finding active session
      let session = sessions.find(s => !s.ended_at && s.course_code === courseCode);

      if (!session) {
        session = await sessionsService.startSession(userId, {
          course_code: courseCode,
          session_type: sessionType || SessionType.TUTOR,
          reply_mode: replyMode,
        });
      }

      socket.join(session.id);
      socket.emit('session:joined', { sessionId: session.id });

      // Clear any disconnection timer if re-starting or joining
      await redisClient.del(`session:disconnected:${session.id}`);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
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

      // Stream audio
      await streamAudio(socket, aiMessage.content);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('session:pause', async ({ sessionId, position }) => {
    try {
      await redisClient.set(`session:pause_position:${sessionId}`, position.toString());
      socket.emit('audio:stop');
      socket.emit('session:paused', { position });
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('session:resume', async ({ sessionId }) => {
    try {
      const position = await redisClient.get(`session:pause_position:${sessionId}`);
      const resumeFrom = position ? parseInt(position) : 0;
      socket.emit('session:resumed', { resumeFrom });
    } catch (error: any) {
      socket.emit('error', { message: error.message });
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
      socket.emit('error', { message: error.message });
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
