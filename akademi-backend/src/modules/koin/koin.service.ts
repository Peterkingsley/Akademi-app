import crypto from 'crypto';
import prisma from '../../config/db';
import { config } from '../../config/env';

const MIN_WITHDRAWAL_KOIN = 1250;
const WITHDRAWAL_KOBO_PER_KOIN = 80;
const WINNER_SHARE_PERCENT = 80;
const MAX_REWARD_KOIN = 250;
const MAX_EVENT_CONTRIBUTION_KOIN = 1000;

const reference = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const ageOn = (birthDate: Date, today = new Date()) => {
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const month = today.getUTCMonth() - birthDate.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
};

export class KoinService {
  private async ensureWallet(tx: any, userId: string) {
    return tx.koinWallet.upsert({ where: { user_id: userId }, create: { user_id: userId }, update: {} });
  }

  private async debit(tx: any, userId: string, amount: number, type: string, entryReference: string, metadata: any = {}) {
    await this.ensureWallet(tx, userId);
    const changed = await tx.koinWallet.updateMany({
      where: { user_id: userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (changed.count !== 1) throw new Error('Insufficient Koin balance');
    const wallet = await tx.koinWallet.findUniqueOrThrow({ where: { user_id: userId } });
    await tx.koinLedgerEntry.create({
      data: { user_id: userId, type, amount: -amount, balance_after: wallet.balance, reference: entryReference, metadata },
    });
    return wallet;
  }

  private async credit(tx: any, userId: string, amount: number, type: string, entryReference: string, metadata: any = {}) {
    const wallet = await tx.koinWallet.upsert({
      where: { user_id: userId },
      create: { user_id: userId, balance: amount },
      update: { balance: { increment: amount } },
    });
    await tx.koinLedgerEntry.create({
      data: { user_id: userId, type, amount, balance_after: wallet.balance, reference: entryReference, metadata },
    });
    return wallet;
  }

  async getWallet(userId: string) {
    const wallet = await prisma.koinWallet.upsert({ where: { user_id: userId }, create: { user_id: userId }, update: {} });
    const [ledger, pendingWithdrawal] = await Promise.all([
      prisma.koinLedgerEntry.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, take: 30 }),
      prisma.koinWithdrawal.aggregate({
        where: { user_id: userId, status: { in: ['PENDING_VERIFICATION', 'PENDING', 'PROCESSING'] as any } },
        _sum: { koin_amount: true },
      }),
    ]);
    return {
      balance: wallet.balance,
      withdrawableNaira: Math.floor(wallet.balance * 0.8),
      pendingWithdrawalKoin: pendingWithdrawal._sum.koin_amount || 0,
      minimumWithdrawalKoin: MIN_WITHDRAWAL_KOIN,
      purchaseRate: { koin: 100, naira: 100 },
      withdrawalRate: { koin: 100, naira: 80 },
      ledger,
    };
  }

  async rewardPlayer(senderUserId: string, recipientUserId: string, amount: number, message?: string) {
    if (senderUserId === recipientUserId) throw new Error('You cannot reward yourself');
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_REWARD_KOIN) throw new Error(`Reward must be between 1 and ${MAX_REWARD_KOIN} Koin`);
    const recipient = await prisma.user.findFirst({ where: { id: recipientUserId, is_deleted: false, is_banned: false }, select: { id: true } });
    if (!recipient) throw new Error('Player not found');
    const rewardReference = reference('reward');
    return prisma.$transaction(async (tx) => {
      await this.debit(tx, senderUserId, amount, 'REWARD_SENT', `${rewardReference}_debit`, { recipientUserId });
      const wallet = await this.credit(tx, recipientUserId, amount, 'REWARD_RECEIVED', `${rewardReference}_credit`, { senderUserId });
      const reward = await tx.koinReward.create({
        data: { sender_user_id: senderUserId, recipient_user_id: recipientUserId, amount, message: message?.trim().slice(0, 160) || null, reference: rewardReference },
      });
      return { reward, senderBalance: (await tx.koinWallet.findUniqueOrThrow({ where: { user_id: senderUserId } })).balance, recipientBalance: wallet.balance };
    }, { isolationLevel: 'Serializable' as any });
  }

  async getOrCreatePool(owner: { competitionId?: string; tournamentId?: string }) {
    if (Boolean(owner.competitionId) === Boolean(owner.tournamentId)) throw new Error('Choose one competition or tournament');
    if (owner.competitionId) {
      const room = await prisma.competitionRoom.findUnique({ where: { id: owner.competitionId } });
      if (!room || room.visibility === 'PRIVATE') throw new Error('Koin pools are available for public competitions only');
      return prisma.koinPool.upsert({ where: { competition_id: owner.competitionId }, create: { competition_id: owner.competitionId }, update: {} });
    }
    const tournament = await prisma.tournament.findUnique({ where: { id: owner.tournamentId! } });
    if (!tournament || !['PUBLISHED', 'LIVE'].includes(tournament.status)) throw new Error('Public event is not accepting Koin');
    return prisma.koinPool.upsert({ where: { tournament_id: owner.tournamentId! }, create: { tournament_id: owner.tournamentId! }, update: {} });
  }

  async contribute(userId: string, poolId: string, amount: number, isStake = false) {
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_EVENT_CONTRIBUTION_KOIN) throw new Error(`Contribution must be between 1 and ${MAX_EVENT_CONTRIBUTION_KOIN} Koin`);
    const contributionReference = reference(isStake ? 'stake' : 'pool');
    return prisma.$transaction(async (tx) => {
      const pool = await tx.koinPool.findUnique({ where: { id: poolId }, include: { competition: true, tournament: true } });
      if (!pool || pool.status !== 'OPEN') throw new Error('This Koin pool is closed');
      if (pool.contributions_close_at && pool.contributions_close_at <= new Date()) throw new Error('Contributions are closed');
      if (pool.competition?.status === 'FINISHED' || pool.tournament?.status === 'COMPLETED') throw new Error('This event has ended');
      const previous = await tx.koinPoolContribution.aggregate({ where: { pool_id: poolId, user_id: userId }, _sum: { amount: true } });
      if ((previous._sum.amount || 0) + amount > MAX_EVENT_CONTRIBUTION_KOIN) throw new Error(`You can contribute at most ${MAX_EVENT_CONTRIBUTION_KOIN} Koin per event`);
      await this.debit(tx, userId, amount, isStake ? 'STAKE' : 'POOL_CONTRIBUTION', `${contributionReference}_debit`, { poolId });
      await tx.koinPoolContribution.create({ data: { pool_id: poolId, user_id: userId, amount, is_stake: isStake, reference: contributionReference } });
      return tx.koinPool.update({ where: { id: poolId }, data: { total_koin: { increment: amount } } });
    }, { isolationLevel: 'Serializable' as any });
  }

  async settlePool(poolId: string, winnerUserId: string) {
    return prisma.$transaction(async (tx) => {
      const pool = await tx.koinPool.findUnique({ where: { id: poolId } });
      if (!pool) return null;
      if (pool.status === 'SETTLED') return pool;
      if (!['OPEN', 'LOCKED'].includes(pool.status)) throw new Error('Pool cannot be settled');
      const winnerShare = Math.floor((pool.total_koin * WINNER_SHARE_PERCENT) / 100);
      const platformShare = pool.total_koin - winnerShare;
      if (winnerShare > 0) await this.credit(tx, winnerUserId, winnerShare, 'PRIZE_WIN', `prize_${pool.id}`, { poolId, platformShare });
      return tx.koinPool.update({
        where: { id: pool.id },
        data: { status: 'SETTLED', winner_user_id: winnerUserId, winner_share_koin: winnerShare, platform_share_koin: platformShare, settled_at: new Date() },
      });
    }, { isolationLevel: 'Serializable' as any });
  }

  async settleCompetitionPools(competitionId: string, tournamentId: string | null | undefined, winnerUserId: string) {
    const pools = await prisma.koinPool.findMany({ where: { OR: [{ competition_id: competitionId }, ...(tournamentId ? [{ tournament_id: tournamentId }] : [])] } });
    for (const pool of pools) await this.settlePool(pool.id, winnerUserId);
  }

  async requestWithdrawal(userId: string, koinAmount: number) {
    if (!Number.isInteger(koinAmount) || koinAmount < MIN_WITHDRAWAL_KOIN) throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL_KOIN} Koin`);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { date_of_birth: true } });
    if (!user?.date_of_birth) throw new Error('Add your date of birth before requesting a withdrawal');
    if (ageOn(user.date_of_birth) < 18) throw new Error('Koin withdrawals unlock when you turn 18');
    if (!config.koinWithdrawalsEnabled) throw new Error('Koin withdrawals are not available yet');
    const withdrawalReference = reference('withdrawal');
    return prisma.$transaction(async (tx) => {
      await this.debit(tx, userId, koinAmount, 'WITHDRAWAL', `${withdrawalReference}_debit`, { withdrawalReference });
      return tx.koinWithdrawal.create({
        data: { user_id: userId, koin_amount: koinAmount, naira_amount_kobo: koinAmount * WITHDRAWAL_KOBO_PER_KOIN, status: 'PENDING_VERIFICATION', reference: withdrawalReference },
      });
    }, { isolationLevel: 'Serializable' as any });
  }

  getPurchasePackages() {
    return [100, 500, 1000, 5000].map((koin) => ({ koin, naira: koin, enabled: config.koinPurchasesEnabled }));
  }
}

export const koinService = new KoinService();
