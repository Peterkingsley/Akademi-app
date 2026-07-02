import { SessionType, ReplyMode } from '@prisma/client';
import { JwtPayload } from '../auth/auth.types';
import { CompetitionParticipantStatus, CompetitionStatus } from '@prisma/client';

interface CompetitionParticipantPayload {
  id: string;
  user_id: string;
  name: string;
  course_code: string | null;
  score: number;
  correct_answers: number;
  wrong_answers: number;
  status: CompetitionParticipantStatus;
  ready_at: Date | null;
  joined_at: Date;
}

interface CompetitionRoomPayload {
  id: string;
  code: string;
  title: string;
  visibility: string;
  format: string;
  status: CompetitionStatus;
  shared_course_code: string | null;
  question_count: number;
  question_timer_sec: number;
  max_participants: number;
  created_at: Date;
  starts_at: Date | null;
  ended_at: Date | null;
  host: {
    id: string;
    name: string;
  };
  participants: CompetitionParticipantPayload[];
}

interface CompetitionQuestionPayload {
  id: string;
  text: string;
  options: string[];
  difficulty: string;
  index: number;
  total: number;
  expires_at: string;
}

interface CompetitionScoreboardPayload {
  user_id: string;
  name: string;
  score: number;
  correct_answers: number;
  wrong_answers: number;
  hasAnsweredCurrent: boolean;
}

interface TournamentLivePayload {
  tournamentId: string;
  roomId: string;
  title: string;
  scheduledAt: string;
  startsAt: string;
}

export interface ServerToClientEvents {
  'session:joined': (payload: { sessionId: string }) => void;
  'message:typing': () => void;
  'message:receive': (payload: { content: string; messageId: string; metadata?: Record<string, unknown> }) => void;
  'audio:stream': (payload: { chunk: string; isLast: boolean }) => void;
  'audio:stop': () => void;
  'session:paused': (payload: { position: number }) => void;
  'session:resumed': (payload: { resumeFrom: number }) => void;
  'session:summary': (payload: { summary: any }) => void;
  'session:ended': () => void;
  'competition:room-state': (payload: { room: CompetitionRoomPayload }) => void;
  'competition:started': (payload: { roomId: string; startsAt: Date | null }) => void;
  'competition:question': (payload: { roomId: string; question: CompetitionQuestionPayload }) => void;
  'competition:score-update': (payload: { roomId: string; scoreboard: CompetitionScoreboardPayload[] }) => void;
  'competition:match-ended': (payload: { roomId: string; winner_user_id?: string | null; scoreboard: CompetitionScoreboardPayload[] }) => void;
  'tournament:live': (payload: TournamentLivePayload) => void;
  'competition:left': (payload: { roomId: string }) => void;
  'rate-limit': (payload: { event: keyof ClientToServerEvents; message: string; retryAfterSeconds: number }) => void;
  'error': (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  'session:start': (payload: { sessionId?: string; courseCode?: string; topic?: string; sessionType?: SessionType; replyMode?: ReplyMode }) => void;
  'message:send': (payload: { content: string; sessionId: string }) => void;
  'session:pause': (payload: { sessionId: string; position?: number }) => void;
  'session:resume': (payload: { sessionId: string }) => void;
  'session:end': (payload: { sessionId: string }) => void;
  'competition:join-room': (payload: { roomId: string }) => void;
  'competition:leave-room': (payload: { roomId: string }) => void;
  'competition:ready': (payload: { roomId: string }) => void;
  'competition:unready': (payload: { roomId: string }) => void;
  'competition:submit-answer': (payload: { roomId: string; answer: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: JwtPayload;
}
