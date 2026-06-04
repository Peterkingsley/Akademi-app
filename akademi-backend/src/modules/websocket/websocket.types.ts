import { SessionType, ReplyMode } from '@prisma/client';
import { JwtPayload } from '../auth/auth.types';

export interface ServerToClientEvents {
  'session:joined': (payload: { sessionId: string }) => void;
  'message:typing': () => void;
  'message:receive': (payload: { content: string; messageId: string }) => void;
  'audio:stream': (payload: { chunk: string; isLast: boolean }) => void;
  'audio:stop': () => void;
  'session:paused': (payload: { position: number }) => void;
  'session:resumed': (payload: { resumeFrom: number }) => void;
  'session:summary': (payload: { summary: any }) => void;
  'session:ended': () => void;
  'error': (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  'session:start': (payload: { sessionId?: string; courseCode?: string; topic?: string; sessionType?: SessionType; replyMode?: ReplyMode }) => void;
  'message:send': (payload: { content: string; sessionId: string }) => void;
  'session:pause': (payload: { sessionId: string; position?: number }) => void;
  'session:resume': (payload: { sessionId: string }) => void;
  'session:end': (payload: { sessionId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: JwtPayload;
}
