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

  async trackEvent(req: Request, res: Response) {
    try {
      const forwardedFor = req.get('x-forwarded-for');
      const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : req.ip || null;

      const result = await waitlistService.trackEvent(req.body, {
        userAgent: req.get('user-agent') || null,
        referrer: req.get('referer') || null,
        ip,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Could not track waitlist event.' });
    }
  }
}

export const waitlistController = new WaitlistController();
