import { Request, Response } from 'express';
import { SessionsService } from './sessions.service';

const sessionsService = new SessionsService();

export class SessionsController {
  async start(req: Request, res: Response) {
    try {
      const session = await sessionsService.startSession(req.user!.userId, req.body);
      res.status(201).json(session);
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const sessions = await sessionsService.listSessions(req.user!.userId);
      res.status(200).json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const session = await sessionsService.getSession(req.params.id);
      res.status(200).json(session);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async end(req: Request, res: Response) {
    try {
      const session = await sessionsService.endSession(req.params.id);
      res.status(200).json(session);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getMessages(req: Request, res: Response) {
    try {
      const messages = await sessionsService.listMessages(req.params.id);
      res.status(200).json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const message = await sessionsService.sendMessage(req.user!.userId, req.params.id, req.body);
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async sendPhotoMessage(req: Request, res: Response) {
    try {
      const result = await sessionsService.sendPhotoMessage(
        req.user!.userId,
        req.params.id,
        req.file!,
        req.body,
      );
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getSummary(req: Request, res: Response) {
    try {
      const summary = await sessionsService.getSessionSummary(req.params.id);
      res.status(200).json(summary);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
}
