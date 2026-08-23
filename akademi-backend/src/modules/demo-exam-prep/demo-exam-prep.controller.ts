import { Request, Response } from 'express';
import { demoExamPrepService } from './demo-exam-prep.service';

function publicError(res: Response, error: any, fallback: string) {
  const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
  return res.status(status).json({
    message: status >= 500 ? fallback : error.message || fallback,
    code: typeof error?.code === 'string' ? error.code : 'DEMO_UNAVAILABLE',
  });
}

export class DemoExamPrepController {
  async materials(_req: Request, res: Response) {
    try {
      return res.status(200).json(await demoExamPrepService.listMaterials());
    } catch (error) {
      return publicError(res, error, "Akademi couldn't load the demo materials right now. Try again.");
    }
  }

  async start(req: Request, res: Response) {
    try {
      return res.status(201).json(await demoExamPrepService.startSession(req.body?.materialId));
    } catch (error) {
      return publicError(res, error, "Akademi couldn't load this question right now. Try again.");
    }
  }

  async session(req: Request, res: Response) {
    try {
      return res.status(200).json(await demoExamPrepService.getSession(req.params.sessionId));
    } catch (error) {
      return publicError(res, error, "Akademi couldn't restore this demo right now. Try again.");
    }
  }

  async submit(req: Request, res: Response) {
    try {
      return res.status(200).json(await demoExamPrepService.submit(
        req.params.sessionId,
        req.params.questionId,
        req.body,
      ));
    } catch (error) {
      return publicError(res, error, "Akademi couldn't check your reasoning right now. Try again.");
    }
  }

  async retry(req: Request, res: Response) {
    try {
      return res.status(200).json(await demoExamPrepService.retry(req.params.sessionId, req.params.questionId));
    } catch (error) {
      return publicError(res, error, "Akademi couldn't prepare a similar question right now.");
    }
  }

  async next(req: Request, res: Response) {
    try {
      const questionId = typeof req.body?.questionId === 'string' ? req.body.questionId : '';
      if (!questionId) {
        return res.status(400).json({ message: 'Completed question is required.', code: 'DEMO_QUESTION_REQUIRED' });
      }
      return res.status(200).json(await demoExamPrepService.next(req.params.sessionId, questionId));
    } catch (error) {
      return publicError(res, error, "Akademi couldn't continue this demo right now. Try again.");
    }
  }
}
