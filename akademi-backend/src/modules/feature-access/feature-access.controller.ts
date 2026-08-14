import { Request, Response } from 'express';
import crypto from 'crypto';
import { FeatureAccessService } from './feature-access.service';
import { Feature, AccessType } from '@prisma/client';
import { config } from '../../config/env';
import { timingSafeEqual } from '../../shared/utils/secure-compare';
import { koinService } from '../koin/koin.service';

const featureAccessService = new FeatureAccessService();

export class FeatureAccessController {
  async initiateKoraSubscription(req: Request, res: Response) {
    try {
      const requested = req.body?.billingCycle;
      const billingCycle = requested === 'weekly' || requested === 'four_month' ? requested : 'monthly';
      res.json(await featureAccessService.initiateKoraSubscription((req.user as any).userId, billingCycle));
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Unable to initialize Kora checkout' });
    }
  }

  async verifyKoraSubscription(req: Request, res: Response) {
    try {
      res.json(await featureAccessService.verifyKoraSubscriptionForUser((req.user as any).userId, req.body?.reference));
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Payment has not been confirmed' });
    }
  }

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

  async koraWebhook(req: Request, res: Response) {
    if (!config.koraSecretKey) {
      console.error('KORA_SECRET_KEY is not set; rejecting Kora webhook.');
      return res.status(503).send('Webhook not configured');
    }

    const signature = req.headers['x-korapay-signature'];
    const data = req.body?.data;
    const hash = crypto
      .createHmac('sha256', config.koraSecretKey)
      .update(JSON.stringify(data || {}))
      .digest('hex');

    if (typeof signature !== 'string' || !timingSafeEqual(hash, signature)) {
      return res.status(401).send('Invalid signature');
    }

    if (req.body?.event === 'charge.success' && data?.status === 'success') {
      const reference = data?.payment_reference || data?.reference;
      try {
        // One Kora account has one dashboard webhook. Route by our server-created
        // reference, then independently verify the charge before delivering value.
        if (typeof reference === 'string' && reference.startsWith('KOIN_')) {
          await koinService.verifyAndCreditPurchase(reference);
        } else {
          await featureAccessService.verifyAndActivateKoraSubscription(reference);
        }
      } catch (error: any) {
        console.warn('Kora webhook activation rejected:', error?.message);
        return res.status(200).send('Webhook received; activation requires review');
      }
    } else if (req.body?.event === 'charge.failed') {
      const reference = data?.payment_reference || data?.reference;
      if (typeof reference === 'string' && reference.startsWith('KOIN_')) {
        await koinService.markPurchaseFailed(reference);
      }
    }

    return res.status(200).send('Webhook received');
  }
}
