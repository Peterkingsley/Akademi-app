import {
  CompetitionFormat,
  CompetitionParticipantStatus,
  CompetitionStatus,
  CompetitionVisibility,
  TournamentEntryStatus,
  TournamentStatus,
} from '@prisma/client';
import prisma from '../../config/db';
import {
  CompetitionLeaderboardEntry,
  CompetitionMatchState,
  CompetitionRoomView,
  CompetitionScoreboardEntry,
  CompetitionSummary,
  CompetitionQuestionView,
  CreateCompetitionRequest,
  CreateTournamentRequest,
  TournamentView,
} from './competitions.types';

type ActiveMatchQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  explanation?: string | null;
};

type ActiveMatch = {
  roomId: string;
  currentIndex: number;
  questionTimerSec: number;
  questions: ActiveMatchQuestion[];
  scoreboard: Record<string, CompetitionScoreboardEntry>;
  answersByQuestion: Record<string, Set<string>>;
  questionStartedAt: number;
  questionExpiresAt: number;
  status: CompetitionStatus;
};

const activeMatches = new Map<string, ActiveMatch>();

function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export class CompetitionsService {
  private sanitizeOptions(options: unknown) {
    if (!Array.isArray(options)) return [];
    return options.map((option) => String(option).trim()).filter(Boolean);
  }

  private buildQuestionPayload(match: ActiveMatch): CompetitionQuestionView | null {
    const question = match.questions[match.currentIndex];
    if (!question) return null;
    return {
      id: question.id,
      text: question.question_text,
      options: question.options,
      difficulty: question.difficulty,
      index: match.currentIndex + 1,
      total: match.questions.length,
      expires_at: new Date(match.questionExpiresAt).toISOString(),
    };
  }

  private sortScoreboard(scoreboard: Record<string, CompetitionScoreboardEntry>) {
    return Object.values(scoreboard).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.correct_answers - a.correct_answers;
    });
  }

  private buildMatchState(match: ActiveMatch): CompetitionMatchState {
    return {
      roomId: match.roomId,
      status: match.status,
      question: this.buildQuestionPayload(match),
      scoreboard: this.sortScoreboard(match.scoreboard),
      finished: match.status === CompetitionStatus.FINISHED,
    };
  }

  private formatRoom(room: any): CompetitionRoomView {
    return {
      id: room.id,
      code: room.code,
      title: room.title,
      visibility: room.visibility,
      format: room.format,
      status: room.status,
      shared_course_code: room.shared_course_code,
      question_count: room.question_count,
      question_timer_sec: room.question_timer_sec,
      max_participants: room.max_participants,
      created_at: room.created_at,
      starts_at: room.starts_at,
      ended_at: room.ended_at,
      host: {
        id: room.host.id,
        name: room.host.name,
      },
      participants: room.participants.map((participant: any) => ({
        id: participant.id,
        user_id: participant.user_id,
        name: participant.user.name,
        course_code: participant.course_code,
        score: participant.score,
        correct_answers: participant.correct_answers,
        wrong_answers: participant.wrong_answers,
        status: participant.status,
        ready_at: participant.ready_at,
        joined_at: participant.joined_at,
      })),
    };
  }

  private formatTournament(tournament: any, userId?: string): TournamentView {
    const entry = userId ? tournament.entries?.find((item: any) => item.user_id === userId) || null : null;
    return {
      id: tournament.id,
      title: tournament.title,
      description: tournament.description || null,
      status: tournament.status,
      format: tournament.format,
      shared_course_code: tournament.shared_course_code || null,
      question_count: tournament.question_count,
      question_timer_sec: tournament.question_timer_sec,
      max_participants: tournament.max_participants ?? null,
      prize_summary: tournament.prize_summary || null,
      scheduled_at: tournament.scheduled_at,
      registration_closes_at: tournament.registration_closes_at || null,
      published_at: tournament.published_at || null,
      entry_count: tournament.entries?.length || 0,
      room_id: tournament.room?.id || null,
      joined: !!entry,
      entry_status: entry?.status || null,
    };
  }

  private async ensureTournamentRooms() {
    const readyTournaments = await prisma.tournament.findMany({
      where: {
        status: {
          in: [TournamentStatus.PUBLISHED, TournamentStatus.LIVE],
        },
        scheduled_at: {
          lte: new Date(),
        },
        room: null,
      },
      include: {
        entries: {
          include: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    for (const tournament of readyTournaments) {
      if (tournament.entries.length < 2) {
        continue;
      }

      const hostEntry = tournament.entries[0];
      await prisma.competitionRoom.create({
        data: {
          code: await this.generateUniqueCode(),
          host_user_id: hostEntry.user_id,
          tournament_id: tournament.id,
          title: tournament.title,
          visibility: CompetitionVisibility.TOURNAMENT,
          format: tournament.format,
          status: CompetitionStatus.LIVE,
          shared_course_code: tournament.shared_course_code,
          question_count: tournament.question_count,
          question_timer_sec: tournament.question_timer_sec,
          max_participants: tournament.max_participants || Math.max(2, tournament.entries.length),
          starts_at: new Date(),
          participants: {
            create: tournament.entries.map((entry) => ({
              user_id: entry.user_id,
              course_code: tournament.shared_course_code,
              status: CompetitionParticipantStatus.JOINED,
            })),
          },
        },
      });

      await prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          status: TournamentStatus.LIVE,
        },
      });
    }
  }

  private async generateUniqueCode() {
    for (let i = 0; i < 10; i += 1) {
      const code = generateRoomCode();
      const exists = await prisma.competitionRoom.findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw new Error('Unable to generate competition code');
  }

  async createRoom(userId: string, payload: CreateCompetitionRequest) {
    const code = await this.generateUniqueCode();
    const visibility = payload.visibility || CompetitionVisibility.PRIVATE;
    const format = payload.format || CompetitionFormat.SHARED_COURSE;
    const sharedCourseCode = format === CompetitionFormat.SHARED_COURSE ? payload.shared_course_code || payload.host_course_code || null : null;
    const hostCourseCode = format === CompetitionFormat.DUAL_COURSE ? payload.host_course_code || null : sharedCourseCode;

    const room = await prisma.competitionRoom.create({
      data: {
        code,
        host_user_id: userId,
        title: payload.title?.trim() || 'Live Competition',
        visibility,
        format,
        shared_course_code: sharedCourseCode,
        question_count: Math.min(Math.max(payload.question_count || 10, 5), 25),
        question_timer_sec: Math.min(Math.max(payload.question_timer_sec || 20, 10), 60),
        max_participants: Math.min(Math.max(payload.max_participants || 2, 2), 20),
        participants: {
          create: {
            user_id: userId,
            course_code: hostCourseCode,
            status: CompetitionParticipantStatus.JOINED,
          },
        },
      },
      include: {
        host: { select: { id: true, name: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    return this.formatRoom(room);
  }

  async joinRoom(userId: string, code: string, courseCode?: string) {
    const room = await prisma.competitionRoom.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        host: { select: { id: true, name: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!room) throw new Error('Competition room not found');
    if (room.status !== CompetitionStatus.WAITING) throw new Error('Competition room is no longer joinable');

    const existing = room.participants.find((participant: any) => participant.user_id === userId);
    if (existing) {
      return this.formatRoom(room);
    }

    if (room.participants.length >= room.max_participants) {
      throw new Error('Competition room is full');
    }

    const updated = await prisma.competitionRoom.update({
      where: { id: room.id },
      data: {
        participants: {
          create: {
            user_id: userId,
            course_code: room.format === CompetitionFormat.DUAL_COURSE ? courseCode || null : room.shared_course_code,
            status: CompetitionParticipantStatus.JOINED,
          },
        },
      },
      include: {
        host: { select: { id: true, name: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    return this.formatRoom(updated);
  }

  async getLobby(userId: string, roomId: string) {
    const room = await prisma.competitionRoom.findFirst({
      where: {
        id: roomId,
        participants: {
          some: { user_id: userId },
        },
      },
      include: {
        host: { select: { id: true, name: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { joined_at: 'asc' },
        },
      },
    });

    if (!room) throw new Error('Competition room not found');
    return this.formatRoom(room);
  }

  async listMyRooms(userId: string) {
    const rooms = await prisma.competitionRoom.findMany({
      where: {
        participants: {
          some: { user_id: userId },
        },
      },
      include: {
        host: { select: { id: true, name: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { joined_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    return rooms.map((room) => this.formatRoom(room));
  }

  async listPublicRooms() {
    const rooms = await prisma.competitionRoom.findMany({
      where: {
        visibility: CompetitionVisibility.PUBLIC,
        status: CompetitionStatus.WAITING,
      },
      include: {
        host: { select: { id: true, name: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { joined_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    return rooms.map((room) => this.formatRoom(room));
  }

  async updateParticipantStatus(userId: string, roomId: string, status: CompetitionParticipantStatus) {
    const participant = await prisma.competitionParticipant.findFirst({
      where: {
        room_id: roomId,
        user_id: userId,
      },
    });

    if (!participant) throw new Error('Competition participant not found');

    await prisma.competitionParticipant.update({
      where: { id: participant.id },
      data: {
        status,
        ready_at: status === CompetitionParticipantStatus.READY ? new Date() : null,
      },
    });

    const room = await this.getLobby(userId, roomId);
    const readyCount = room.participants.filter((item) => item.status === CompetitionParticipantStatus.READY).length;
    if (
      room.status === CompetitionStatus.WAITING &&
      room.participants.length >= 2 &&
      readyCount === room.participants.length
    ) {
      await prisma.competitionRoom.update({
        where: { id: room.id },
        data: {
          status: CompetitionStatus.LIVE,
          starts_at: new Date(),
        },
      });
      return this.getLobby(userId, roomId);
    }

    return room;
  }

  async startMatch(roomId: string) {
    const room = await prisma.competitionRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { joined_at: 'asc' },
        },
      },
    });

    if (!room) throw new Error('Competition room not found');
    if (room.participants.length < 2) throw new Error('At least two participants are required');

    const courseCodes = room.format === CompetitionFormat.SHARED_COURSE
      ? [room.shared_course_code].filter(Boolean) as string[]
      : room.participants.map((participant) => participant.course_code).filter(Boolean) as string[];

    const questions = await prisma.question.findMany({
      where: {
        correct_answer: { not: null },
        course_code: { in: courseCodes.length > 0 ? courseCodes : [''] },
      },
      take: room.question_count,
      orderBy: { generated_at: 'desc' },
    });

    if (questions.length < Math.min(5, room.question_count)) {
      throw new Error('Not enough scored questions are available for this match yet');
    }

    const scoreboard = room.participants.reduce<Record<string, CompetitionScoreboardEntry>>((acc, participant) => {
      acc[participant.user_id] = {
        user_id: participant.user_id,
        name: participant.user.name,
        score: participant.score,
        correct_answers: participant.correct_answers,
        wrong_answers: participant.wrong_answers,
        hasAnsweredCurrent: false,
      };
      return acc;
    }, {});

    const startedAt = Date.now();
    const match: ActiveMatch = {
      roomId,
      currentIndex: 0,
      questionTimerSec: room.question_timer_sec,
      questions: questions.map((question) => ({
        id: question.id,
        question_text: question.question_text,
        options: this.sanitizeOptions(question.options),
        correct_answer: question.correct_answer || '',
        difficulty: question.difficulty,
        explanation: question.explanation,
      })),
      scoreboard,
      answersByQuestion: {},
      questionStartedAt: startedAt,
      questionExpiresAt: startedAt + room.question_timer_sec * 1000,
      status: CompetitionStatus.LIVE,
    };

    activeMatches.set(roomId, match);
    return this.buildMatchState(match);
  }

  getMatchState(roomId: string) {
    const match = activeMatches.get(roomId);
    if (!match) throw new Error('Match state not found');
    return this.buildMatchState(match);
  }

  async submitAnswer(roomId: string, userId: string, answer: string) {
    const match = activeMatches.get(roomId);
    if (!match) throw new Error('Match state not found');
    if (match.status !== CompetitionStatus.LIVE) throw new Error('Match is not live');

    const question = match.questions[match.currentIndex];
    if (!question) throw new Error('No active question');
    if (Date.now() > match.questionExpiresAt) {
      return this.advanceMatch(roomId);
    }

    const answeredSet = match.answersByQuestion[question.id] || new Set<string>();
    if (answeredSet.has(userId)) {
      return this.buildMatchState(match);
    }
    answeredSet.add(userId);
    match.answersByQuestion[question.id] = answeredSet;

    const entry = match.scoreboard[userId];
    if (!entry) throw new Error('Participant not found in match');

    const normalizedAnswer = answer.trim().toLowerCase();
    const normalizedCorrect = question.correct_answer.trim().toLowerCase();
    const elapsedMs = Math.max(0, Date.now() - match.questionStartedAt);
    const isCorrect = normalizedAnswer === normalizedCorrect;
    entry.hasAnsweredCurrent = true;

    if (isCorrect) {
      const speedBonus = Math.max(0, Math.round((match.questionTimerSec * 1000 - elapsedMs) / 1000));
      entry.correct_answers += 1;
      entry.score += 100 + speedBonus;
    } else {
      entry.wrong_answers += 1;
    }

    await prisma.competitionParticipant.updateMany({
      where: {
        room_id: roomId,
        user_id: userId,
      },
      data: {
        score: entry.score,
        correct_answers: entry.correct_answers,
        wrong_answers: entry.wrong_answers,
      },
    });

    const everyoneAnswered = Object.keys(match.scoreboard).every((participantId) =>
      answeredSet.has(participantId),
    );

    if (everyoneAnswered) {
      return this.advanceMatch(roomId);
    }

    return this.buildMatchState(match);
  }

  async advanceMatch(roomId: string) {
    const match = activeMatches.get(roomId);
    if (!match) throw new Error('Match state not found');

    match.currentIndex += 1;
    if (match.currentIndex >= match.questions.length) {
      return this.finishMatch(roomId);
    }

    match.questionStartedAt = Date.now();
    match.questionExpiresAt = match.questionStartedAt + match.questionTimerSec * 1000;
    Object.values(match.scoreboard).forEach((entry) => {
      entry.hasAnsweredCurrent = false;
    });

    return this.buildMatchState(match);
  }

  async finishMatch(roomId: string) {
    const match = activeMatches.get(roomId);
    if (!match) throw new Error('Match state not found');

    match.status = CompetitionStatus.FINISHED;
    const ordered = this.sortScoreboard(match.scoreboard);
    const winner = ordered[0] || null;

    await prisma.competitionRoom.update({
      where: { id: roomId },
      data: {
        status: CompetitionStatus.FINISHED,
        ended_at: new Date(),
        winner_user_id: winner?.user_id || null,
      },
    });

    await prisma.competitionParticipant.updateMany({
      where: { room_id: roomId },
      data: {
        finished_at: new Date(),
      },
    });

    const finalState: CompetitionMatchState = {
      roomId,
      status: CompetitionStatus.FINISHED,
      question: null,
      scoreboard: ordered,
      winner_user_id: winner?.user_id || null,
      finished: true,
    };

    activeMatches.delete(roomId);
    return finalState;
  }

  async getSummary(userId: string): Promise<CompetitionSummary> {
    const [entries, wins, liveMatches] = await Promise.all([
      prisma.competitionParticipant.findMany({
        where: {
          user_id: userId,
        },
        select: {
          score: true,
          room: {
            select: {
              status: true,
              winner_user_id: true,
            },
          },
        },
      }),
      prisma.competitionRoom.count({
        where: {
          winner_user_id: userId,
        },
      }),
      prisma.competitionParticipant.count({
        where: {
          user_id: userId,
          room: {
            status: CompetitionStatus.LIVE,
          },
        },
      }),
    ]);

    const finishedEntries = entries.filter((entry) => entry.room.status === CompetitionStatus.FINISHED);
    const matchesPlayed = finishedEntries.length;
    const totalScore = finishedEntries.reduce((sum, entry) => sum + entry.score, 0);
    const averageScore = matchesPlayed ? Math.round(totalScore / matchesPlayed) : 0;
    const winRate = matchesPlayed ? Math.round((wins / matchesPlayed) * 100) : 0;

    return {
      matchesPlayed,
      wins,
      liveMatches,
      averageScore,
      winRate,
    };
  }

  async getLeaderboard(limit = 20): Promise<CompetitionLeaderboardEntry[]> {
    const participants = await prisma.competitionParticipant.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        room: {
          select: {
            status: true,
            winner_user_id: true,
          },
        },
      },
      where: {
        room: {
          status: CompetitionStatus.FINISHED,
        },
      },
    });

    const totals = new Map<string, CompetitionLeaderboardEntry>();

    for (const entry of participants) {
      const existing = totals.get(entry.user_id) || {
        user_id: entry.user_id,
        name: entry.user.name,
        totalScore: 0,
        wins: 0,
        matchesPlayed: 0,
        winRate: 0,
      };

      existing.totalScore += entry.score;
      existing.matchesPlayed += 1;
      if (entry.room.winner_user_id === entry.user_id) {
        existing.wins += 1;
      }
      totals.set(entry.user_id, existing);
    }

    return Array.from(totals.values())
      .map((entry) => ({
        ...entry,
        winRate: entry.matchesPlayed ? Math.round((entry.wins / entry.matchesPlayed) * 100) : 0,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.totalScore - a.totalScore;
      })
      .slice(0, limit);
  }

  async createTournament(adminId: string, payload: CreateTournamentRequest) {
    const tournament = await prisma.tournament.create({
      data: {
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        format: payload.format || CompetitionFormat.SHARED_COURSE,
        shared_course_code: payload.shared_course_code?.trim().toUpperCase() || null,
        question_count: Math.min(Math.max(payload.question_count || 10, 5), 25),
        question_timer_sec: Math.min(Math.max(payload.question_timer_sec || 20, 10), 60),
        max_participants: payload.max_participants || null,
        prize_summary: payload.prize_summary?.trim() || null,
        scheduled_at: new Date(payload.scheduled_at),
        registration_closes_at: payload.registration_closes_at ? new Date(payload.registration_closes_at) : null,
        created_by_admin_id: adminId,
      },
      include: {
        entries: true,
      },
    });

    return this.formatTournament(tournament);
  }

  async publishTournament(tournamentId: string) {
    const tournament = await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        status: TournamentStatus.PUBLISHED,
        published_at: new Date(),
      },
      include: {
        entries: true,
      },
    });

    return this.formatTournament(tournament);
  }

  async listAdminTournaments() {
    await this.ensureTournamentRooms();
    const tournaments = await prisma.tournament.findMany({
      include: {
        entries: true,
        room: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { scheduled_at: 'asc' },
      take: 50,
    });

    return tournaments.map((tournament) => this.formatTournament(tournament));
  }

  async listPublicTournaments(userId: string) {
    await this.ensureTournamentRooms();
    const tournaments = await prisma.tournament.findMany({
      where: {
        status: {
          in: [TournamentStatus.PUBLISHED, TournamentStatus.LIVE],
        },
      },
      include: {
        entries: true,
        room: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { scheduled_at: 'asc' },
      take: 20,
    });

    return tournaments.map((tournament) => this.formatTournament(tournament, userId));
  }

  async joinTournament(userId: string, tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: true,
        room: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!tournament) throw new Error('Tournament not found');
    if (![TournamentStatus.PUBLISHED, TournamentStatus.LIVE].includes(tournament.status)) {
      throw new Error('Tournament is not open for registration');
    }
    if (tournament.registration_closes_at && tournament.registration_closes_at.getTime() < Date.now()) {
      throw new Error('Tournament registration is closed');
    }
    if (tournament.max_participants && tournament.entries.length >= tournament.max_participants) {
      throw new Error('Tournament is full');
    }

    const existing = tournament.entries.find((entry) => entry.user_id === userId);
    if (!existing) {
      await prisma.tournamentEntry.create({
        data: {
          tournament_id: tournamentId,
          user_id: userId,
          status: TournamentEntryStatus.REGISTERED,
        },
      });
    }

    const updated = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: true,
        room: {
          select: {
            id: true,
          },
        },
      },
    });

    return this.formatTournament(updated, userId);
  }

  async getTournament(userId: string, tournamentId: string) {
    await this.ensureTournamentRooms();
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: true,
        room: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!tournament) throw new Error('Tournament not found');
    return this.formatTournament(tournament, userId);
  }
}
