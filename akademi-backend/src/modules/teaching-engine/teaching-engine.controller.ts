import { Request, Response } from 'express';
import { teachingEngineService } from './teaching-engine.service';

export class TeachingEngineController {
  async createEpisode(req: Request, res: Response) {
    try {
      const episode = await teachingEngineService.generate(req.user!.userId, req.body || {});
      res.status(201).json(episode);
    } catch (error: any) {
      const message = error?.message || 'Could not generate the teaching episode.';
      const status = message.includes('not found') ? 404 : message.includes('fidelity gate') ? 422 : 400;
      res.status(status).json({ message });
    }
  }
}
