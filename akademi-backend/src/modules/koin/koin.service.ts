import crypto from 'crypto';
import prisma from '../../config/db';
import { config } from '../../config/env';

const MIN_WITHDRAWAL_KOIN = 1250;
const WITHDRAWAL_KOBO_PER_KOIN = 80;
const WINNER_SHARE_PERCENT = 80;
const MAX_REWARD_KOIN = 250;
const MAX_EVENT_CONTRIBUTION_KOIN = 1000;
const PURCHASE_PACKAGES = [100, 500, 1000, 5000] as const;
const KOBO_PER_KOIN = 100;
const KORA_API = 'https://api.korapay.com/merchant/api/v1';

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

  async listBanks() {
    if (!config.koraSecretKey) throw new Error('Kora payouts are not configured');
    const response = await fetch(`${KORA_API}/misc/banks?countryCode=NG`, {
      headers: { Authorization: `Bearer ${config.koraSecretKey}` },
    });
    const result: any = await response.json().catch(() => null);
    if (!response.ok || result?.status !== true || !Array.isArray(result?.data)) throw new Error(result?.message || 'Unable to load Nigerian banks');
    return result.data.map((bank: any) => ({ name: String(bank.name), code: String(bank.code), slug: String(bank.slug || '') }));
  }

  async resolveBankAccount(bankCode: string, accountNumber: string) {
    if (!config.koraSecretKey) throw new Error('Kora payouts are not configured');
    if (!/^\d{3,6}$/.test(bankCode)) throw new Error('Choose a valid bank');
    if (!/^\d{10}$/.test(accountNumber)) throw new Error('Enter a valid 10-digit account number');
    const response = await fetch(`${KORA_API}/misc/banks/resolve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.koraSecretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank: bankCode, account: accountNumber, currency: 'NG' }),
    });
    const result: any = await response.json().catch(() => null);
    if (!response.ok || result?.status !== true || !result?.data?.account_name) throw new Error(result?.message || 'Kora could not verify this account');
    return {
      bankName: String(result.data.bank_name || ''),
      bankCode: String(result.data.bank_code || bankCode),
      accountNumber: String(result.data.account_number || accountNumber),
      accountName: String(result.data.account_name),
    };
  }

  async requestWithdrawal(userId: string, koinAmount: number, bankCode: string, accountNumber: string) {
    if (!Number.isInteger(koinAmount) || koinAmount < MIN_WITHDRAWAL_KOIN) throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL_KOIN} Koin`);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { date_of_birth: true } });
    if (!user?.date_of_birth) throw new Error('Add your date of birth before requesting a withdrawal');
    if (ageOn(user.date_of_birth) < 18) throw new Error('Koin withdrawals unlock when you turn 18');
    if (!config.koinWithdrawalsEnabled) throw new Error('Koin withdrawals are not available yet');
    if (!config.koraSecretKey) throw new Error('Kora payouts are not configured');
    const account = await this.resolveBankAccount(bankCode, accountNumber);
    const customer = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!customer) throw new Error('User not found');
    const withdrawalReference = reference('withdrawal');
    const withdrawal = await prisma.$transaction(async (tx) => {
      await this.debit(tx, userId, koinAmount, 'WITHDRAWAL', `${withdrawalReference}_debit`, { withdrawalReference });
      return tx.koinWithdrawal.create({
        data: {
          user_id: userId,
          koin_amount: koinAmount,
          naira_amount_kobo: koinAmount * WITHDRAWAL_KOBO_PER_KOIN,
          status: 'PENDING',
          reference: withdrawalReference,
          payout_provider: 'korapay',
          payout_recipient: JSON.stringify({ bankName: account.bankName, bankCode: account.bankCode, accountName: account.accountName, accountLast4: account.accountNumber.slice(-4) }),
        },
      });
    }, { isolationLevel: 'Serializable' as any });

    const payoutPayload = {
      reference: withdrawalReference,
      destination: {
        type: 'bank_account',
        amount: withdrawal.naira_amount_kobo / 100,
        currency: 'NGN',
        narration: 'Akademi Koin sale',
        bank_account: { bank: account.bankCode, account: account.accountNumber },
        customer: { name: account.accountName || customer.name, email: customer.email },
      },
      metadata: { purpose: 'koin-sale', userId, koin: koinAmount },
      notification_url: `${config.publicApiUrl.replace(/\/$/, '')}/feature-access/kora/webhook`,
    };

    try {
      const response = await fetch(`${KORA_API}/transactions/disburse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.koraSecretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payoutPayload),
      });
      const result: any = await response.json().catch(() => null);
      if (!response.ok || result?.status !== true) {
        // Kora warns that 5xx/timeouts may still mean the payout was accepted. Keep
        // funds reserved and let webhook/reconciliation decide those uncertain cases.
        if (response.status >= 500) {
          await prisma.koinWithdrawal.update({ where: { id: withdrawal.id }, data: { status: 'PROCESSING', failure_reason: 'Payout confirmation pending' } });
          return { ...withdrawal, status: 'PROCESSING', account };
        }
        await this.failAndRefundWithdrawal(withdrawalReference, result?.message || 'Kora rejected payout');
        throw new Error(result?.message || 'Kora rejected payout');
      }
      const updated = await prisma.koinWithdrawal.update({
        where: { id: withdrawal.id },
        data: { status: result?.data?.status === 'success' ? 'PAID' : 'PROCESSING', provider_reference: String(result?.data?.reference || withdrawalReference), processed_at: result?.data?.status === 'success' ? new Date() : null },
      });
      return { ...updated, account };
    } catch (error: any) {
      if (error?.message === 'fetch failed' || error?.name === 'TypeError') {
        await prisma.koinWithdrawal.update({ where: { id: withdrawal.id }, data: { status: 'PROCESSING', failure_reason: 'Payout confirmation pending' } });
        return { ...withdrawal, status: 'PROCESSING', account };
      }
      throw error;
    }
  }

  async markWithdrawalPaid(withdrawalReference: string, amount: number, currency: string) {
    const withdrawal = await prisma.koinWithdrawal.findUnique({ where: { reference: withdrawalReference } });
    if (!withdrawal) return;
    if (currency !== 'NGN' || !Number.isFinite(amount) || amount !== withdrawal.naira_amount_kobo / 100) {
      throw new Error('Kora payout confirmation does not match the withdrawal');
    }
    await prisma.koinWithdrawal.updateMany({
      where: { reference: withdrawalReference, status: { in: ['PENDING_VERIFICATION', 'PENDING', 'PROCESSING'] } },
      data: { status: 'PAID', processed_at: new Date(), failure_reason: null },
    });
  }

  async failAndRefundWithdrawal(withdrawalReference: string, reason = 'Kora payout failed') {
    return prisma.$transaction(async (tx) => {
      const withdrawal = await tx.koinWithdrawal.findUnique({ where: { reference: withdrawalReference } });
      if (!withdrawal || ['FAILED', 'REJECTED', 'CANCELLED'].includes(withdrawal.status)) return withdrawal;
      if (withdrawal.status === 'PAID') return withdrawal;
      const claimed = await tx.koinWithdrawal.updateMany({
        where: { id: withdrawal.id, status: { in: ['PENDING_VERIFICATION', 'PENDING', 'PROCESSING'] } },
        data: { status: 'FAILED', failure_reason: reason, processed_at: new Date() },
      });
      if (claimed.count === 0) return withdrawal;
      await this.credit(tx, withdrawal.user_id, withdrawal.koin_amount, 'WITHDRAWAL_REFUND', `${withdrawal.reference}_refund`, { withdrawalReference });
      return tx.koinWithdrawal.findUnique({ where: { id: withdrawal.id } });
    }, { isolationLevel: 'Serializable' as any });
  }

  getPurchasePackages() {
    return PURCHASE_PACKAGES.map((koin) => ({ koin, naira: koin, enabled: config.koinPurchasesEnabled }));
  }

  async initiatePurchase(userId: string, koinAmount: number) {
    if (!config.koinPurchasesEnabled) throw new Error('Koin purchases are not available yet');
    if (!config.koraSecretKey) throw new Error('Kora checkout is not configured');
    if (!PURCHASE_PACKAGES.includes(koinAmount as any)) throw new Error('Choose a valid Koin package');

    const user = await prisma.user.findFirst({
      where: { id: userId, is_deleted: false, is_banned: false },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new Error('User not found');

    const purchaseReference = reference('KOIN');
    await prisma.koinPurchase.create({
      data: {
        user_id: user.id,
        koin_amount: koinAmount,
        naira_amount_kobo: koinAmount * KOBO_PER_KOIN,
        reference: purchaseReference,
      },
    });

    try {
      const response = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.koraSecretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: koinAmount,
          currency: 'NGN',
          reference: purchaseReference,
          notification_url: `${config.publicApiUrl.replace(/\/$/, '')}/feature-access/kora/webhook`,
          redirect_url: `akademi://koin-wallet?reference=${encodeURIComponent(purchaseReference)}`,
          narration: `${koinAmount} Akademi Koin purchase`,
          channels: ['card', 'bank_transfer', 'pay_with_bank'],
          customer: { email: user.email, name: user.name },
          metadata: { purpose: 'koin-purchase', koin: koinAmount, userId: user.id },
        }),
      });
      const result: any = await response.json().catch(() => null);
      if (!response.ok || result?.status !== true || !result?.data?.checkout_url) {
        throw new Error(result?.message || 'Kora could not initialize Koin checkout');
      }
      return {
        paymentUrl: result.data.checkout_url,
        reference: purchaseReference,
        koinAmount,
        amount: koinAmount,
        currency: 'NGN',
      };
    } catch (error) {
      await prisma.koinPurchase.updateMany({
        where: { reference: purchaseReference, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  async verifyAndCreditPurchase(purchaseReference: string, expectedUserId?: string) {
    if (!purchaseReference) throw new Error('Koin purchase reference is missing');
    if (!config.koraSecretKey) throw new Error('Kora verification is not configured');

    const purchase = await prisma.koinPurchase.findUnique({
      where: { reference: purchaseReference },
      include: { user: { select: { email: true } } },
    });
    if (!purchase || (expectedUserId && purchase.user_id !== expectedUserId)) {
      throw new Error('Koin purchase not found');
    }
    if (purchase.status === 'PAID') {
      const wallet = await prisma.koinWallet.findUnique({ where: { user_id: purchase.user_id } });
      return { paid: true, credited: false, balance: wallet?.balance || 0, purchase };
    }

    const response = await fetch(
      `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(purchaseReference)}`,
      { headers: { Authorization: `Bearer ${config.koraSecretKey}` } },
    );
    const result: any = await response.json().catch(() => null);
    const charge = result?.data;
    if (!response.ok || result?.status !== true || charge?.status !== 'success') {
      throw new Error('Kora has not confirmed this Koin payment');
    }
    if (charge.currency !== 'NGN') throw new Error('Koin purchases must be paid in NGN');

    const paidAmount = Number(charge.amount_accepted ?? charge.amount_paid ?? charge.amount);
    const expectedAmount = purchase.naira_amount_kobo / 100;
    if (!Number.isFinite(paidAmount) || paidAmount !== expectedAmount) {
      throw new Error(`Kora payment amount does not match this Koin purchase`);
    }
    const customerEmail = String(charge.customer?.email || charge.customer_email || charge.email || '').trim().toLowerCase();
    if (customerEmail && customerEmail !== purchase.user.email.trim().toLowerCase()) {
      throw new Error('Kora customer does not match this Koin purchase');
    }

    return prisma.$transaction(async (tx) => {
      const claimed = await tx.koinPurchase.updateMany({
        // A delayed success may arrive after an earlier failure callback. Server-side
        // verification is authoritative, so a verified charge may recover FAILED.
        where: { id: purchase.id, status: { in: ['PENDING', 'FAILED'] } },
        data: {
          status: 'PAID',
          provider_reference: String(charge.transaction_reference || charge.reference || purchaseReference),
          paid_at: new Date(),
        },
      });
      if (claimed.count === 0) {
        const wallet = await tx.koinWallet.findUnique({ where: { user_id: purchase.user_id } });
        return { paid: true, credited: false, balance: wallet?.balance || 0, purchase };
      }
      const wallet = await this.credit(
        tx,
        purchase.user_id,
        purchase.koin_amount,
        'PURCHASE',
        `purchase_${purchase.reference}`,
        { purchaseId: purchase.id, provider: 'korapay', nairaAmount: expectedAmount },
      );
      const updatedPurchase = await tx.koinPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
      return { paid: true, credited: true, balance: wallet.balance, purchase: updatedPurchase };
    }, { isolationLevel: 'Serializable' as any });
  }

  async markPurchaseFailed(purchaseReference: string) {
    if (!purchaseReference) return;
    await prisma.koinPurchase.updateMany({
      where: { reference: purchaseReference, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }
}

export const koinService = new KoinService();
