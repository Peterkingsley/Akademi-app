import { Request, Response } from 'express';
import { CompetitionParticipantStatus, TournamentInterestType } from '@prisma/client';
import { CompetitionsService } from './competitions.service';

const competitionsService = new CompetitionsService();

export class CompetitionsController {
  async create(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const room = await competitionsService.createRoom(userId, req.body);
      res.status(201).json(room);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to create competition room' });
    }
  }

  async join(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const room = await competitionsService.joinRoom(userId, req.body.code, req.body.course_code);
      res.status(200).json(room);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to join competition room' });
    }
  }

  async getMine(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const rooms = await competitionsService.listMyRooms(userId);
      res.status(200).json(rooms);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch competitions' });
    }
  }

  async getPublic(req: Request, res: Response) {
    try {
      const rooms = await competitionsService.listPublicRooms();
      res.status(200).json(rooms);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch public competitions' });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const room = await competitionsService.getLobby(userId, req.params.id);
      res.status(200).json(room);
    } catch (error: any) {
      res.status(404).json({ message: error.message || 'Competition room not found' });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const status = req.body.status as CompetitionParticipantStatus;
      const room = await competitionsService.updateParticipantStatus(userId, req.params.id, status);
      res.status(200).json(room);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to update competition status' });
    }
  }

  async getSummary(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const summary = await competitionsService.getSummary(userId);
      res.status(200).json(summary);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch competition summary' });
    }
  }

  async getLeaderboard(req: Request, res: Response) {
    try {
      const leaderboard = await competitionsService.getLeaderboard();
      res.status(200).json(leaderboard);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  }

  async getTournaments(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const tournaments = await competitionsService.listPublicTournaments(userId);
      res.status(200).json(tournaments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch tournaments' });
    }
  }

  async joinTournament(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const tournament = await competitionsService.joinTournament(userId, req.params.id);
      res.status(200).json(tournament);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to join tournament' });
    }
  }

  async checkInTournament(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const tournament = await competitionsService.checkInTournament(userId, req.params.id);
      res.status(200).json(tournament);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to check in to tournament' });
    }
  }

  async getTournament(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const tournament = await competitionsService.getTournament(userId, req.params.id);
      res.status(200).json(tournament);
    } catch (error: any) {
      res.status(404).json({ message: error.message || 'Tournament not found' });
    }
  }

  async getTournamentArena(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const arena = await competitionsService.getTournamentArena(userId, req.params.id);
      res.status(200).json(arena);
    } catch (error: any) {
      res.status(404).json({ message: error.message || 'Tournament arena not found' });
    }
  }

  async registerTournamentInterest(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const interestType = req.body.interest_type as TournamentInterestType;
      if (!Object.values(TournamentInterestType).includes(interestType)) {
        res.status(400).json({ message: 'Invalid interest type' });
        return;
      }
      const tournament = await competitionsService.registerTournamentInterest(
        userId,
        req.params.id,
        interestType,
        req.body.supporting_user_id,
      );
      res.status(200).json(tournament);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to register campaign interest' });
    }
  }

  async submitTournamentPrediction(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const arena = await competitionsService.submitTournamentPrediction(
        userId,
        req.params.id,
        req.body.predicted_user_id,
        req.body.stage_id,
      );
      res.status(200).json(arena);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to submit prediction' });
    }
  }

  async sendTournamentCheer(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const arena = await competitionsService.sendTournamentCheer(
        userId,
        req.params.id,
        req.body.participant_user_id,
        req.body.stage_id,
      );
      res.status(200).json(arena);
    } catch (error: any) {
      res.status(429).json({ message: error.message || 'Failed to send cheer' });
    }
  }
}
