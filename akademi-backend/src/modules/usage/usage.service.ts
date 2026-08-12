import { UsageMetric } from '@prisma/client';
import prisma from '../../config/db';

type Limits = Record<UsageMetric, number | null>;

const FREE_LIMITS: Limits = {
  SOLVE_QUESTION: 10,
  STUDY_ASK: 10,
  CBT_SESSION: 3,
  COMPETITION_ENTRY: 3,
  AI_TUTOR_SECONDS: 15 * 60,
};

const PREMIUM_LIMITS: Limits = {
  SOLVE_QUESTION: 50,
  STUDY_ASK: null,
  CBT_SESSION: 30,
  COMPETITION_ENTRY: 30,
  AI_TUTOR_SECONDS: 3 * 60 * 60,
};

const LABELS: Record<UsageMetric, string> = {
  SOLVE_QUESTION: 'Solve questions',
  STUDY_ASK: 'Ask Akademi requests',
  CBT_SESSION: 'CBT sessions',
  COMPETITION_ENTRY: 'competition entries',
  AI_TUTOR_SECONDS: 'AI Tutor time',
};

const lagosDayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export class UsageService {
  async isPremium(userId: string) {
    return !!(await prisma.featureAccess.findFirst({
      where: { user_id: userId, product_code: { startsWith: 'AKADEMI_PRO_' }, expires_at: { gt: new Date() } },
      select: { id: true },
    }));
  }

  private periodKey(metric: UsageMetric, premium: boolean) {
    return metric === UsageMetric.AI_TUTOR_SECONDS && !premium ? 'LIFETIME_FREE_TRIAL' : lagosDayKey();
  }

  async consume(userId: string, metric: UsageMetric, amount = 1) {
    if (!Number.isInteger(amount) || amount < 1) throw new Error('Usage amount must be a positive integer');
    const premium = await this.isPremium(userId);
    const limit = (premium ? PREMIUM_LIMITS : FREE_LIMITS)[metric];
    if (limit === null) return { premium, limit: null, used: 0, remaining: null };
    const periodKey = this.periodKey(metric, premium);

    return prisma.$transaction(async (tx) => {
      const counter = await tx.userUsageCounter.upsert({
        where: { user_id_metric_period_key: { user_id: userId, metric, period_key: periodKey } },
        create: { user_id: userId, metric, period_key: periodKey, value: amount },
        update: { value: { increment: amount } },
      });
      if (counter.value > limit) {
        const error: any = new Error(`${LABELS[metric]} limit reached. ${premium ? 'Your Premium allowance resets tomorrow.' : 'Upgrade to Premium for a higher allowance.'}`);
        error.statusCode = 429;
        error.reason = 'plan_limit_reached';
        throw error;
      }
      return { premium, limit, used: counter.value, remaining: Math.max(limit - counter.value, 0) };
    }, { isolationLevel: 'Serializable' });
  }

  async getSummary(userId: string) {
    const premium = await this.isPremium(userId);
    const limits = premium ? PREMIUM_LIMITS : FREE_LIMITS;
    const dailyKey = lagosDayKey();
    const counters = await prisma.userUsageCounter.findMany({
      where: { user_id: userId, period_key: { in: [dailyKey, 'LIFETIME_FREE_TRIAL'] } },
    });
    const used = Object.fromEntries(counters.map((item) => [item.metric, item.value]));
    return {
      plan: premium ? 'PREMIUM' : 'FREE',
      periodKey: dailyKey,
      metrics: Object.fromEntries(Object.values(UsageMetric).map((metric) => {
        const limit = limits[metric];
        const value = used[metric] || 0;
        return [metric, { used: value, limit, remaining: limit === null ? null : Math.max(limit - value, 0) }];
      })),
    };
  }

  async assertAvailable(userId: string, metric: UsageMetric) {
    const summary: any = await this.getSummary(userId);
    const item = summary.metrics[metric];
    if (item.limit !== null && item.remaining <= 0) {
      const error: any = new Error(`${LABELS[metric]} limit reached. ${summary.plan === 'PREMIUM' ? 'Your Premium allowance resets tomorrow.' : 'Upgrade to Premium for a higher allowance.'}`);
      error.statusCode = 429;
      error.reason = 'plan_limit_reached';
      throw error;
    }
    return item;
  }
}

export const usageService = new UsageService();
