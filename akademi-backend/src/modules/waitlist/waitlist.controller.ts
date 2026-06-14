import { Request, Response } from 'express';
import { waitlistService } from './waitlist.service';

export class WaitlistController {
  async join(req: Request, res: Response) {
    try {
      const result = await waitlistService.join({
        ...req.body,
        metadata: {
          ...(req.body.metadata || {}),
          user_agent: req.get('user-agent') || null,
          referrer: req.get('referer') || null,
        },
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Could not join waitlist.' });
    }
  }
}

export const waitlistController = new WaitlistController();
