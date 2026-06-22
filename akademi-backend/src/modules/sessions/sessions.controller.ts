import { aiService } from "../ai/ai.service";
import { Request, Response } from 'express';
import { SessionsService } from './sessions.service';

const sessionsService = new SessionsService();

function statusForError(error: any, fallbackStatus = 400) {
  const message = error?.message || '';
  if (message.includes('AI tutor is temporarily busy')) return 503;
  return fallbackStatus;
}

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

  async getTutorVisualAsset(req: Request, res: Response) {
    try {
      const asset = await sessionsService.getTutorVisualAsset(req.user!.userId, req.params.id);
      res.status(200).json(asset);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const message = await sessionsService.sendMessage(req.user!.userId, req.params.id, req.body);
      res.status(201).json(message);
    } catch (error: any) {
      res.status(statusForError(error)).json({ message: error.message });
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
      res.status(statusForError(error)).json({ message: error.message });
    }
  }

  async extractDocument(req: Request, res: Response) {
    try {
      const result = await sessionsService.extractDocumentText(req.file!);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(statusForError(error)).json({ message: error.message });
    }
  }

  async transcribeAudio(req: Request, res: Response) {
    try {
      const result = await sessionsService.transcribeAudio(req.file!);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(statusForError(error)).json({ message: error.message });
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
  async getPlayableLesson(req: Request, res: Response) {
    try {
      const lesson = await sessionsService.getPlayableLesson(req.params.id);
      res.status(200).json(lesson);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async generateTeaching(req: Request, res: Response) {
    try {
      const lesson = await aiService.generateTeachingLesson(
        req.user!.userId,
        req.params.id,
        req.body.studentMessage,
        req.body.materialContext
      );
      res.status(200).json(lesson);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
