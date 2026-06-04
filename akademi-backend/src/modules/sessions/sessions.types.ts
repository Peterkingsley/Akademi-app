import { SessionType, ReplyMode, MessageRole } from '@prisma/client';

export interface StartSessionRequest {
  session_type: SessionType;
  reply_mode?: ReplyMode;
  course_code?: string | null;
  topic?: string | null;
  duration?: number | null;
  metadata?: Record<string, unknown>;
}

export interface SendMessageRequest {
  content: string;
  reply_mode?: ReplyMode;
}

export interface SessionResponse {
  id: string;
  session_type: SessionType;
  reply_mode: ReplyMode | null;
  course_code?: string | null;
  topic?: string | null;
  duration?: number | null;
  university: string;
  department: string;
  started_at: Date;
  ended_at: Date | null;
}

export interface MessageResponse {
  id: string;
  role: MessageRole;
  content: string;
  reply_mode: ReplyMode | null;
  created_at: Date;
}
