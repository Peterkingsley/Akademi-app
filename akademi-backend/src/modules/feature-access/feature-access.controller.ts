import { Request, Response } from 'express';
import crypto from 'crypto';
import { FeatureAccessService } from './feature-access.service';
import { Feature, AccessType } from '@prisma/client';
import { config } from '../../config/env';

const featureAccessService = new FeatureAccessService();

export class FeatureAccessController {
  async getActiveUnlocks(req: Request, res: Response) {
    try {
      const userId = (req.user as any).userId;
      const unlocks = await featureAccessService.getActiveUnlocks(userId);
      res.status(200).json(unlocks);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch unlocks' });
    }
  }

  async purchase(req: Request, res: Response) {
    try {
      const { feature, access_type, amount } = req.body;
      const userId = (req.user as any).userId;
      const result = await featureAccessService.initiatePurchase(userId, feature as Feature, access_type as AccessType, amount);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: 'Failed to initiate purchase' });
    }
  }

  async checkFeature(req: Request, res: Response) {
    try {
      const { feature } = req.params;
      const userId = (req.user as any).userId;
      const access = await featureAccessService.checkAccess(userId, feature as Feature);
      res.status(200).json(access);
    } catch (error) {
      res.status(500).json({ message: 'Failed to check access' });
    }
  }

  async webhook(req: Request, res: Response) {
    const hash = crypto
      .createHmac('sha512', config.paystackWebhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      const { reference, customer } = event.data;
      await featureAccessService.activateAccess(reference, customer.email);
    }

    res.status(200).send('Webhook received');
  }
}
