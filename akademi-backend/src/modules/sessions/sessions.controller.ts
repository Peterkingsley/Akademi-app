import { Request, Response } from 'express';
import { SessionsService } from './sessions.service';

const sessionsService = new SessionsService();

function statusForError(error: any, fallbackStatus = 400) {
  const message = error?.message || '';
  if (message.includes('AI is temporarily busy')) return 503;
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
      const session = await sessionsService.getSession(req.params.id, req.user!.userId);
      res.status(200).json(session);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async end(req: Request, res: Response) {
    try {
      const session = await sessionsService.endSession(req.params.id, req.user!.userId);
      res.status(200).json(session);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getMessages(req: Request, res: Response) {
    try {
      const messages = await sessionsService.listMessages(req.params.id, req.user!.userId);
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

  async solveQuestion(req: Request, res: Response) {
    try {
      const questionIndex = Number(req.params.index);
      if (!Number.isInteger(questionIndex) || questionIndex < 0) {
        res.status(400).json({ message: 'Invalid question index' });
        return;
      }

      const result = await sessionsService.solveQuestionAtIndex(
        req.user!.userId,
        req.params.id,
        questionIndex,
      );
      res.status(201).json(result);
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

  async synthesizeTutorSpeech(req: Request, res: Response) {
    try {
      const result = await sessionsService.synthesizeTutorSpeech(req.body?.text || '');
      res.status(200).json(result);
    } catch (error: any) {
      res.status(statusForError(error, 503)).json({ message: error.message });
    }
  }

  async createTutorSpeechStream(req: Request, res: Response) {
    try {
      const result = await sessionsService.createTutorSpeechStream(
        req.user!.userId,
        req.params.id,
        req.body?.text || '',
      );
      res.status(201).json(result);
    } catch (error: any) {
      res.status(statusForError(error, 503)).json({ message: error.message });
    }
  }

  async streamTutorSpeech(req: Request, res: Response) {
    try {
      await sessionsService.streamTutorSpeech(
        req.user!.userId,
        req.params.id,
        req.params.streamId,
        res,
      );
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(statusForError(error, 503)).json({ message: error.message });
      }
    }
  }

  async getSummary(req: Request, res: Response) {
    try {
      const summary = await sessionsService.getSessionSummary(req.params.id, req.user!.userId);
      res.status(200).json(summary);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async getCompanionState(req: Request, res: Response) {
    try {
      const state = await sessionsService.getCompanionState(req.params.id, req.user!.userId);
      res.status(200).json(state);
    } catch (error: any) {
      res.status(statusForError(error, 404)).json({ message: error.message });
    }
  }

  async getVisualPlan(req: Request, res: Response) {
    try {
      const visualPlan = await sessionsService.getVisualPlan(
        req.params.id,
        { userId: req.user!.userId, email: req.user!.email },
      );
      res.status(200).json(visualPlan);
    } catch (error: any) {
      res.status(statusForError(error, 403)).json({ message: error.message });
    }
  }

  async listTutorTraces(req: Request, res: Response) {
    try {
      const traces = await sessionsService.listTutorTraces(
        req.params.id,
        { userId: req.user!.userId, email: req.user!.email },
        req.query as any,
      );
      res.status(200).json(traces);
    } catch (error: any) {
      res.status(statusForError(error, 403)).json({ message: error.message });
    }
  }

  async getTutorTraceSummary(req: Request, res: Response) {
    try {
      const summary = await sessionsService.getTutorTraceSummary(
        req.params.id,
        { userId: req.user!.userId, email: req.user!.email },
      );
      res.status(200).json(summary);
    } catch (error: any) {
      res.status(statusForError(error, 403)).json({ message: error.message });
    }
  }

  async startCompanion(req: Request, res: Response) {
    try {
      const message = await sessionsService.startCompanion(req.params.id, req.user!.userId, req.body);
      res.status(201).json(message);
    } catch (error: any) {
      res.status(statusForError(error)).json({ message: error.message });
    }
  }

  async sendCompanionMessage(req: Request, res: Response) {
    try {
      const message = await sessionsService.sendCompanionMessage(
        req.user!.userId,
        req.params.id,
        req.body,
      );
      res.status(201).json(message);
    } catch (error: any) {
      res.status(statusForError(error)).json({ message: error.message });
    }
  }

  async handleCompanionTurn(req: Request, res: Response) {
    try {
      const message = await sessionsService.handleCompanionTurn(
        req.user!.userId,
        req.params.id,
        req.body,
      );
      res.status(201).json(message);
    } catch (error: any) {
      res.status(statusForError(error)).json({ message: error.message });
    }
  }
}
