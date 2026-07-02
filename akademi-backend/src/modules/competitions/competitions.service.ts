import {
  CompetitionFormat,
  MatchSessionStatus,
  CompetitionParticipantStatus,
  CompetitionStatus,
  CompetitionVisibility,
  TournamentCampaignType,
  TournamentEntryStatus,
  TournamentInterestType,
  TournamentPredictionStatus,
  TournamentStageStatus,
  TournamentStatus,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { notificationsService } from '../notifications/notifications.service';
import { emitToUser } from '../websocket/websocket.emitter';
import {
  AdminCompetitionRoomView,
  CompetitionLeaderboardEntry,
  CompetitionMatchState,
  CompetitionRoomView,
  CompetitionScoreboardEntry,
  CompetitionSummary,
  CompetitionQuestionView,
  CreateCompetitionRequest,
  CreateTournamentRequest,
  CreateTournamentStageRequest,
  TournamentArenaView,
  TournamentAudienceOptions,
  TournamentMaterialOption,
  TournamentStageView,
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

function generateShareToken() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 18; i += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return token;
}

function schoolAbbreviation(value?: string | null) {
  if (!value) return null;
  const words = value.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) return words[0].slice(0, 6).toUpperCase();
  return words.map((word) => word[0]).join('').slice(0, 6).toUpperCase();
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

  private serializeMatch(match: ActiveMatch) {
    return {
      current_index: match.currentIndex,
      question_started_at: new Date(match.questionStartedAt),
      question_expires_at: new Date(match.questionExpiresAt),
      question_ids: match.questions.map((question) => question.id),
      answered_user_ids: Object.fromEntries(
        Object.entries(match.answersByQuestion).map(([questionId, userIds]) => [questionId, Array.from(userIds)]),
      ) as Prisma.InputJsonValue,
      scoreboard: match.scoreboard as unknown as Prisma.InputJsonValue,
      status: match.status === CompetitionStatus.FINISHED ? MatchSessionStatus.FINISHED : MatchSessionStatus.LIVE,
    };
  }

  private async persistMatch(roomId: string, match: ActiveMatch) {
    await prisma.competitionMatchSession.upsert({
      where: { room_id: roomId },
      create: {
        room_id: roomId,
        ...this.serializeMatch(match),
      },
      update: this.serializeMatch(match),
    });
  }

  private async hydrateMatch(roomId: string) {
    const room = await prisma.competitionRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { joined_at: 'asc' },
        },
        match_session: true,
      },
    });

    if (!room?.match_session) return null;

    const questionIds = Array.isArray(room.match_session.question_ids) ? room.match_session.question_ids.map(String) : [];
    const persistedQuestions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
    });
    const questionMap = new Map(persistedQuestions.map((question) => [question.id, question]));
    const questions = questionIds.map((questionId) => questionMap.get(questionId)).filter(Boolean).map((question: any) => ({
      id: question.id,
      question_text: question.question_text,
      options: this.sanitizeOptions(question.options),
      correct_answer: question.correct_answer || '',
      difficulty: question.difficulty,
      explanation: question.explanation,
    }));

    const scoreboard = ((room.match_session.scoreboard || {}) as unknown) as Record<string, CompetitionScoreboardEntry>;
    const answeredUserIds = ((room.match_session.answered_user_ids || {}) as unknown) as Record<string, string[]>;
    const match: ActiveMatch = {
      roomId,
      currentIndex: room.match_session.current_index,
      questionTimerSec: room.question_timer_sec,
      questions,
      scoreboard,
      answersByQuestion: Object.fromEntries(
        Object.entries(answeredUserIds).map(([questionId, userIds]) => [questionId, new Set((userIds || []).map(String))]),
      ),
      questionStartedAt: new Date(room.match_session.question_started_at).getTime(),
      questionExpiresAt: new Date(room.match_session.question_expires_at).getTime(),
      status: room.match_session.status === MatchSessionStatus.FINISHED ? CompetitionStatus.FINISHED : CompetitionStatus.LIVE,
    };

    activeMatches.set(roomId, match);
    return match;
  }

  private formatTournamentStage(stage: any): TournamentStageView {
    return {
      id: stage.id,
      name: stage.name,
      stage_order: stage.stage_order,
      status: stage.status,
      starts_at: stage.starts_at,
      duration_minutes: stage.duration_minutes,
      question_timer_style: stage.question_timer_style,
      question_count: stage.question_count,
      question_timer_sec: stage.question_timer_sec ?? null,
      question_source: stage.question_source || null,
      difficulty_level: stage.difficulty_level || null,
      qualification_count: stage.qualification_count ?? null,
      minimum_participants: stage.minimum_participants ?? null,
      fallback_rule: stage.fallback_rule || null,
      result_visibility: stage.result_visibility,
      room_id: stage.room_id || null,
      participant_count: stage.participants?.length || 0,
      qualified_count: stage.participants?.filter((participant: any) => participant.qualified).length || 0,
    };
  }

  private publicContestantName(user: {
    name?: string | null;
    university?: string | null;
    department?: string | null;
  }, audienceScope: string) {
    const firstName = (user.name || 'Student').trim().split(/\s+/)[0] || 'Student';
    if (audienceScope === 'EVERYONE' || audienceScope === 'UNIVERSITY') {
      const abbr = schoolAbbreviation(user.university);
      return abbr ? `${firstName} - ${abbr}` : firstName;
    }
    if (audienceScope === 'FACULTY' || audienceScope === 'DEPARTMENT') {
      return user.department ? `${firstName} - ${user.department}` : firstName;
    }
    return firstName;
  }

  private formatTournament(tournament: any, userId?: string): TournamentView {
    const entry = userId ? tournament.entries?.find((item: any) => item.user_id === userId) || null : null;
    const registeredCount = tournament.entries?.filter((item: any) => item.status === TournamentEntryStatus.REGISTERED).length || 0;
    const checkedInCount = tournament.entries?.filter((item: any) => item.status === TournamentEntryStatus.CHECKED_IN).length || 0;
    const standbyCount = tournament.entries?.filter((item: any) => item.status === 'STANDBY').length || 0;
    const interest = userId ? tournament.interests?.find((item: any) => item.user_id === userId) || null : null;
    const prediction = userId ? tournament.predictions?.find((item: any) => item.user_id === userId) || null : null;
    return {
      id: tournament.id,
      title: tournament.title,
      description: tournament.description || null,
      status: tournament.status,
      campaign_type: tournament.campaign_type || TournamentCampaignType.SIMPLE,
      format: tournament.format,
      shared_course_code: tournament.shared_course_code || null,
      source_material_ids: tournament.source_material_ids || [],
      question_count: tournament.question_count,
      question_timer_sec: tournament.question_timer_sec,
      max_participants: tournament.max_participants ?? null,
      prize_summary: tournament.prize_summary || null,
      scheduled_at: tournament.scheduled_at,
      registration_closes_at: tournament.registration_closes_at || null,
      late_join_cutoff_at: tournament.late_join_cutoff_at || null,
      check_in_opens_at: tournament.check_in_opens_at || null,
      check_in_closes_at: tournament.check_in_closes_at || null,
      published_at: tournament.published_at || null,
      campaign_banner_url: tournament.campaign_banner_url || null,
      campaign_accent_color: tournament.campaign_accent_color || null,
      campaign_cta_label: tournament.campaign_cta_label || null,
      campaign_cta_url: tournament.campaign_cta_url || null,
      campaign_preheader: tournament.campaign_preheader || null,
      prediction_enabled: !!tournament.prediction_enabled,
      prediction_prize_summary: tournament.prediction_prize_summary || null,
      prediction_winner_count: tournament.prediction_winner_count ?? null,
      prediction_closes_at: tournament.prediction_closes_at || null,
      share_template: tournament.share_template || null,
      audience_scope: tournament.audience_scope,
      audience_university: tournament.audience_university || null,
      audience_faculty: tournament.audience_faculty || null,
      audience_department: tournament.audience_department || null,
      entry_count: tournament.entries?.length || 0,
      registered_count: registeredCount,
      checked_in_count: checkedInCount,
      standby_count: standbyCount,
      room_id: tournament.room?.id || tournament.rooms?.[0]?.id || null,
      joined: !!entry,
      entry_status: entry?.status || null,
      share_token: entry?.share_token || null,
      stages: Array.isArray(tournament.stages)
        ? tournament.stages
            .slice()
            .sort((a: any, b: any) => a.stage_order - b.stage_order)
            .map((stage: any) => this.formatTournamentStage(stage))
        : [],
      interest_type: interest?.interest_type || null,
      prediction_status: prediction?.status || null,
      predicted_user_id: prediction?.predicted_user_id || null,
      cheer_count: tournament.cheers?.reduce((sum: number, cheer: any) => sum + (cheer.amount || 1), 0) || 0,
    };
  }

  private async ensureTournamentRooms() {
    try {
      await this.activateDueTournaments();
    } catch (error) {
      console.warn(
        'Tournament room activation skipped during read path:',
        (error as Error)?.message || error,
      );
    }
  }

  private async getRoomQuestions(room: {
    format: CompetitionFormat;
    shared_course_code: string | null;
    tournament_id?: string | null;
    question_count: number;
    participants: Array<{ course_code: string | null }>;
  }) {
    const tournament = room.tournament_id
      ? await prisma.tournament.findUnique({
          where: { id: room.tournament_id },
          select: { source_material_ids: true },
        })
      : null;

    const sourceMaterialIds = tournament?.source_material_ids?.filter(Boolean) || [];

    if (sourceMaterialIds.length > 0) {
      const questions = await prisma.question.findMany({
        where: {
          correct_answer: { not: null },
          material_id: { in: sourceMaterialIds },
        },
        take: room.question_count,
        orderBy: { generated_at: 'desc' },
      });

      if (questions.length < Math.min(5, room.question_count)) {
        throw new Error('Not enough scored questions are available from the selected materials yet');
      }

      return questions;
    }

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

    return questions;
  }

  async activateDueTournaments() {
    const readyTournaments = await prisma.tournament.findMany({
      where: {
        status: {
          in: [TournamentStatus.PUBLISHED, TournamentStatus.LIVE],
        },
        campaign_type: TournamentCampaignType.SIMPLE,
        scheduled_at: {
          lte: new Date(),
        },
        rooms: { none: {} },
      },
      include: {
        entries: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        rooms: {
          include: {
            participants: true,
          },
        },
      },
    });

    for (const tournament of readyTournaments) {
      try {
        if (tournament.check_in_closes_at && tournament.check_in_closes_at.getTime() <= Date.now()) {
          const noShowEntryIds = tournament.entries
            .filter((entry) => entry.status === TournamentEntryStatus.REGISTERED)
            .map((entry) => entry.id);

          if (noShowEntryIds.length > 0) {
            await prisma.tournamentEntry.updateMany({
              where: { id: { in: noShowEntryIds } },
              data: { status: 'STANDBY' as any },
            });

            await Promise.all(
              tournament.entries
                .filter((entry) => entry.status === TournamentEntryStatus.REGISTERED)
                .map((entry) =>
                  notificationsService.createNotification({
                    user_id: entry.user_id,
                    title: `${tournament.title} moved you to standby`,
                    message: 'Check-in closed before you confirmed attendance, so you were not added to the live room.',
                    type: 'tournament_standby',
                  }),
                ),
            );
          }
        }

        const refreshedTournament = await prisma.tournament.findUnique({
          where: { id: tournament.id },
          include: {
            entries: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            rooms: {
              include: {
                participants: true,
              },
            },
          },
        });

        if (!refreshedTournament) {
          continue;
        }

        const checkInClosesAt = refreshedTournament.check_in_closes_at || refreshedTournament.scheduled_at;
        const eligibleEntries = refreshedTournament.entries.filter((entry) =>
          entry.status === TournamentEntryStatus.CHECKED_IN || checkInClosesAt.getTime() <= Date.now(),
        );

        if (eligibleEntries.length < 2) {
          continue;
        }

        let room = refreshedTournament.rooms[0] || null;

        if (!room) {
          const hostEntry = eligibleEntries[0];
          room = await prisma.competitionRoom.create({
            data: {
              code: await this.generateUniqueCode(),
              host_user_id: hostEntry.user_id,
              tournament_id: refreshedTournament.id,
              title: refreshedTournament.title,
              visibility: CompetitionVisibility.TOURNAMENT,
              format: refreshedTournament.format,
              status: CompetitionStatus.LIVE,
              shared_course_code: refreshedTournament.shared_course_code,
              question_count: refreshedTournament.question_count,
              question_timer_sec: refreshedTournament.question_timer_sec,
              max_participants: refreshedTournament.max_participants || Math.max(2, refreshedTournament.entries.length),
              starts_at: new Date(),
              participants: {
                create: eligibleEntries.map((entry) => ({
                  user_id: entry.user_id,
                  course_code: refreshedTournament.shared_course_code,
                  status: CompetitionParticipantStatus.JOINED,
                })),
              },
            },
            include: {
              participants: true,
            },
          });
        }

        await prisma.tournament.update({
          where: { id: refreshedTournament.id },
          data: {
            status: TournamentStatus.LIVE,
          },
        });

        try {
          await this.startMatch(room.id);
        } catch (error) {
          console.warn(`Unable to seed tournament match ${refreshedTournament.id}:`, (error as Error)?.message || error);
        }

        const startsAt = room.starts_at || new Date();
        await Promise.all(
          eligibleEntries.map(async (entry) => {
            await notificationsService.createNotification({
              user_id: entry.user_id,
              title: `${refreshedTournament.title} is live`,
              message: `Your tournament room is ready. Join now and compete live.`,
              type: 'tournament_live',
            });

            emitToUser(entry.user_id, 'tournament:live', {
              tournamentId: refreshedTournament.id,
              roomId: room!.id,
              title: refreshedTournament.title,
              scheduledAt: refreshedTournament.scheduled_at.toISOString(),
              startsAt: startsAt.toISOString(),
            });
          }),
        );
      } catch (error) {
        console.warn(
          `Tournament activation failed for ${tournament.id}:`,
          (error as Error)?.message || error,
        );
      }
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

  private async generateUniqueShareToken() {
    for (let i = 0; i < 10; i += 1) {
      const token = generateShareToken();
      const exists = await prisma.tournamentEntry.findUnique({ where: { share_token: token } });
      if (!exists) return token;
    }
    throw new Error('Unable to generate campaign share token');
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
    const existing = activeMatches.get(roomId) || await this.hydrateMatch(roomId);
    if (existing) {
      return this.buildMatchState(existing);
    }

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

    const questions = await this.getRoomQuestions(room);

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
    await this.persistMatch(roomId, match);
    return this.buildMatchState(match);
  }

  async getMatchState(roomId: string) {
    const match = activeMatches.get(roomId) || await this.hydrateMatch(roomId);
    if (!match) throw new Error('Match state not found');
    return this.buildMatchState(match);
  }

  async submitAnswer(roomId: string, userId: string, answer: string) {
    const match = activeMatches.get(roomId) || await this.hydrateMatch(roomId);
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

    await this.persistMatch(roomId, match);
    return this.buildMatchState(match);
  }

  async advanceMatch(roomId: string) {
    const match = activeMatches.get(roomId) || await this.hydrateMatch(roomId);
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

    await this.persistMatch(roomId, match);
    return this.buildMatchState(match);
  }

  async finishMatch(roomId: string) {
    const match = activeMatches.get(roomId) || await this.hydrateMatch(roomId);
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
    await prisma.competitionMatchSession.updateMany({
      where: { room_id: roomId },
      data: { status: MatchSessionStatus.FINISHED },
    });
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

  private normalizeTournamentStages(payload: CreateTournamentRequest): CreateTournamentStageRequest[] {
    const suppliedStages = Array.isArray(payload.stages) ? payload.stages : [];
    if (payload.campaign_type !== TournamentCampaignType.MULTI_STAGE && suppliedStages.length === 0) {
      return [];
    }

    const fallbackStage: CreateTournamentStageRequest = {
      name: 'Open Challenge',
      stage_order: 1,
      starts_at: payload.scheduled_at,
      duration_minutes: Math.max(1, Math.ceil(((payload.question_count || 10) * (payload.question_timer_sec || 20)) / 60)),
      question_timer_style: 'PER_QUESTION',
      question_count: payload.question_count || 10,
      question_timer_sec: payload.question_timer_sec || 20,
      question_source: payload.shared_course_code || 'campaign_pool',
      qualification_count: payload.max_participants || undefined,
      result_visibility: 'QUALIFIERS',
    };

    return (suppliedStages.length > 0 ? suppliedStages : [fallbackStage])
      .map((stage, index) => ({
        ...stage,
        name: stage.name?.trim() || `Stage ${index + 1}`,
        stage_order: stage.stage_order || index + 1,
        duration_minutes: Math.min(Math.max(Number(stage.duration_minutes) || 10, 1), 240),
        question_count: Math.min(Math.max(Number(stage.question_count) || payload.question_count || 10, 1), 100),
        question_timer_sec: stage.question_timer_sec
          ? Math.min(Math.max(Number(stage.question_timer_sec), 5), 600)
          : payload.question_timer_sec,
        starts_at: stage.starts_at || payload.scheduled_at,
      }))
      .sort((a, b) => (a.stage_order || 0) - (b.stage_order || 0));
  }

  async createTournament(adminId: string, payload: CreateTournamentRequest) {
    const sourceMaterialIds = Array.from(new Set((payload.source_material_ids || []).map((id) => id.trim()).filter(Boolean)));
    let normalizedSharedCourseCode = payload.shared_course_code?.trim().toUpperCase() || null;
    const campaignType = payload.campaign_type || (payload.stages?.length ? TournamentCampaignType.MULTI_STAGE : TournamentCampaignType.SIMPLE);
    const stages = this.normalizeTournamentStages({ ...payload, campaign_type: campaignType });

    if (sourceMaterialIds.length > 0) {
      const materials = await prisma.material.findMany({
        where: {
          id: { in: sourceMaterialIds },
          verification_status: 'VERIFIED' as any,
        },
        select: {
          id: true,
          course_code: true,
        },
      });

      if (materials.length !== sourceMaterialIds.length) {
        throw new Error('One or more selected materials are no longer verified or available');
      }

      const materialCourseCodes = Array.from(
        new Set(materials.map((material) => material.course_code?.trim().toUpperCase()).filter(Boolean) as string[]),
      );

      normalizedSharedCourseCode = materialCourseCodes.length === 1 ? materialCourseCodes[0] : null;
    }

    const tournament = await prisma.tournament.create({
      data: {
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        campaign_type: campaignType,
        format: payload.format || CompetitionFormat.SHARED_COURSE,
        shared_course_code: normalizedSharedCourseCode,
        source_material_ids: sourceMaterialIds,
        question_count: Math.min(Math.max(payload.question_count || 10, 5), 25),
        question_timer_sec: Math.min(Math.max(payload.question_timer_sec || 20, 10), 60),
        max_participants: payload.max_participants || null,
        prize_summary: payload.prize_summary?.trim() || null,
        campaign_banner_url: payload.campaign_banner_url?.trim() || null,
        campaign_accent_color: payload.campaign_accent_color?.trim() || null,
        campaign_cta_label: payload.campaign_cta_label?.trim() || null,
        campaign_cta_url: payload.campaign_cta_url?.trim() || null,
        campaign_preheader: payload.campaign_preheader?.trim() || null,
        prediction_enabled: !!payload.prediction_enabled,
        prediction_prize_summary: payload.prediction_prize_summary?.trim() || null,
        prediction_winner_count: payload.prediction_winner_count || null,
        prediction_closes_at: payload.prediction_closes_at ? new Date(payload.prediction_closes_at) : null,
        share_template: payload.share_template?.trim() || null,
        audience_scope: (payload.audience_scope || 'EVERYONE') as any,
        audience_university: payload.audience_university?.trim() || null,
        audience_faculty: payload.audience_faculty?.trim() || null,
        audience_department: payload.audience_department?.trim() || null,
        scheduled_at: new Date(payload.scheduled_at),
        registration_closes_at: payload.registration_closes_at ? new Date(payload.registration_closes_at) : null,
        late_join_cutoff_at: payload.late_join_cutoff_at ? new Date(payload.late_join_cutoff_at) : null,
        check_in_opens_at: payload.check_in_opens_at ? new Date(payload.check_in_opens_at) : null,
        check_in_closes_at: payload.check_in_closes_at ? new Date(payload.check_in_closes_at) : null,
        created_by_admin_id: adminId,
        stages: stages.length > 0
          ? {
              create: stages.map((stage, index) => ({
                name: stage.name,
                stage_order: stage.stage_order || index + 1,
                starts_at: new Date(stage.starts_at),
                duration_minutes: stage.duration_minutes,
                question_timer_style: stage.question_timer_style || 'PER_QUESTION',
                question_count: stage.question_count,
                question_timer_sec: stage.question_timer_sec || payload.question_timer_sec || null,
                question_source: stage.question_source?.trim() || normalizedSharedCourseCode || null,
                difficulty_level: stage.difficulty_level?.trim() || null,
                qualification_count: stage.qualification_count || null,
                minimum_participants: stage.minimum_participants || null,
                fallback_rule: stage.fallback_rule?.trim() || null,
                result_visibility: stage.result_visibility || 'QUALIFIERS',
              })),
            }
          : undefined,
      },
      include: {
        entries: true,
        stages: {
          include: {
            participants: true,
          },
        },
        interests: true,
        predictions: true,
        cheers: true,
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
        stages: { include: { participants: true } },
        interests: true,
        predictions: true,
        cheers: true,
      },
    });

    return this.formatTournament(tournament);
  }

  async listAdminTournaments() {
    await this.ensureTournamentRooms();
    const tournaments = await prisma.tournament.findMany({
      include: {
        entries: true,
        stages: { include: { participants: true } },
        interests: true,
        predictions: true,
        cheers: true,
        rooms: {
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

  async listTournamentMaterialOptions(filter: {
    university?: string;
    faculty?: string;
    department?: string;
  }): Promise<TournamentMaterialOption[]> {
    const materials = await prisma.material.findMany({
      where: {
        verification_status: 'VERIFIED' as any,
        ...(filter.university ? { university: filter.university } : {}),
        ...(filter.faculty ? { faculty: filter.faculty } : {}),
        ...(filter.department ? { department: filter.department } : {}),
      },
      select: {
        id: true,
        title: true,
        course_code: true,
        university: true,
        faculty: true,
        department: true,
        level: true,
        semester: true,
        created_at: true,
      },
      orderBy: [{ course_code: 'asc' }, { created_at: 'desc' }],
      take: 200,
    });

    return materials;
  }

  async listTournamentAudienceOptions(): Promise<TournamentAudienceOptions> {
    const departments = await prisma.department.findMany({
      select: {
        name: true,
        faculty: true,
      },
      distinct: ['name', 'faculty'],
      orderBy: [{ faculty: 'asc' }, { name: 'asc' }],
    });

    return {
      faculties: Array.from(new Set(departments.map((entry) => entry.faculty).filter(Boolean))).sort(),
      departments: Array.from(new Set(departments.map((entry) => entry.name).filter(Boolean))).sort(),
    };
  }

  async listAdminRooms(): Promise<AdminCompetitionRoomView[]> {
    await this.ensureTournamentRooms();
    const rooms = await prisma.competitionRoom.findMany({
      include: {
        host: {
          select: {
            id: true,
            name: true,
          },
        },
        tournament: {
          select: {
            id: true,
            title: true,
          },
        },
        participants: {
          select: {
            user_id: true,
            user: {
              select: {
                name: true,
              },
            },
            status: true,
          },
        },
      },
      orderBy: [{ ended_at: 'desc' }, { starts_at: 'desc' }, { created_at: 'desc' }],
      take: 100,
    });

    return rooms.map((room) => {
      const winner = room.winner_user_id
        ? room.participants.find((participant) => participant.user_id === room.winner_user_id)
        : null;

      return {
        id: room.id,
        code: room.code,
        title: room.title,
        visibility: room.visibility,
        format: room.format,
        status: room.status,
        shared_course_code: room.shared_course_code,
        created_at: room.created_at,
        starts_at: room.starts_at,
        ended_at: room.ended_at,
        host: room.host,
        participant_count: room.participants.length,
        ready_count: room.participants.filter((participant) => participant.status === CompetitionParticipantStatus.READY).length,
        finished_count: room.status === CompetitionStatus.FINISHED ? room.participants.length : 0,
        winner_name: winner?.user.name || null,
        tournament: room.tournament,
      };
    });
  }

  async listPublicTournaments(userId: string) {
    await this.ensureTournamentRooms();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { university: true, faculty: true, department: true },
    });
    const tournaments = await prisma.tournament.findMany({
      where: {
        status: {
          in: [TournamentStatus.PUBLISHED, TournamentStatus.LIVE],
        },
        OR: [
          { audience_scope: 'EVERYONE' as any },
          ...(user?.university ? [{ audience_scope: 'UNIVERSITY' as any, audience_university: user.university }] : []),
          ...(user?.faculty ? [{ audience_scope: 'FACULTY' as any, audience_faculty: user.faculty }] : []),
          ...(user?.department ? [{ audience_scope: 'DEPARTMENT' as any, audience_department: user.department }] : []),
        ],
      },
      include: {
        entries: true,
        stages: { include: { participants: true } },
        interests: true,
        predictions: true,
        cheers: true,
        rooms: {
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
        stages: { include: { participants: true } },
        interests: true,
        predictions: true,
        cheers: true,
        rooms: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!tournament) throw new Error('Tournament not found');
    if (tournament.status !== TournamentStatus.PUBLISHED && tournament.status !== TournamentStatus.LIVE) {
      throw new Error('Tournament is not open for registration');
    }
    if (tournament.registration_closes_at && tournament.registration_closes_at.getTime() < Date.now()) {
      throw new Error('Tournament registration is closed');
    }
    if (tournament.late_join_cutoff_at && tournament.late_join_cutoff_at.getTime() < Date.now()) {
      throw new Error('Late join window has closed for this tournament');
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
          share_token: await this.generateUniqueShareToken(),
        },
      });
    } else if (!existing.share_token) {
      await prisma.tournamentEntry.update({
        where: { id: existing.id },
        data: { share_token: await this.generateUniqueShareToken() },
      });
    }

    const updated = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: true,
        stages: { include: { participants: true } },
        interests: true,
        predictions: true,
        cheers: true,
        rooms: {
          select: {
            id: true,
          },
        },
      },
    });

    return this.formatTournament(updated, userId);
  }

  async checkInTournament(userId: string, tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { entries: true, rooms: { select: { id: true } } },
    });

    if (!tournament) throw new Error('Tournament not found');
    const now = Date.now();
    if (tournament.check_in_opens_at && tournament.check_in_opens_at.getTime() > now) {
      throw new Error('Check-in has not opened yet');
    }
    if (tournament.check_in_closes_at && tournament.check_in_closes_at.getTime() < now) {
      throw new Error('Check-in is closed');
    }

    const existing = tournament.entries.find((entry) => entry.user_id === userId);
    if (!existing) throw new Error('Join the tournament before checking in');

    await prisma.tournamentEntry.update({
      where: { id: existing.id },
      data: { status: TournamentEntryStatus.CHECKED_IN, checked_in_at: new Date() },
    });

    const updated = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: true,
        stages: { include: { participants: true } },
        interests: true,
        predictions: true,
        cheers: true,
        rooms: { select: { id: true } },
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
        stages: { include: { participants: true } },
        interests: true,
        predictions: true,
        cheers: true,
        rooms: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!tournament) throw new Error('Tournament not found');
    return this.formatTournament(tournament, userId);
  }

  async registerTournamentInterest(
    userId: string,
    tournamentId: string,
    interestType: TournamentInterestType,
    supportingUserId?: string,
  ) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: true,
        stages: { include: { participants: true } },
        interests: true,
        predictions: true,
        cheers: true,
        rooms: { select: { id: true } },
      },
    });

    if (!tournament) throw new Error('Tournament not found');
    if (tournament.status !== TournamentStatus.PUBLISHED && tournament.status !== TournamentStatus.LIVE) {
      throw new Error('Campaign is not open yet');
    }

    await prisma.tournamentSpectatorInterest.upsert({
      where: {
        tournament_id_user_id_interest_type: {
          tournament_id: tournamentId,
          user_id: userId,
          interest_type: interestType,
        },
      },
      update: {
        supporting_user_id: supportingUserId || null,
      },
      create: {
        tournament_id: tournamentId,
        user_id: userId,
        interest_type: interestType,
        supporting_user_id: supportingUserId || null,
      },
    });

    const updated = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: true,
        stages: { include: { participants: true } },
        interests: true,
        predictions: true,
        cheers: true,
        rooms: { select: { id: true } },
      },
    });

    return this.formatTournament(updated, userId);
  }

  async submitTournamentPrediction(
    userId: string,
    tournamentId: string,
    predictedUserId: string,
    stageId?: string,
  ) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: true,
        stages: { include: { participants: true } },
      },
    });

    if (!tournament) throw new Error('Tournament not found');
    if (!tournament.prediction_enabled) throw new Error('Predictions are not enabled for this campaign');
    if (tournament.prediction_closes_at && tournament.prediction_closes_at.getTime() <= Date.now()) {
      throw new Error('Prediction window has closed');
    }

    const isParticipant = tournament.entries.some((entry) => entry.user_id === predictedUserId)
      || tournament.stages.some((stage) => stage.participants.some((participant) => participant.user_id === predictedUserId));
    if (!isParticipant) throw new Error('You can only predict a registered campaign participant');

    const existingPrediction = await prisma.tournamentPrediction.findFirst({
      where: {
        tournament_id: tournamentId,
        stage_id: stageId || null,
        user_id: userId,
      },
      select: { id: true },
    });

    if (existingPrediction) {
      await prisma.tournamentPrediction.update({
        where: { id: existingPrediction.id },
        data: {
          predicted_user_id: predictedUserId,
          status: TournamentPredictionStatus.OPEN,
          locked_at: null,
        },
      });
    } else {
      await prisma.tournamentPrediction.create({
        data: {
          tournament_id: tournamentId,
          stage_id: stageId || null,
          user_id: userId,
          predicted_user_id: predictedUserId,
        },
      });
    }

    return this.getTournamentArena(userId, tournamentId);
  }

  async sendTournamentCheer(
    userId: string,
    tournamentId: string,
    participantUserId: string,
    stageId?: string,
  ) {
    if (userId === participantUserId) {
      throw new Error('You cannot cheer yourself');
    }

    const recentCheers = await prisma.tournamentCheer.aggregate({
      where: {
        tournament_id: tournamentId,
        spectator_user_id: userId,
        participant_user_id: participantUserId,
        created_at: {
          gte: new Date(Date.now() - 10_000),
        },
      },
      _sum: { amount: true },
    });

    if ((recentCheers._sum.amount || 0) >= 5) {
      throw new Error('Cheer limit reached. Try again in a few seconds');
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: true,
        stages: { include: { participants: true } },
      },
    });
    if (!tournament) throw new Error('Tournament not found');

    const isParticipant = tournament.entries.some((entry) => entry.user_id === participantUserId)
      || tournament.stages.some((stage) => stage.participants.some((participant) => participant.user_id === participantUserId));
    if (!isParticipant) throw new Error('You can only cheer a campaign participant');

    await prisma.tournamentCheer.create({
      data: {
        tournament_id: tournamentId,
        stage_id: stageId || null,
        spectator_user_id: userId,
        participant_user_id: participantUserId,
        amount: 1,
      },
    });

    emitToUser(participantUserId, 'tournament:cheer', {
      tournamentId,
      stageId: stageId || null,
      spectatorUserId: userId,
    });

    return this.getTournamentArena(userId, tournamentId);
  }

  async getTournamentArena(userId: string, tournamentId: string): Promise<TournamentArenaView> {
    await this.ensureTournamentRooms();
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                university: true,
                department: true,
              },
            },
          },
        },
        stages: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    university: true,
                    department: true,
                  },
                },
              },
            },
          },
          orderBy: { stage_order: 'asc' },
        },
        interests: true,
        predictions: true,
        cheers: true,
        rooms: { select: { id: true } },
      },
    });

    if (!tournament) throw new Error('Tournament not found');

    const currentStage = tournament.stages.find((stage) => stage.status === TournamentStageStatus.LIVE)
      || tournament.stages.find((stage) => stage.status === TournamentStageStatus.CHECK_IN)
      || tournament.stages.find((stage) => stage.status === TournamentStageStatus.SCHEDULED)
      || null;

    const sourceParticipants = currentStage?.participants.length
      ? currentStage.participants
      : tournament.entries.map((entry) => ({
          user_id: entry.user_id,
          score: 0,
          correct_answers: 0,
          wrong_answers: 0,
          average_response_ms: null,
          rank: null,
          qualified: false,
          user: entry.user,
        }));

    const loveCounts = tournament.cheers.reduce<Record<string, number>>((acc, cheer) => {
      acc[cheer.participant_user_id] = (acc[cheer.participant_user_id] || 0) + (cheer.amount || 1);
      return acc;
    }, {});
    const predictionCounts = tournament.predictions.reduce<Record<string, number>>((acc, prediction) => {
      acc[prediction.predicted_user_id] = (acc[prediction.predicted_user_id] || 0) + 1;
      return acc;
    }, {});

    const leaderboard = sourceParticipants
      .map((participant: any) => ({
        user_id: participant.user_id,
        display_name: this.publicContestantName(participant.user, tournament.audience_scope),
        score: participant.score || 0,
        correct_answers: participant.correct_answers || 0,
        average_response_ms: participant.average_response_ms ?? null,
        rank: participant.rank ?? null,
        qualified: !!participant.qualified,
        love_count: loveCounts[participant.user_id] || 0,
        prediction_count: predictionCounts[participant.user_id] || 0,
      }))
      .sort((a, b) => {
        if ((a.rank || 0) && (b.rank || 0)) return (a.rank || 0) - (b.rank || 0);
        if (b.score !== a.score) return b.score - a.score;
        if ((a.average_response_ms || Number.MAX_SAFE_INTEGER) !== (b.average_response_ms || Number.MAX_SAFE_INTEGER)) {
          return (a.average_response_ms || Number.MAX_SAFE_INTEGER) - (b.average_response_ms || Number.MAX_SAFE_INTEGER);
        }
        return b.love_count - a.love_count;
      });

    return {
      tournament: this.formatTournament(tournament, userId),
      current_stage: currentStage ? this.formatTournamentStage(currentStage) : null,
      stage_tracker: tournament.stages.map((stage) => this.formatTournamentStage(stage)),
      leaderboard,
      stats: {
        participants: tournament.entries.length,
        spectators: tournament.interests.filter((interest) => interest.interest_type === TournamentInterestType.SPECTATOR).length,
        total_loves: tournament.cheers.reduce((sum, cheer) => sum + (cheer.amount || 1), 0),
        predictions: tournament.predictions.length,
      },
    };
  }
}
