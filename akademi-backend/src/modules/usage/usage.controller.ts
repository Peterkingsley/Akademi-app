import { Request, Response } from 'express';
import { UsageMetric } from '@prisma/client';
import { usageService } from './usage.service';

export class UsageController {
  summary = async (req: Request, res: Response) => res.json(await usageService.getSummary(req.user!.userId));
  tutorHeartbeat = async (req: Request, res: Response) => {
    try {
      const seconds = Math.min(Math.max(Number(req.body?.seconds) || 30, 1), 60);
      res.json(await usageService.consume(req.user!.userId, UsageMetric.AI_TUTOR_SECONDS, Math.floor(seconds)));
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ message: error.message, reason: error.reason });
    }
  };
}
