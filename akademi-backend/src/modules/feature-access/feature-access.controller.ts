import { Request, Response } from 'express';
import crypto from 'crypto';
import { FeatureAccessService } from './feature-access.service';
import { Feature, AccessType } from '@prisma/client';
import { config } from '../../config/env';
import { timingSafeEqual } from '../../shared/utils/secure-compare';

const featureAccessService = new FeatureAccessService();

export class FeatureAccessController {
  async getProducts(req: Request, res: Response) {
    try {
      res.status(200).json(featureAccessService.getProducts());
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch pass products' });
    }
  }

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
      const { feature, access_type, amount, productCode, scopeType, scopeId } = req.body;
      const userId = (req.user as any).userId;
      const result = await featureAccessService.initiatePurchase(
        userId,
        feature as Feature,
        access_type as AccessType,
        amount,
        productCode,
        scopeType,
        scopeId
      );
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to initiate purchase' });
    }
  }

  async checkFeature(req: Request, res: Response) {
    try {
      const { feature } = req.params;
      const { scopeType, scopeId } = req.query;
      const userId = (req.user as any).userId;
      const access = await featureAccessService.checkAccess(
        userId,
        feature as Feature,
        scopeType as string | undefined,
        scopeId as string | undefined
      );
      res.status(200).json(access);
    } catch (error) {
      res.status(500).json({ message: 'Failed to check access' });
    }
  }

  async webhook(req: Request, res: Response) {
    // Fail closed: if the webhook secret is not configured we cannot verify the
    // signature, so we must never process the event (otherwise an attacker
    // could forge a valid HMAC using the empty-string key).
    if (!config.paystackWebhookSecret) {
      console.error('PAYSTACK_WEBHOOK_SECRET is not set; rejecting webhook.');
      return res.status(503).send('Webhook not configured');
    }

    const signature = req.headers['x-paystack-signature'];
    const hash = crypto
      .createHmac('sha512', config.paystackWebhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (typeof signature !== 'string' || !timingSafeEqual(hash, signature)) {
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      const { reference, customer, metadata } = event.data;
      try {
        await featureAccessService.activateAccess(reference, customer?.email, metadata);
      } catch (error: any) {
        // Do not grant access when the referenced transaction cannot be
        // verified. Ack with 200 so Paystack does not retry a request we have
        // deliberately rejected.
        console.warn('Paystack webhook activation rejected:', error?.message);
        return res.status(200).send('Webhook received');
      }
    }

    res.status(200).send('Webhook received');
  }
}
