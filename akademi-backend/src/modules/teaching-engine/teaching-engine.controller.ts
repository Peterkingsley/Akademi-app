import { Request, Response } from 'express';
import { TeachingCallFailureError, teachingEngineService } from './teaching-engine.service';

export class TeachingEngineController {
  async createEpisode(req: Request, res: Response) {
    try {
      const episode = await teachingEngineService.generate(req.user!.userId, req.body || {});
      res.status(201).json(episode);
    } catch (error: any) {
      const message = error?.message || 'Could not generate the teaching episode.';
      const status = message.includes('not found') ? 404 : message.includes('fidelity gate') ? 422 : 400;
      const exposeDiagnostic = process.env.TEACHING_ENGINE_LIVE_VALIDATION === 'true' && error instanceof TeachingCallFailureError;
      // Raw model output is only ever made available to the separately-run,
      // development-fixture validation process. It is never a normal API error.
      const exposeRawValidationResponse = exposeDiagnostic
        && process.env.TEACHING_ENGINE_LIVE_VALIDATION_EXPOSE_RAW_CALL_1_RESPONSE === 'true';
      res.status(status).json({
        message,
        ...(exposeDiagnostic ? { diagnostic: error.diagnostic } : {}),
        ...(exposeRawValidationResponse ? { raw_response: error.rawResponse } : {}),
      });
    }
  }
}
