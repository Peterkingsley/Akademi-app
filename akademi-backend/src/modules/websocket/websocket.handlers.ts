import { Socket, Server } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from './websocket.types';
import { SessionsService } from '../sessions/sessions.service';
import { streamAudio } from './websocket.audio';
import redisClient from '../../config/redis';
import { config } from '../../config/env';
import { CompetitionParticipantStatus, SessionType } from '@prisma/client';
import { CompetitionsService } from '../competitions/competitions.service';
import { checkSocketRateLimit } from './websocket.rate-limit';

const sessionsService = new SessionsService();
const competitionsService = new CompetitionsService();
const competitionTimers = new Map<string, NodeJS.Timeout>();

function competitionRoomName(roomId: string) {
  return `competition:${roomId}`;
}

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
  const withSocketRateLimit = (
    event: keyof ClientToServerEvents,
    max: number,
    windowSeconds: number,
    handler: (...args: any[]) => Promise<void> | void,
  ) => {
    socket.on(event as keyof ClientToServerEvents, async (...args: any[]) => {
      const result = await checkSocketRateLimit(socket, { event, max, windowSeconds });
      if (!result.allowed) {
        socket.emit('rate-limit', {
          event,
          message: 'Too many live actions. Please slow down and try again shortly.',
          retryAfterSeconds: result.retryAfterSeconds,
        });
        socket.emit('error', { message: 'Too many live actions. Please slow down and try again shortly.' });
        return;
      }

      await Promise.resolve(handler(...args));
    });
  };

  const clearCompetitionTimer = (roomId: string) => {
    const existing = competitionTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      competitionTimers.delete(roomId);
    }
  };

  const scheduleCompetitionAdvance = (roomId: string, expiresAt?: string | null) => {
    clearCompetitionTimer(roomId);
    if (!expiresAt) return;
    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const timeout = setTimeout(async () => {
      try {
        const state = await competitionsService.advanceMatch(roomId);
        io.to(competitionRoomName(roomId)).emit('competition:score-update', {
          roomId,
          scoreboard: state.scoreboard,
        });
        if (state.finished) {
          io.to(competitionRoomName(roomId)).emit('competition:match-ended', {
            roomId,
            winner_user_id: state.winner_user_id,
            scoreboard: state.scoreboard,
          });
          clearCompetitionTimer(roomId);
        } else if (state.question) {
          io.to(competitionRoomName(roomId)).emit('competition:question', {
            roomId,
            question: state.question,
          });
          scheduleCompetitionAdvance(roomId, state.question.expires_at);
        }
      } catch (error) {
        clearCompetitionTimer(roomId);
      }
    }, delay + 50);
    competitionTimers.set(roomId, timeout);
  };

  const broadcastCompetitionState = async (roomId: string) => {
    const room = await competitionsService.getLobby(userId, roomId);
    io.to(competitionRoomName(roomId)).emit('competition:room-state', { room });
    if (room.status === 'LIVE') {
      const matchState = await competitionsService.startMatch(roomId).catch(() => competitionsService.getMatchState(roomId));
      io.to(competitionRoomName(roomId)).emit('competition:started', {
        roomId,
        startsAt: room.starts_at,
      });
      if (matchState.question) {
        io.to(competitionRoomName(roomId)).emit('competition:question', {
          roomId,
          question: matchState.question,
        });
        scheduleCompetitionAdvance(roomId, matchState.question.expires_at);
      }
      io.to(competitionRoomName(roomId)).emit('competition:score-update', {
        roomId,
        scoreboard: matchState.scoreboard,
      });
    }
    return room;
  };

  withSocketRateLimit('session:start', 10, 60, async ({ sessionId, courseCode, topic, sessionType, replyMode }) => {
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
          topic,
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

  withSocketRateLimit('message:send', 20, 60, async ({ content, sessionId }) => {
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

  withSocketRateLimit('session:pause', 30, 60, async ({ sessionId, position }) => {
    try {
      const pausePosition = typeof position === 'number' && Number.isFinite(position) ? position : 0;
      await redisClient.set(`session:pause_position:${sessionId}`, pausePosition.toString());
      socket.emit('audio:stop');
      socket.emit('session:paused', { position: pausePosition });
    } catch (error: any) {
      socket.emit('error', { message: getClientSafeError(error) });
    }
  });

  withSocketRateLimit('session:resume', 30, 60, async ({ sessionId }) => {
    try {
      const position = await redisClient.get(`session:pause_position:${sessionId}`);
      const resumeFrom = position ? parseInt(position) : 0;
      socket.emit('session:resumed', { resumeFrom });
    } catch (error: any) {
      socket.emit('error', { message: getClientSafeError(error) });
    }
  });

  withSocketRateLimit('session:end', 10, 60, async ({ sessionId }) => {
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

  withSocketRateLimit('competition:join-room', 20, 60, async ({ roomId }) => {
    try {
      socket.join(competitionRoomName(roomId));
      const room = await competitionsService.getLobby(userId, roomId);
      socket.emit('competition:room-state', { room });
      socket.to(competitionRoomName(roomId)).emit('competition:room-state', { room });
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  withSocketRateLimit('competition:leave-room', 20, 60, async ({ roomId }) => {
    socket.leave(competitionRoomName(roomId));
    socket.emit('competition:left', { roomId });
  });

  withSocketRateLimit('competition:ready', 15, 60, async ({ roomId }) => {
    try {
      await competitionsService.updateParticipantStatus(userId, roomId, CompetitionParticipantStatus.READY);
      await broadcastCompetitionState(roomId);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  withSocketRateLimit('competition:unready', 15, 60, async ({ roomId }) => {
    try {
      await competitionsService.updateParticipantStatus(userId, roomId, CompetitionParticipantStatus.JOINED);
      await broadcastCompetitionState(roomId);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  withSocketRateLimit('competition:submit-answer', 12, 60, async ({ roomId, answer }) => {
    try {
      const state = await competitionsService.submitAnswer(roomId, userId, answer);
      io.to(competitionRoomName(roomId)).emit('competition:score-update', {
        roomId,
        scoreboard: state.scoreboard,
      });

      if (state.finished) {
        clearCompetitionTimer(roomId);
        io.to(competitionRoomName(roomId)).emit('competition:match-ended', {
          roomId,
          winner_user_id: state.winner_user_id,
          scoreboard: state.scoreboard,
        });
      } else if (state.question) {
        io.to(competitionRoomName(roomId)).emit('competition:question', {
          roomId,
          question: state.question,
        });
        scheduleCompetitionAdvance(roomId, state.question.expires_at);
      }
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
