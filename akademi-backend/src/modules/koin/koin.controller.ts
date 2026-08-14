import { Request, Response } from 'express';
import crypto from 'crypto';
import { koinService } from './koin.service';
import { config } from '../../config/env';
import { timingSafeEqual } from '../../shared/utils/secure-compare';

export class KoinController {
  wallet = async (req: Request, res: Response) => {
    try { res.json(await koinService.getWallet((req.user as any).userId)); }
    catch (error: any) { res.status(400).json({ message: error.message || 'Unable to load Koin wallet' }); }
  };
  packages = async (_req: Request, res: Response) => { res.json(koinService.getPurchasePackages()); };
  purchase = async (req: Request, res: Response) => {
    try { res.status(201).json(await koinService.initiatePurchase((req.user as any).userId, Number(req.body.koinAmount))); }
    catch (error: any) { res.status(400).json({ message: error.message || 'Unable to start Koin purchase' }); }
  };
  verifyPurchase = async (req: Request, res: Response) => {
    try { res.json(await koinService.verifyAndCreditPurchase(req.params.reference, (req.user as any).userId)); }
    catch (error: any) { res.status(400).json({ message: error.message || 'Unable to verify Koin purchase' }); }
  };
  koraWebhook = async (req: Request, res: Response) => {
    if (!config.koraSecretKey) return res.status(503).send('Webhook not configured');
    const signature = req.headers['x-korapay-signature'];
    const data = req.body?.data;
    const hash = crypto.createHmac('sha256', config.koraSecretKey).update(JSON.stringify(data || {})).digest('hex');
    if (typeof signature !== 'string' || !timingSafeEqual(hash, signature)) return res.status(401).send('Invalid signature');

    const purchaseReference = data?.payment_reference || data?.reference;
    try {
      if (req.body?.event === 'charge.success' && data?.status === 'success') {
        await koinService.verifyAndCreditPurchase(purchaseReference);
      } else if (req.body?.event === 'charge.failed') {
        await koinService.markPurchaseFailed(purchaseReference);
      }
    } catch (error: any) {
      console.warn('Kora Koin webhook processing deferred:', error?.message);
      return res.status(200).send('Webhook received; purchase requires verification');
    }
    return res.status(200).send('Webhook received');
  };
  reward = async (req: Request, res: Response) => {
    try { res.json(await koinService.rewardPlayer((req.user as any).userId, req.body.recipientUserId, Number(req.body.amount), req.body.message)); }
    catch (error: any) { res.status(400).json({ message: error.message || 'Unable to send Koin' }); }
  };
  competitionPool = async (req: Request, res: Response) => {
    try { res.json(await koinService.getOrCreatePool({ competitionId: req.params.id })); }
    catch (error: any) { res.status(400).json({ message: error.message || 'Unable to open Koin pool' }); }
  };
  tournamentPool = async (req: Request, res: Response) => {
    try { res.json(await koinService.getOrCreatePool({ tournamentId: req.params.id })); }
    catch (error: any) { res.status(400).json({ message: error.message || 'Unable to open Koin pool' }); }
  };
  contribute = async (req: Request, res: Response) => {
    try { res.json(await koinService.contribute((req.user as any).userId, req.params.poolId, Number(req.body.amount), Boolean(req.body.isStake))); }
    catch (error: any) { res.status(400).json({ message: error.message || 'Unable to contribute Koin' }); }
  };
  withdraw = async (req: Request, res: Response) => {
    try { res.status(201).json(await koinService.requestWithdrawal((req.user as any).userId, Number(req.body.koinAmount))); }
    catch (error: any) { res.status(400).json({ message: error.message || 'Unable to request withdrawal' }); }
  };
}
