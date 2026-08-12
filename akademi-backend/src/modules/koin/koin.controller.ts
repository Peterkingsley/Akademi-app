import { Request, Response } from 'express';
import { koinService } from './koin.service';

export class KoinController {
  wallet = async (req: Request, res: Response) => {
    try { res.json(await koinService.getWallet((req.user as any).userId)); }
    catch (error: any) { res.status(400).json({ message: error.message || 'Unable to load Koin wallet' }); }
  };
  packages = async (_req: Request, res: Response) => { res.json(koinService.getPurchasePackages()); };
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
